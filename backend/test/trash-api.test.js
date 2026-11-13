process.env.JWT_SECRET = 'test-only-secret-with-enough-entropy';

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
const { initializePersistence } = require('../storage/persistence');

let tempDir;
let uploadDir;
let server;
let baseUrl;
let token;
let userId;
let childFolderId;
let collaborator;
let collaboratorToken;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-drive-trash-api-'));
  uploadDir = path.join(tempDir, 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  process.env.UPLOAD_DIR = uploadDir;
  await initializePersistence({ User, FileModel, NoteModel }, { filePath: path.join(tempDir, 'drive-store.json') });

  const user = await User.create({ email: 'trash-api@example.test', name: 'Trash API', password: 'a sufficiently long test password' });
  userId = user.id;
  token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);
  collaborator = await User.create({ email: 'collaborator@example.test', name: 'Collaborator', password: 'another sufficiently long password' });
  collaboratorToken = jwt.sign({ id: collaborator.id, email: collaborator.email }, process.env.JWT_SECRET);
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

const request = (route, options = {}) => fetch(`${baseUrl}${route}`, {
  ...options,
  headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) }
});

test('trash API restores a deleted folder and its descendants', async () => {
  const root = await FileModel.createFolder({ name: 'Archive', userId, parentId: null });
  const child = await FileModel.createFolder({ name: 'Subfolder', userId, parentId: root.id });
  childFolderId = child.id;
  await FileModel.createFile({
    filename: 'private-name.bin', originalName: 'Private.bin', mimetype: 'application/octet-stream',
    size: 4, userId, folderId: child.id, shareToken: 'must-not-leak'
  });

  const deleted = await request(`/api/folders/${root.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);

  const trashResponse = await request('/api/files/trash');
  const trash = await trashResponse.json();
  assert.deepEqual(trash.folders.map((folder) => folder.id), [root.id]);
  assert.equal(trash.folders[0].itemType, 'folder');
  assert.equal(trash.files.length, 0);

  const restored = await request(`/api/folders/${root.id}/restore`, { method: 'POST' });
  assert.equal(restored.status, 200);
  assert.equal((await FileModel.getFoldersByUserId(userId, root.id)).length, 1);
  assert.equal((await FileModel.getFilesByUserId(userId, child.id)).length, 1);
});

test('file listing hides private storage and sharing fields', async () => {
  const response = await request(`/api/files?folderId=${encodeURIComponent(childFolderId)}`);
  const payload = await response.json();
  const file = payload.files.find((entry) => entry.originalName === 'Private.bin');

  assert.equal(response.status, 200);
  assert.ok(file);
  assert.equal('filename' in file, false);
  assert.equal('userId' in file, false);
  assert.equal('shareToken' in file, false);
  assert.equal('sharedWith' in file, false);
});

test('permanently deleting a folder removes its stored files', async () => {
  const folder = await FileModel.createFolder({ name: 'Old archive', userId, parentId: null });
  const storedPath = path.join(uploadDir, 'old.txt');
  await fs.writeFile(storedPath, 'old');
  await FileModel.createFile({
    filename: 'old.txt', originalName: 'Old.txt', mimetype: 'text/plain', size: 3, userId, folderId: folder.id
  });
  await FileModel.deleteFolder(folder.id, userId);

  const deleted = await request(`/api/folders/${folder.id}/permanent`, { method: 'DELETE' });

  assert.equal(deleted.status, 200);
  await assert.rejects(fs.access(storedPath));
  assert.equal(await FileModel.getFolderById(folder.id, userId), undefined);
});

test('share links do not trust the request Host header and download only the shared file', async () => {
  const filename = 'share-target.txt';
  await fs.writeFile(path.join(uploadDir, filename), 'shared file body');
  const file = await FileModel.createFile({
    filename,
    originalName: 'Shared.txt',
    mimetype: 'text/plain',
    size: 16,
    userId,
    folderId: null
  });

  const linkResponse = await request(`/api/files/${file.id}/share-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Host: 'attacker.example' },
    body: JSON.stringify({ permission: 'viewer' })
  });
  const link = await linkResponse.json();

  assert.equal(linkResponse.status, 200);
  assert.equal(new URL(link.url).host, '127.0.0.1:5000');
  assert.equal(link.url.includes('attacker.example'), false);

  const downloadPath = new URL(link.url).pathname;
  const download = await fetch(`${baseUrl}${downloadPath}`);
  assert.equal(download.status, 200);
  assert.equal(await download.text(), 'shared file body');
  assert.equal(download.headers.get('content-disposition').includes('attachment'), true);
});

