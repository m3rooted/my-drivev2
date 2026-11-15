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
const NotebookModel = require('../models/Notebook');
const { initializePersistence } = require('../storage/persistence');

let tempDir;
let uploadDir;
let server;
let baseUrl;
let token;
let foreignToken;
let userId;
let foreignUserId;
let guideFileId;
let notesFileId;
let foreignFileId;
let notebookId;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cloudnest-notebooks-'));
  uploadDir = path.join(tempDir, 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  process.env.UPLOAD_DIR = uploadDir;
  await initializePersistence(
    { User, FileModel, NoteModel, NotebookModel },
    { filePath: path.join(tempDir, 'drive-store.json') }
  );

  const user = await User.create({
    email: 'notebook@example.test',
    name: 'Notebook User',
    password: 'a sufficiently long test password'
  });
  userId = user.id;
  token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);

  const foreignUser = await User.create({
    email: 'another-notebook@example.test',
    name: 'Another User',
    password: 'another sufficiently long test password'
  });
  foreignUserId = foreignUser.id;
  foreignToken = jwt.sign({ id: foreignUser.id, email: foreignUser.email }, process.env.JWT_SECRET);
  await fs.writeFile(path.join(uploadDir, 'guide.pdf'), '%PDF-1.4 sample');
  await fs.writeFile(path.join(uploadDir, 'notes.txt'), 'CloudNest notes');
  await fs.writeFile(path.join(uploadDir, 'archive.zip'), 'not a supported source');
  await fs.writeFile(path.join(uploadDir, 'private.txt'), 'another user private source');
  await fs.mkdir(path.join(uploadDir, 'folder.txt'));
  const guide = await FileModel.createFile({
    filename: 'guide.pdf', originalName: 'Guide.pdf', mimetype: 'application/pdf', size: 16, userId, folderId: null
  });
  guideFileId = guide.id;
  await FileModel.shareFile(guide.id, userId, foreignUser, 'viewer');
  const notes = await FileModel.createFile({
    filename: 'notes.txt', originalName: 'Notes.txt', mimetype: 'text/plain', size: 15, userId, folderId: null
  });
  notesFileId = notes.id;
  await FileModel.createFile({
    filename: 'archive.zip', originalName: 'Archive.zip', mimetype: 'application/zip', size: 23, userId, folderId: null
  });
  await FileModel.createFile({
    filename: 'folder.txt', originalName: 'Folder.txt', mimetype: 'text/plain', size: 0, userId, folderId: null
  });
  const foreignFile = await FileModel.createFile({
    filename: 'private.txt', originalName: 'Private.txt', mimetype: 'text/plain', size: 27,
    userId: foreignUser.id, folderId: null
  });
  foreignFileId = foreignFile.id;

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

const requestAs = (route, bearerToken, options = {}) => fetch(`${baseUrl}${route}`, {
  ...options,
  headers: { Authorization: `Bearer ${bearerToken}`, ...(options.headers || {}) }
});

test('requires authentication to list notebook sources', async () => {
  const response = await fetch(`${baseUrl}/api/notebooks/sources`);

  assert.equal(response.status, 401);
});

test('reports provider readiness without exposing server configuration', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key-never-log';
  try {
    const response = await request('/api/notebooks/status');
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { aiConfigured: true });
    assert.equal(JSON.stringify(payload).includes('test-key-never-log'), false);
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test('lists only supported, accessible notebook sources without leaking storage paths', async () => {
  const response = await request('/api/notebooks/sources');
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.sources.map((source) => source.originalName), ['Guide.pdf', 'Notes.txt']);
  assert.equal('filename' in payload.sources[0], false);
  assert.equal('userId' in payload.sources[0], false);
});

test('allows a shared viewer to use an accessible file as a notebook source', async () => {
  const response = await requestAs('/api/notebooks/sources', foreignToken);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.sources.map((source) => source.originalName), ['Guide.pdf', 'Private.txt']);

  const created = await requestAs('/api/notebooks', foreignToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Shared research', sourceIds: [guideFileId] })
  });
  assert.equal(created.status, 201);
});

test('does not let a user create a notebook with another user\'s source', async () => {
  const response = await request('/api/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Private source', sourceIds: [foreignFileId] })
  });

  assert.equal(response.status, 404);
});

test('rejects a source set that exceeds the aggregate text size limit', async () => {
  const content = Buffer.alloc(1100 * 1024, 0x61);
  await fs.writeFile(path.join(uploadDir, 'large-a.txt'), content);
  await fs.writeFile(path.join(uploadDir, 'large-b.txt'), content);
  const first = await FileModel.createFile({
    filename: 'large-a.txt', originalName: 'Large A.txt', mimetype: 'text/plain', size: content.length, userId, folderId: null
  });
  const second = await FileModel.createFile({
    filename: 'large-b.txt', originalName: 'Large B.txt', mimetype: 'text/plain', size: content.length, userId, folderId: null
  });
  const response = await request('/api/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Too much text', sourceIds: [first.id, second.id] })
  });

  assert.equal(response.status, 413);
});

test('creates a persistent notebook from supported sources', async () => {
  const response = await request('/api/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Project notes', sourceIds: [guideFileId, notesFileId] })
  });
  const payload = await response.json();
  notebookId = payload.notebook?.id;

  assert.equal(response.status, 201);
  assert.equal(payload.notebook.title, 'Project notes');
  assert.deepEqual(payload.notebook.sources.map((source) => source.id), [guideFileId, notesFileId]);
  assert.deepEqual(payload.notebook.messages, []);
  assert.equal('userId' in payload.notebook, false);
});

