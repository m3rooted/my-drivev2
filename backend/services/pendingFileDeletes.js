const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STAGING_DIRECTORY = '.delete-staging';
const MANIFEST_NAME = 'manifest.json';

const resolveUploadPath = (uploadDirectory, filename) => {
  if (typeof filename !== 'string' || !filename || path.basename(filename) !== filename) return null;
  const root = path.resolve(uploadDirectory);
  const resolved = path.resolve(root, filename);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
};

const restoreStagedFiles = async (operationDirectory, entries, uploadDirectory) => {
  for (const entry of [...entries].reverse()) {
    const sourcePath = resolveUploadPath(uploadDirectory, entry.filename);
    const stagedPath = path.resolve(operationDirectory, entry.stagedName);
    if (!sourcePath || !entry.stagedName || path.basename(entry.stagedName) !== entry.stagedName ||
        !stagedPath.startsWith(`${path.resolve(operationDirectory)}${path.sep}`)) {
      throw new Error('Invalid pending delete manifest');
    }
    if (!(await fs.pathExists(stagedPath))) continue;
    if (await fs.pathExists(sourcePath)) {
      throw new Error(`Cannot restore staged file because the upload path is occupied: ${entry.filename}`);
    }
    await fs.move(stagedPath, sourcePath, { overwrite: false });
  }
};

const removeOperationDirectory = async (operationDirectory) => {
  await fs.remove(operationDirectory);
  const stagingRoot = path.dirname(operationDirectory);
  const remaining = await fs.readdir(stagingRoot).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  if (remaining.length === 0) await fs.remove(stagingRoot);
};

const stageFilesForPermanentDelete = async (files, uploadDirectory) => {
  const root = path.resolve(uploadDirectory);
  const operationDirectory = path.join(root, STAGING_DIRECTORY, uuidv4());
  const entries = files.map((file, index) => ({
    id: file.id,
    filename: file.filename,
    stagedName: `${index}.data`
  }));

  for (const entry of entries) {
    if (!resolveUploadPath(root, entry.filename)) throw new Error('Unsafe file path in delete request');
  }

  await fs.ensureDir(operationDirectory);
  try {
    await fs.writeJson(path.join(operationDirectory, MANIFEST_NAME), { version: 1, entries }, { spaces: 2, mode: 0o600 });
    for (const entry of entries) {
      const sourcePath = resolveUploadPath(root, entry.filename);
      if (!(await fs.pathExists(sourcePath))) continue;
      await fs.move(sourcePath, path.join(operationDirectory, entry.stagedName), { overwrite: false });
    }
  } catch (error) {
    try {
      await restoreStagedFiles(operationDirectory, entries, root);
      await removeOperationDirectory(operationDirectory);
    } catch (rollbackError) {
      console.error('Failed to roll back staged permanent delete:', rollbackError.message);
    }
    throw error;
  }

  return {
    async rollback() {
      await restoreStagedFiles(operationDirectory, entries, root);
      await removeOperationDirectory(operationDirectory);
    },
    async finalize() {
      await removeOperationDirectory(operationDirectory);
    }
  };
};

const recoverPendingFileDeletes = async (files, uploadDirectory) => {
  const root = path.join(path.resolve(uploadDirectory), STAGING_DIRECTORY);
  if (!(await fs.pathExists(root))) return;

  const operations = await fs.readdir(root, { withFileTypes: true });
  for (const operation of operations) {
    if (!operation.isDirectory()) throw new Error('Unexpected entry in pending file delete directory');
    const operationDirectory = path.join(root, operation.name);
    const manifestPath = path.join(operationDirectory, MANIFEST_NAME);
    if (!(await fs.pathExists(manifestPath))) {
      const entries = await fs.readdir(operationDirectory);
      if (entries.length === 0) {
        await fs.remove(operationDirectory);
        continue;
      }
      throw new Error('Pending file delete manifest is missing; startup stopped to protect stored files');
    }

    const manifest = await fs.readJson(manifestPath);
    if (manifest?.version !== 1 || !Array.isArray(manifest.entries)) {
      throw new Error('Pending file delete manifest is invalid; startup stopped to protect stored files');
    }

    for (const entry of manifest.entries) {
      if (!entry || typeof entry.id !== 'string' || typeof entry.filename !== 'string' ||
          typeof entry.stagedName !== 'string' || !/^\d+\.data$/.test(entry.stagedName)) {
        throw new Error('Pending file delete manifest contains an unsafe entry');
      }
      if (files.some((file) => file.id === entry.id)) {
        await restoreStagedFiles(operationDirectory, [entry], uploadDirectory);
      } else {
        const stagedPath = path.join(operationDirectory, entry.stagedName);
        await fs.remove(stagedPath);
      }
    }

    await removeOperationDirectory(operationDirectory);
  }

  const remaining = await fs.readdir(root).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  if (remaining.length === 0) await fs.remove(root);
};

module.exports = { recoverPendingFileDeletes, stageFilesForPermanentDelete };