test('forwards persistence errors from async folder routes to the API error handler', async () => {
  const folder = await FileModel.createFolder({ name: 'Restore error', userId, parentId: null });
  await FileModel.deleteFolder(folder.id, userId);
  const originalRestore = FileModel.restoreFolder;
  FileModel.restoreFolder = async () => { throw new Error('simulated persistence error'); };

  let response;
  try {
    response = await request(`/api/folders/${folder.id}/restore`, { method: 'POST' });
  } finally {
    FileModel.restoreFolder = originalRestore;
  }

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Something went wrong' });
});

test('stores recent and favorite state independently for each shared file user', async () => {
  const file = await FileModel.createFile({
    filename: 'shared-activity.txt', originalName: 'Shared activity.txt', mimetype: 'text/plain',
    size: 1, userId, folderId: null
  });
  await FileModel.shareFile(file.id, userId, collaborator, 'viewer');
  await FileModel.markRecent(file.id, userId);
  await FileModel.toggleFavorite(file.id, userId);
  const ownerRecentAt = FileModel.getRecentAtForUser(file, userId);

  const collaboratorFavorite = await fetch(`${baseUrl}/api/files/${file.id}/favorite`, {
    method: 'POST', headers: { Authorization: `Bearer ${collaboratorToken}` }
  });
  assert.equal(collaboratorFavorite.status, 200);
  const collaboratorFavoriteFile = (await collaboratorFavorite.json()).file;
  assert.equal(collaboratorFavoriteFile.isShared, true);
  assert.equal(collaboratorFavoriteFile.sharedPermission, 'viewer');
  assert.equal('userId' in collaboratorFavoriteFile, false);

  const collaboratorRecent = await fetch(`${baseUrl}/api/files/${file.id}/recent`, {
    method: 'POST', headers: { Authorization: `Bearer ${collaboratorToken}` }
  });
  assert.equal(collaboratorRecent.status, 200);
  assert.notEqual(FileModel.getRecentAtForUser(file, collaborator.id), ownerRecentAt);

  const ownerFavorites = await request('/api/files/favorites');
  const collaboratorFavorites = await fetch(`${baseUrl}/api/files/favorites`, {
    headers: { Authorization: `Bearer ${collaboratorToken}` }
  });
  const ownerFavoriteFile = (await ownerFavorites.json()).files.find((entry) => entry.id === file.id);
  const collaboratorFavoriteEntry = (await collaboratorFavorites.json()).files.find((entry) => entry.id === file.id);
  assert.equal(ownerFavoriteFile.isShared, false);
  assert.equal(collaboratorFavoriteEntry.isShared, true);
  assert.equal(collaboratorFavoriteEntry.sharedPermission, 'viewer');

  const collaboratorRecents = await fetch(`${baseUrl}/api/files/recent`, {
    headers: { Authorization: `Bearer ${collaboratorToken}` }
  });
  const recentFile = (await collaboratorRecents.json()).files.find((entry) => entry.id === file.id);
  assert.equal(new Date(recentFile.recentAt).getTime(), new Date(FileModel.getRecentAtForUser(file, collaborator.id)).getTime());
  assert.equal(recentFile.isShared, true);
  assert.equal(recentFile.sharedPermission, 'viewer');
  assert.equal('userId' in recentFile, false);
});
