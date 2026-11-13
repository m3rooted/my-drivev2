const path = require('path');
const fs = require('fs-extra');
const { isIP } = require('node:net');
require('dotenv').config();

const { validateProductionConfig } = require('./utils/runtimeConfig');

const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const isLoopbackHost = HOST === '::1' || (isIP(HOST) === 4 && HOST.startsWith('127.'));

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (!isLoopbackHost) {
    throw new Error('JWT_SECRET must be set when binding to a non-loopback host');
  }
  process.env.JWT_SECRET = 'local-development-secret-change-before-deploying';
  console.warn('JWT_SECRET is not set; using a development-only secret.');
}

if (Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
  throw new Error('JWT_SECRET must contain at least 32 bytes');
}

if (process.env.NODE_ENV === 'production' && /replace-with|local-development/i.test(process.env.JWT_SECRET)) {
  throw new Error('Replace the example JWT_SECRET before starting in production');
}

validateProductionConfig(process.env);

const createApp = require('./app');
const UserModel = require('./models/User');
const FileModel = require('./models/File');
const NoteModel = require('./models/Note');
const notesRouter = require('./routes/notes');
const { initializePersistence } = require('./storage/persistence');
const { recoverPendingFileDeletes } = require('./services/pendingFileDeletes');

const PORT = Number(process.env.PORT) || 5000;
const uploadsDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'));

const startServer = async () => {
  await fs.ensureDir(uploadsDir);
  await initializePersistence({ User: UserModel, FileModel, NoteModel });
  await recoverPendingFileDeletes(FileModel.files, uploadsDir);
  await notesRouter.initializeReminders();

  const server = createApp().listen(PORT, HOST, () => {
    console.log(`Server is running at http://${HOST}:${PORT}`);
  });
  return server;
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start CloudNest API:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
