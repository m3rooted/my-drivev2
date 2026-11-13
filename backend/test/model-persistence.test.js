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
let blockedDirectory;
let uploadDirectory;
let retainedFile;
let retainedFolder;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-drive-write-failure-'));
  blockedDirectory = path.join(tempDir, 'store');
  uploadDirectory = path.join(tempDir, 'uploads');
  process.env.UPLOAD_DIR = uploadDirectory;
  await initializePersistence(models, { filePath: path.join(blockedDirectory, 'drive-store.json') });
  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.writeFile(path.join(uploadDirectory, 'retained.bin'), 'data');
  retainedFile = await FileModel.createFile({
    filename: 'retained.bin', originalName: 'Retained.bin', mimetype: 'application/octet-stream',
    size: 4, userId: 'test-user', folderId: null
  });
  await FileModel.deleteFile(retainedFile.id, 'test-user');
  retainedFolder = await FileModel.createFolder({ name: 'Retained folder', userId: 'test-user', parentId: null });
  await FileModel.deleteFolder(retainedFolder.id, 'test-user');
  await fs.rename(blockedDirectory, path.join(tempDir, 'committed-store'));
  await fs.writeFile(blockedDirectory, 'block directory creation');
});

after(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('rolls back in-memory account, file, and note records when persistence fails', async () => {
  await assert.rejects(User.create({ email: 'rollback@example.test', name: 'Rollback', password: 'a sufficiently long password' }));
  await assert.rejects(FileModel.createFile({
    filename: 'missing.bin', originalName: 'Missing.bin', mimetype: 'application/octet-stream',
    size: 1, userId: 'test-user', folderId: null
  }));
  await assert.rejects(NoteModel.createNote({
    userId: 'test-user', title: 'Not saved', content: '', category: 'note', startAt: new Date().toISOString()
  }));
  await assert.rejects(FileModel.permanentlyDeleteFile(retainedFile.id, 'test-user'));

  assert.equal(User.users.length, 0);
  assert.equal(FileModel.files.filter((file) => file.id === retainedFile.id).length, 1);
  assert.equal(NoteModel.notes.length, 0);

  const transientCreate = FileModel.createFile({
    filename: 'transient.bin', originalName: 'Transient.bin', mimetype: 'application/octet-stream',
    size: 1, userId: 'test-user', folderId: null
  });
  const folderDelete = FileModel.permanentlyDeleteFolder(retainedFolder.id, 'test-user');
  const results = await Promise.allSettled([transientCreate, folderDelete]);

  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'rejected');
  assert.equal(FileModel.files.some((file) => file.filename === 'transient.bin'), false);
  assert.equal(FileModel.folders.filter((folder) => folder.id === retainedFolder.id).length, 1);
});
