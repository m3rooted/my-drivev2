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

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-drive-user-race-'));
  await initializePersistence({ User, FileModel, NoteModel }, { filePath: path.join(tempDir, 'drive-store.json') });
});

after(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('creates only one account when two registrations race on the same email', async () => {
  const results = await Promise.allSettled([
    User.create({ email: 'racing@example.test', name: 'First', password: 'first sufficiently long password' }),
    User.create({ email: 'RACING@example.test', name: 'Second', password: 'second sufficiently long password' })
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(User.users.filter((user) => user.email === 'racing@example.test').length, 1);
});
