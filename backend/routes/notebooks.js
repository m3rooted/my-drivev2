const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const auth = require('../middleware/auth');
const FileModel = require('../models/File');
const NotebookModel = require('../models/Notebook');
const asyncHandler = require('../utils/asyncHandler');
const { normalizeDisplayName } = require('../utils/validation');
const { consumeNotebookChatRequest } = require('../services/notebookChatRateLimit');
const {
  MAX_NOTEBOOK_HISTORY_MESSAGES,
  MAX_NOTEBOOK_QUESTION_LENGTH,
  MAX_NOTEBOOK_SOURCE_BYTES,
  MAX_NOTEBOOK_SOURCES,
  MAX_NOTEBOOK_TEXT_BYTES,
  getNotebookSourceType,
  requestGeminiAnswer
} = require('../services/geminiNotebookChat');

const router = express.Router();
const getUploadDirectory = () => path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));

const safeUploadPath = (filename) => {
  if (typeof filename !== 'string' || !filename) return null;
  const uploadDirectory = getUploadDirectory();
  const filePath = path.resolve(uploadDirectory, path.basename(filename));
  return filePath.startsWith(`${uploadDirectory}${path.sep}`) ? filePath : null;
};

const serializeSource = (file) => ({
  id: file.id,
  originalName: file.originalName,
  mimetype: getNotebookSourceType(file.originalName).mimeType,
  size: file.size,
  folderId: file.folderId || null
});

const serializeNotebook = (notebook) => ({
  id: notebook.id,
  title: notebook.title,
  sources: notebook.sources,
  messages: notebook.messages,
  createdAt: notebook.createdAt,
  updatedAt: notebook.updatedAt
});

const listAccessibleSourceFiles = (userId) => FileModel.files.filter((file) =>
  !file.deletedAt &&
  (file.userId === userId || (file.sharedWith || []).some((share) => share.userId === userId)) &&
  getNotebookSourceType(file.originalName) &&
  Number(file.size) <= MAX_NOTEBOOK_SOURCE_BYTES
);

const resolveNotebookSources = async (sourceIds, userId) => {
  if (!Array.isArray(sourceIds) || sourceIds.length < 1 || sourceIds.length > MAX_NOTEBOOK_SOURCES) {
    const error = new Error(`Choose between 1 and ${MAX_NOTEBOOK_SOURCES} supported files`);
    error.status = 400;
    throw error;
  }
  if (sourceIds.some((id) => typeof id !== 'string' || !id) || new Set(sourceIds).size !== sourceIds.length) {
    const error = new Error('Notebook sources are invalid');
    error.status = 400;
    throw error;
  }

  const sources = [];
  let totalBytes = 0;
  let totalTextBytes = 0;
  for (const id of sourceIds) {
    const file = await FileModel.getFileByIdForUser(id, userId);
    const sourceType = file && !file.deletedAt && getNotebookSourceType(file.originalName);
    const filePath = file && safeUploadPath(file.filename);
    if (!file || !sourceType || !filePath) {
      const error = new Error('A selected source is missing or not supported');
      error.status = 404;
      throw error;
    }

    let metadata;
    try {
      metadata = await fs.lstat(filePath);
    } catch {
      const error = new Error('A selected source is no longer available');
      error.status = 404;
      throw error;
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      const error = new Error('A selected source is not a regular file');
      error.status = 400;
      throw error;
    }

    totalBytes += metadata.size;
    if (sourceType.kind === 'text') totalTextBytes += metadata.size;
    if (totalBytes > MAX_NOTEBOOK_SOURCE_BYTES || totalTextBytes > MAX_NOTEBOOK_TEXT_BYTES) {
      const error = new Error('Selected sources exceed the notebook size limit');
      error.status = 413;
      throw error;
    }

    sources.push({ file, filePath, ...sourceType, size: metadata.size });
  }

  return sources;
};

