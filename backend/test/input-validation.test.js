process.env.JWT_SECRET = 'test-only-secret-with-enough-entropy';
process.env.CORS_ORIGINS = 'http://localhost:3001';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const createApp = require('../app');
const User = require('../models/User');
const FileModel = require('../models/File');
const NoteModel = require('../models/Note');
const notesRouter = require('../routes/notes');
const { initializePersistence } = require('../storage/persistence');

const backendDir = path.resolve(__dirname, '..');
const models = { User, FileModel, NoteModel };
let tempDir;
let server;
let baseUrl;
let ownerFolder;
let ownerUserToken;
let otherUserToken;

const request = (route, token, body, headers = {}) => fetch(`${baseUrl}${route}`, {
  method: 'POST',
  headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  body: body ? JSON.stringify(body) : undefined
});

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-drive-api-test-'));
  const uploadDir = path.relative(backendDir, path.join(tempDir, 'uploads'));
  process.env.UPLOAD_DIR = uploadDir;
  await initializePersistence(models, { filePath: path.join(tempDir, 'drive-store.json') });

  const owner = await User.create({ email: 'owner@example.test', name: 'Owner', password: 'a sufficiently long password' });
  const otherUser = await User.create({ email: 'other@example.test', name: 'Other', password: 'another sufficiently long password' });
  ownerFolder = await FileModel.createFolder({ name: 'Private folder', parentId: null, userId: owner.id });
  ownerUserToken = jwt.sign({ id: owner.id, email: owner.email }, process.env.JWT_SECRET);
  otherUserToken = jwt.sign({ id: otherUser.id, email: otherUser.email }, process.env.JWT_SECRET);

  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('rejects malformed registration input before creating an account', async () => {
  const response = await request('/api/auth/register', null, {
    email: 'not-an-email',
    name: 'A',
    password: 'short'
  });

  assert.equal(response.status, 400);
});

test('returns a client error for non-string note content', async () => {
  const response = await request('/api/notes', otherUserToken, {
    category: 'note',
    title: 42,
    content: { unexpected: true }
  });

  assert.equal(response.status, 400);
});

test('rejects invalid schedule timestamps', async () => {
  const response = await request('/api/notes', otherUserToken, {
    category: 'schedule',
    title: 'Invalid date',
    startAt: 'not-a-date'
  });

  assert.equal(response.status, 400);
});

test('does not let an unauthorized note deletion cancel or remove the owner note', async () => {
  const originalMailUser = process.env.MAIL_USER;
  const originalMailPassword = process.env.MAIL_APP_PASSWORD;
  process.env.MAIL_USER = 'reminder@example.test';
  process.env.MAIL_APP_PASSWORD = 'test-only-password';
  try {
    const created = await request('/api/notes', ownerUserToken, {
      category: 'schedule',
      title: 'Private reminder',
      startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      reminderMinutesBefore: 10
    });
    const { note } = await created.json();
    assert.equal(created.status, 201);
    assert.equal(notesRouter.getScheduledReminderCount(), 1);

    const response = await fetch(`${baseUrl}/api/notes/${note.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${otherUserToken}` }
    });

    assert.equal(response.status, 404);
    assert.ok(await NoteModel.getNoteById(note.id, ownerFolder.userId));
    assert.equal(notesRouter.getScheduledReminderCount(), 1);
  } finally {
    notesRouter.clearReminderTimers();
    if (originalMailUser === undefined) delete process.env.MAIL_USER;
    else process.env.MAIL_USER = originalMailUser;
    if (originalMailPassword === undefined) delete process.env.MAIL_APP_PASSWORD;
    else process.env.MAIL_APP_PASSWORD = originalMailPassword;
  }
});

test('prevents a user from creating folders inside another user folder', async () => {
  const response = await request('/api/folders', otherUserToken, {
    name: 'Unauthorized child',
    parentId: ownerFolder.id
  });

  assert.equal(response.status, 404);
});

test('prevents uploads into folders owned by another user', async () => {
  const form = new FormData();
  form.append('file', new Blob(['private test file']), 'report.txt');
  form.append('folderId', ownerFolder.id);
  const response = await fetch(`${baseUrl}/api/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${otherUserToken}` },
    body: form
  });

  assert.equal(response.status, 404);
});

test('rejects uploads that exceed a user storage quota and removes the temporary file', async () => {
  const originalQuota = process.env.STORAGE_QUOTA_BYTES;
  process.env.STORAGE_QUOTA_BYTES = '1';
  try {
    const form = new FormData();
    form.append('file', new Blob(['two bytes']), 'quota.txt');
    const response = await fetch(`${baseUrl}/api/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherUserToken}` },
      body: form
    });

    assert.equal(response.status, 413);
    const uploadDir = path.resolve(backendDir, process.env.UPLOAD_DIR);
    assert.deepEqual(await fs.readdir(uploadDir), []);
  } finally {
    if (originalQuota === undefined) delete process.env.STORAGE_QUOTA_BYTES;
    else process.env.STORAGE_QUOTA_BYTES = originalQuota;
  }
});