test('keeps notebook access scoped to its creator', async () => {
  const response = await requestAs(`/api/notebooks/${notebookId}`, foreignToken);

  assert.equal(response.status, 404);
});

test('does not call Gemini or save a message when the server key is missing', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const response = await request(`/api/notebooks/${notebookId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What do the notes say?' })
    });
    const payload = await response.json();
    const stored = await request(`/api/notebooks/${notebookId}`);

    assert.equal(response.status, 503);
    assert.match(payload.error, /not configured/i);
    assert.deepEqual((await stored.json()).notebook.messages, []);
  } finally {
    if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
  }
});

test('answers from the selected sources and persists the conversation', async () => {
  assert.ok(notebookId, 'the preceding test creates the notebook');
  const originalFetch = global.fetch;
  let providerRequest;
  process.env.GEMINI_API_KEY = 'test-key-never-log';
  global.fetch = async (input, options) => {
    const url = String(input);
    if (!url.startsWith('https://generativelanguage.googleapis.com/')) {
      return originalFetch(input, options);
    }

    providerRequest = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'The notes describe CloudNest. [Notes.txt]' }] } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const response = await request(`/api/notebooks/${notebookId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What do the notes say?' })
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.match(payload.message.content, /describe CloudNest/);
    assert.match(providerRequest.options.headers['x-goog-api-key'], /test-key-never-log/);
    assert.equal(providerRequest.body.contents.at(-1).parts.some((part) => part.text?.includes('CloudNest notes')), true);
    assert.equal(providerRequest.body.contents.at(-1).parts.some((part) => part.inlineData?.mimeType === 'application/pdf'), true);
    assert.match(providerRequest.body.systemInstruction.parts[0].text, /untrusted reference data/);

    const stored = await request(`/api/notebooks/${notebookId}`);
    const storedPayload = await stored.json();
    assert.deepEqual(storedPayload.notebook.messages.map((message) => message.role), ['user', 'assistant']);
    assert.equal(storedPayload.notebook.messages[1].content, payload.message.content);

    await initializePersistence(
      { User, FileModel, NoteModel, NotebookModel },
      { filePath: path.join(tempDir, 'drive-store.json') }
    );
    const restored = await request(`/api/notebooks/${notebookId}`);
    const restoredPayload = await restored.json();
    assert.deepEqual(restoredPayload.notebook.messages.map((message) => message.role), ['user', 'assistant']);
    assert.equal('userId' in restoredPayload.notebook, false);
  } finally {
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }
});

test('returns the answer from the matching request when messages finish concurrently', async () => {
  const originalFetch = global.fetch;
  const originalAddConversationTurn = NotebookModel.addConversationTurn.bind(NotebookModel);
  let markFirstTurnAdded;
  let releaseFirstTurn;
  const firstTurnAdded = new Promise((resolve) => { markFirstTurnAdded = resolve; });
  const holdFirstTurn = new Promise((resolve) => { releaseFirstTurn = resolve; });
  process.env.GEMINI_API_KEY = 'test-key-never-log';
  global.fetch = async (input, options) => {
    if (!String(input).startsWith('https://generativelanguage.googleapis.com/')) return originalFetch(input, options);
    const body = JSON.parse(options.body);
    const question = body.contents.at(-1).parts[0].text;
    const answer = question.includes('concurrent question A') ? 'Answer A' : 'Answer B';
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: answer }] } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  NotebookModel.addConversationTurn = async (...args) => {
    const notebook = await originalAddConversationTurn(...args);
    if (args[2] === 'concurrent question A') {
      markFirstTurnAdded();
      await holdFirstTurn;
    }
    return notebook;
  };

  try {
    const firstResponsePromise = request(`/api/notebooks/${notebookId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'concurrent question A' })
    });
    await firstTurnAdded;

    const secondResponse = await request(`/api/notebooks/${notebookId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'concurrent question B' })
    });
    const secondPayload = await secondResponse.json();
    releaseFirstTurn();
    const firstResponse = await firstResponsePromise;
    const firstPayload = await firstResponse.json();

    assert.equal(secondPayload.message.content, 'Answer B');
    assert.equal(firstPayload.message.content, 'Answer A');
  } finally {
    releaseFirstTurn();
    NotebookModel.addConversationTurn = originalAddConversationTurn;
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }
});

test('caps Gemini chat requests per user to limit accidental API cost', async () => {
  const user = await User.create({
    email: 'rate-limited@example.test',
    name: 'Rate Limited User',
    password: 'a sufficiently long test password for rate limits'
  });
  const userToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);
  const file = await FileModel.createFile({
    filename: 'notes.txt', originalName: 'Notes.txt', mimetype: 'text/plain', size: 15, userId: user.id, folderId: null
  });
  const notebookResponse = await requestAs('/api/notebooks', userToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Rate test', sourceIds: [file.id] })
  });
  const notebook = (await notebookResponse.json()).notebook;
  const originalFetch = global.fetch;
  let geminiCalls = 0;
  process.env.GEMINI_API_KEY = 'test-key-never-log';
  global.fetch = async (input, options) => {
    if (!String(input).startsWith('https://generativelanguage.googleapis.com/')) return originalFetch(input, options);
    geminiCalls += 1;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Answer from the selected source.' }] } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const statuses = [];
    let retryAfter;
    for (let index = 0; index < 11; index += 1) {
      const response = await requestAs(`/api/notebooks/${notebook.id}/messages`, userToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: `Question ${index + 1}` })
      });
      statuses.push(response.status);
      retryAfter = response.headers.get('retry-after') || retryAfter;
    }

    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(201));
    assert.equal(statuses[10], 429);
    assert.ok(Number(retryAfter) > 0);
    assert.equal(geminiCalls, 10);
  } finally {
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }
});