const loadSourceContents = async (sources) => {
  const loaded = [];
  for (const source of sources) {
    const bytes = await fs.readFile(source.filePath);
    if (bytes.length !== source.size) {
      const error = new Error('A selected source changed while preparing the request');
      error.status = 409;
      throw error;
    }
    if (source.kind === 'pdf' && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      const error = new Error(`${source.file.originalName} is not a valid PDF`);
      error.status = 400;
      throw error;
    }
    if (source.kind === 'text' && bytes.includes(0)) {
      const error = new Error(`${source.file.originalName} is not a valid text file`);
      error.status = 400;
      throw error;
    }
    loaded.push({
      originalName: source.file.originalName,
      mimeType: source.mimeType,
      kind: source.kind,
      bytes,
      text: source.kind === 'text' ? bytes.toString('utf8') : undefined
    });
  }
  return loaded;
};

router.use(auth);

router.get('/sources', asyncHandler(async (req, res) => {
  const sources = await Promise.all(listAccessibleSourceFiles(req.user.id).map(async (file) => {
    const filePath = safeUploadPath(file.filename);
    if (!filePath) return null;
    try {
      const metadata = await fs.lstat(filePath);
      return metadata.isFile() && !metadata.isSymbolicLink() ? serializeSource(file) : null;
    } catch {
      return null;
    }
  }));
  return res.json({ sources: sources.filter(Boolean) });
}));

router.get('/status', (req, res) => res.json({ aiConfigured: Boolean(process.env.GEMINI_API_KEY) }));

router.get('/', asyncHandler(async (req, res) => {
  const notebooks = await NotebookModel.getNotebooksByUserId(req.user.id);
  return res.json({ notebooks: notebooks.map(serializeNotebook) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const title = normalizeDisplayName(req.body?.title, 100);
  if (!title) return res.status(400).json({ error: 'A notebook title is required' });

  const sourceFiles = await resolveNotebookSources(req.body?.sourceIds, req.user.id);
  const notebook = await NotebookModel.createNotebook({
    userId: req.user.id,
    title,
    sources: sourceFiles.map(({ file }) => serializeSource(file))
  });
  return res.status(201).json({ notebook: serializeNotebook(notebook) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const notebook = await NotebookModel.getNotebookById(req.params.id, req.user.id);
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
  return res.json({ notebook: serializeNotebook(notebook) });
}));

router.post('/:id/messages', asyncHandler(async (req, res) => {
  const notebook = await NotebookModel.getNotebookById(req.params.id, req.user.id);
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question || question.length > MAX_NOTEBOOK_QUESTION_LENGTH) {
    return res.status(400).json({ error: `Enter a question of up to ${MAX_NOTEBOOK_QUESTION_LENGTH} characters` });
  }

  const rateLimit = consumeNotebookChatRequest(req.user.id);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res.status(429).json({ error: 'Notebook Chat is temporarily rate limited. Try again after the indicated delay.' });
  }

  const sources = await resolveNotebookSources(notebook.sources.map((source) => source.id), req.user.id);
  const loadedSources = await loadSourceContents(sources);
  let answer;
  try {
    answer = await requestGeminiAnswer({
      messages: notebook.messages.slice(-MAX_NOTEBOOK_HISTORY_MESSAGES),
      question,
      sources: loadedSources
    });
  } catch (error) {
    const timedOut = error.name === 'TimeoutError';
    const status = timedOut ? 504 : [429, 502, 503].includes(error.status) ? error.status : 502;
    const message = timedOut
      ? 'Gemini took longer than 3 minutes to answer. You can retry your question.'
      : error.message || 'Gemini could not answer this question';
    return res.status(status).json({ error: message });
  }
  const turn = await NotebookModel.addConversationTurn(notebook.id, req.user.id, question, answer);
  if (!turn) return res.status(404).json({ error: 'Notebook not found' });

  return res.status(201).json({ message: turn.assistantMessage, sources: turn.notebook.sources });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await NotebookModel.deleteNotebook(req.params.id, req.user.id);
  return deleted
    ? res.json({ deleted: true })
    : res.status(404).json({ error: 'Notebook not found' });
}));

module.exports = router;
