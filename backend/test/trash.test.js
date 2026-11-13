const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const User = require('../models/User');
const FileModel = require('../models/File');
const NoteModel = require('../models/Note');
const { initializePersistence } = require('../storage/persistence');

const models = { User, FileModel, NoteModel };
let tempDir;
let userId;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-drive-trash-test-'));
  process.env.UPLOAD_DIR = path.join(tempDir, 'uploads');
  await fs.mkdir(process.env.UPLOAD_DIR, { recursive: true });
  await initializePersistence(models, { filePath: path.join(tempDir, 'drive-store.json') });
  const user = await User.create({ email: 'trash@example.test', name: 'Trash User', password: 'sufficiently long password' });
  userId = user.id;
});

after(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('moves a folder tree and its files to trash as one recoverable item', async () => {
  const root = await FileModel.createFolder({ name: 'Projects', userId, parentId: null });
  const child = await FileModel.createFolder({ name: 'Drafts', userId, parentId: root.id });
  await FileModel.createFile({
    filename: 'draft.txt', originalName: 'Draft.txt', mimetype: 'text/plain', size: 5,
    userId, folderId: child.id
  });

  assert.equal(await FileModel.deleteFolder(root.id, userId), true);
  const trash = await FileModel.getTrash(userId);

  assert.deepEqual(trash.folders.map((folder) => folder.id), [root.id]);
  assert.equal(trash.files.length, 0);
  assert.deepEqual(await FileModel.getFoldersByUserId(userId, root.id), []);
  assert.deepEqual(await FileModel.getFilesByUserId(userId, child.id), []);
});

test('restores all descendants when the trashed folder is restored', async () => {
  const [root] = await FileModel.getTrash(userId).then(({ folders }) => folders);

  assert.equal(await FileModel.restoreFolder(root.id, userId), true);
  const child = await FileModel.getFoldersByUserId(userId, root.id).then((folders) => folders[0]);
  const files = await FileModel.getFilesByUserId(userId, child.id);

  assert.equal(child.name, 'Drafts');
  assert.deepEqual(files.map((file) => file.originalName), ['Draft.txt']);
});

test('permanently deletes trashed folder files from the upload directory', async () => {
  const folder = await FileModel.createFolder({ name: 'Old archive', userId, parentId: null });
  await fs.writeFile(path.join(process.env.UPLOAD_DIR, 'old.txt'), 'old');
  const file = await FileModel.createFile({
    filename: 'old.txt', originalName: 'Old.txt', mimetype: 'text/plain', size: 3,
    userId, folderId: folder.id
  });
  await FileModel.deleteFolder(folder.id, userId);

  assert.equal(await FileModel.permanentlyDeleteFolder(folder.id, userId), true);
  await assert.rejects(fs.access(path.join(process.env.UPLOAD_DIR, file.filename)));
  assert.equal(await FileModel.getFolderById(folder.id, userId), undefined);
});
