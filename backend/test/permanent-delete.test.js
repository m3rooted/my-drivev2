const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsExtra = require('fs-extra');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const User = require('../models/User');
const FileModel = require('../models/File');
const NoteModel = require('../models/Note');
const { initializePersistence } = require('../storage/persistence');

const models = { User, FileModel, NoteModel };
let tempDir;
let uploadDirectory;
let userId;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-drive-delete-failure-'));
  uploadDirectory = path.join(tempDir, 'uploads');
  process.env.UPLOAD_DIR = uploadDirectory;
  await fs.mkdir(uploadDirectory, { recursive: true });
  await initializePersistence(models, { filePath: path.join(tempDir, 'drive-store.json') });
  const user = await User.create({ email: 'delete-owner@example.test', name: 'Delete owner', password: 'a sufficiently long password' });
  userId = user.id;
});

after(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

const rejectPhysicalDeleteFor = async (targetPath, startOperation) => {
  const originalRemove = fsExtra.remove;
  fsExtra.remove = async (candidate, ...args) => {
    if (path.resolve(candidate) === path.resolve(targetPath)) throw new Error('simulated unlink failure');
    return originalRemove(candidate, ...args);
  };
  try {
    await assert.rejects(startOperation(), /simulated unlink failure/);
  } finally {
    fsExtra.remove = originalRemove;
  }
};

test('keeps a trashed file record when physical file removal fails', async () => {
  const filePath = path.join(uploadDirectory, 'file-unlink-failure.bin');
  await fs.writeFile(filePath, 'file');
  const file = await FileModel.createFile({
    filename: path.basename(filePath), originalName: 'File.bin', mimetype: 'application/octet-stream',
    size: 4, userId, folderId: null
  });
  await FileModel.deleteFile(file.id, userId);

  await rejectPhysicalDeleteFor(filePath, () => FileModel.permanentlyDeleteFile(file.id, userId));

  assert.equal(FileModel.files.filter((entry) => entry.id === file.id).length, 1);
  assert.ok((await FileModel.getTrash(userId)).files.some((entry) => entry.id === file.id));
  await fs.access(filePath);
});

test('keeps a trashed folder tree when one of its physical file removals fails', async () => {
  const folder = await FileModel.createFolder({ name: 'Folder unlink failure', userId, parentId: null });
  const filePath = path.join(uploadDirectory, 'folder-unlink-failure.bin');
  const secondFilePath = path.join(uploadDirectory, 'folder-unlink-failure-second.bin');
  await fs.writeFile(filePath, 'first folder file');
  await fs.writeFile(secondFilePath, 'second folder file');
  const file = await FileModel.createFile({
    filename: path.basename(filePath), originalName: 'Folder file.bin', mimetype: 'application/octet-stream',
    size: 17, userId, folderId: folder.id
  });
  const secondFile = await FileModel.createFile({
    filename: path.basename(secondFilePath), originalName: 'Folder file second.bin', mimetype: 'application/octet-stream',
    size: 18, userId, folderId: folder.id
  });
  await FileModel.deleteFolder(folder.id, userId);

  const originalMove = fsExtra.move;
  fsExtra.move = async (source, destination, ...args) => {
    if (path.basename(source) === path.basename(secondFilePath)) throw new Error('simulated staging failure');
    return originalMove(source, destination, ...args);
  };
  try {
    await assert.rejects(FileModel.permanentlyDeleteFolder(folder.id, userId), /simulated staging failure/);
  } finally {
    fsExtra.move = originalMove;
  }

  assert.equal(FileModel.folders.filter((entry) => entry.id === folder.id).length, 1);
  assert.equal(FileModel.files.filter((entry) => entry.id === file.id).length, 1);
  assert.equal(FileModel.files.filter((entry) => entry.id === secondFile.id).length, 1);
  assert.ok((await FileModel.getTrash(userId)).folders.some((entry) => entry.id === folder.id));
  await fs.access(filePath);
  await fs.access(secondFilePath);
});

test('re-finds file metadata after concurrent unlink operations complete', async () => {
  const firstPath = path.join(uploadDirectory, 'concurrent-delete-first.bin');
  const secondPath = path.join(uploadDirectory, 'concurrent-delete-second.bin');
  await fs.writeFile(firstPath, 'first');
  await fs.writeFile(secondPath, 'second');
  const first = await FileModel.createFile({
    filename: path.basename(firstPath), originalName: 'First.bin', mimetype: 'application/octet-stream',
    size: 5, userId, folderId: null
  });
  const second = await FileModel.createFile({
    filename: path.basename(secondPath), originalName: 'Second.bin', mimetype: 'application/octet-stream',
    size: 6, userId, folderId: null
  });
  await FileModel.deleteFile(first.id, userId);
  await FileModel.deleteFile(second.id, userId);

  const originalRemove = fsExtra.remove;
  let finishFirst;
  let finishSecond;
  fsExtra.remove = (candidate, ...args) => {
    if (path.resolve(candidate) === path.resolve(firstPath)) {
      return new Promise((resolve, reject) => { finishFirst = () => originalRemove(candidate, ...args).then(resolve, reject); });
    }
    if (path.resolve(candidate) === path.resolve(secondPath)) {
      return new Promise((resolve, reject) => { finishSecond = () => originalRemove(candidate, ...args).then(resolve, reject); });
    }
    return originalRemove(candidate, ...args);
  };
  try {
    const deletingFirst = FileModel.permanentlyDeleteFile(first.id, userId);
    const deletingSecond = FileModel.permanentlyDeleteFile(second.id, userId);
    await new Promise((resolve) => setImmediate(resolve));
    finishFirst();
    await deletingFirst;
    finishSecond();
    await deletingSecond;
  } finally {
    fsExtra.remove = originalRemove;
  }

  assert.equal(FileModel.files.some((entry) => entry.id === first.id || entry.id === second.id), false);
});

test('serializes restore against permanent file deletion', async () => {
  const filePath = path.join(uploadDirectory, 'restore-file-race.bin');
  await fs.writeFile(filePath, 'delete or restore');
  const file = await FileModel.createFile({
    filename: path.basename(filePath), originalName: 'Restore race.bin', mimetype: 'application/octet-stream',
    size: 17, userId, folderId: null
  });
  await FileModel.deleteFile(file.id, userId);

  const originalRemove = fsExtra.remove;
  let finishRemove;
  fsExtra.remove = (candidate, ...args) => {
    if (path.resolve(candidate) === path.resolve(filePath)) {
      return new Promise((resolve, reject) => {
        finishRemove = () => originalRemove(candidate, ...args).then(resolve, reject);
      });
    }
    return originalRemove(candidate, ...args);
  };
  try {
    const deleting = FileModel.permanentlyDeleteFile(file.id, userId);
    await new Promise((resolve) => setImmediate(resolve));
    let restoreSettled = false;
    const restoring = FileModel.restoreFile(file.id, userId).then((result) => {
      restoreSettled = true;
      return result;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(restoreSettled, false);
    finishRemove();
    assert.equal(await deleting, true);
    assert.equal(await restoring, false);
  } finally {
    fsExtra.remove = originalRemove;
  }

  assert.equal(FileModel.files.some((entry) => entry.id === file.id), false);
  await assert.rejects(fs.access(filePath));
});

test('serializes folder restore against permanent folder deletion', async () => {
  const folder = await FileModel.createFolder({ name: 'Restore folder race', userId, parentId: null });
  const filePath = path.join(uploadDirectory, 'restore-folder-race.bin');
  await fs.writeFile(filePath, 'folder race');
  const file = await FileModel.createFile({
    filename: path.basename(filePath), originalName: 'Folder race.bin', mimetype: 'application/octet-stream',
    size: 11, userId, folderId: folder.id
  });
  await FileModel.deleteFolder(folder.id, userId);

  const originalMove = fsExtra.move;
  let finishMove;
  fsExtra.move = (source, destination, ...args) => {
    if (path.resolve(source) === path.resolve(filePath)) {
      return new Promise((resolve, reject) => {
        finishMove = () => originalMove(source, destination, ...args).then(resolve, reject);
      });
    }
    return originalMove(source, destination, ...args);
  };
  try {
    const deleting = FileModel.permanentlyDeleteFolder(folder.id, userId);
    await new Promise((resolve) => setImmediate(resolve));
    let restoreSettled = false;
    const restoring = FileModel.restoreFolder(folder.id, userId).then((result) => {
      restoreSettled = true;
      return result;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(restoreSettled, false);
    finishMove();
    assert.equal(await deleting, true);
    assert.equal(await restoring, false);
  } finally {
    fsExtra.move = originalMove;
  }

  assert.equal(FileModel.folders.some((entry) => entry.id === folder.id), false);
  assert.equal(FileModel.files.some((entry) => entry.id === file.id), false);
  await assert.rejects(fs.access(filePath));
});
