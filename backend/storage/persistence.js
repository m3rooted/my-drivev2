const fs = require('fs-extra');
const path = require('path');
const { randomUUID } = require('node:crypto');

const SCHEMA_VERSION = 1;
const defaultFilePath = path.join(__dirname, '..', 'data', 'drive-store.json');
let activeStore = null;
let activeModels = null;
let lastCommittedState = null;
let mutationVersion = 0;

const createStore = (filePath) => {
  let pendingWrite = Promise.resolve();
  let writeFailure = null;

  return {
    async load() {
      let contents;
      try {
        contents = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          return { version: SCHEMA_VERSION, users: [], files: [], folders: [], notes: [], notebooks: [] };
        }
        throw error;
      }

      let data;
      try {
        data = JSON.parse(contents);
      } catch {
        throw new Error(`Drive data at ${filePath} is invalid JSON; startup stopped to protect existing data`);
      }

      const isValid = data?.version === SCHEMA_VERSION &&
        ['users', 'files', 'folders', 'notes'].every((key) => Array.isArray(data[key])) &&
        (data.notebooks === undefined || Array.isArray(data.notebooks));
      if (!isValid) {
        throw new Error(`Drive data at ${filePath} has an unsupported schema; startup stopped to protect existing data`);
      }

      return { ...data, notebooks: data.notebooks || [] };
    },

    async save(state) {
      const serialized = JSON.stringify(state, null, 2);
      pendingWrite = pendingWrite.catch(() => undefined).then(async () => {
        if (writeFailure) throw writeFailure;
        const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
        try {
          await fs.ensureDir(path.dirname(filePath));
          await fs.writeFile(temporaryPath, serialized, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
          await fs.rename(temporaryPath, filePath);
        } catch (error) {
          await fs.remove(temporaryPath).catch(() => undefined);
          writeFailure = error;
          throw error;
        }
      });
      await pendingWrite;
    }
  };
};

const initializePersistence = async (models, options = {}) => {
  const filePath = path.resolve(options.filePath || process.env.DATA_FILE || defaultFilePath);
  const store = createStore(filePath);
  const state = await store.load();

  models.User.users = state.users;
  models.FileModel.files = state.files;
  models.FileModel.folders = state.folders;
  models.NoteModel.notes = state.notes;
  if (models.NotebookModel) models.NotebookModel.notebooks = state.notebooks;

  activeStore = store;
  activeModels = models;
  lastCommittedState = structuredClone(state);
  mutationVersion = 0;
};

const persistState = async () => {
  if (!activeStore || !activeModels) return;

  const version = ++mutationVersion;
  const snapshot = structuredClone({
    version: SCHEMA_VERSION,
    users: activeModels.User.users,
    files: activeModels.FileModel.files,
    folders: activeModels.FileModel.folders,
    notes: activeModels.NoteModel.notes,
    notebooks: activeModels.NotebookModel?.notebooks || []
  });

  try {
    await activeStore.save(snapshot);
    lastCommittedState = snapshot;
  } catch (error) {
    if (version === mutationVersion && lastCommittedState) {
      activeModels.User.users = structuredClone(lastCommittedState.users);
      activeModels.FileModel.files = structuredClone(lastCommittedState.files);
      activeModels.FileModel.folders = structuredClone(lastCommittedState.folders);
      activeModels.NoteModel.notes = structuredClone(lastCommittedState.notes);
      if (activeModels.NotebookModel) {
        activeModels.NotebookModel.notebooks = structuredClone(lastCommittedState.notebooks || []);
      }
    }
    throw error;
  }
};

module.exports = { initializePersistence, persistState };
