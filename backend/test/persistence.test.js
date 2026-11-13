const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const User = require('../models/User');
const FileModel = require('../models/File');
const NoteModel = require('../models/Note');
const { initializePersistence } = require('../storage/persistence');

let tempDir;
let filePath;
const models = { User, FileModel, NoteModel };

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-drive-persistence-test-'));
  filePath = path.join(tempDir, 'drive-store.json');
  await initializePersistence(models, { filePath });
});

after(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('restores users, files, folders, and notes from disk after reinitialization', async () => {
  const user = await User.create({
    email: 'archive@example.test',
    name: 'Archive User',
    password: 'test password that is long enough'
  });
  const file = await FileModel.createFile({
    filename: 'stored-file.bin',
    originalName: 'Archive.bin',
    mimetype: 'application/octet-stream',
    size: 12,
    userId: user.id,
    folderId: null
  });
  const folder = await FileModel.createFolder({ name: 'Receipts', userId: user.id, parentId: null });
  const note = await NoteModel.createNote({
    userId: user.id,
    title: 'Renew the plan',
    content: 'Keep a copy of the receipt',
    category: 'note'
  });

  await initializePersistence(models, { filePath });

  assert.equal((await User.findByEmail('ARCHIVE@example.test')).id, user.id);
  assert.equal((await FileModel.getFileById(file.id, user.id)).originalName, 'Archive.bin');
  assert.equal((await FileModel.getFolderById(folder.id, user.id)).name, 'Receipts');
  assert.equal((await NoteModel.getNoteById(note.id, user.id)).title, 'Renew the plan');
});
