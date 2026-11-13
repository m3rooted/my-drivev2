const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const folderRoutes = require('./routes/folders');
const noteRoutes = require('./routes/notes');

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002'
];

const getAllowedOrigins = () => {
  const configured = process.env.CORS_ORIGINS;
  return configured
    ? configured.split(',').map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;
};

const createApp = () => {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  const corsOptions = {
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type']
  };

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    );
    next();
  });
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb', parameterLimit: 100 }));

  app.use('/api/auth', authRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/folders', folderRoutes);
  app.use('/api/notes', noteRoutes);

  app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'CloudNest API', health: '/api/health' });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'CloudNest API is running' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const isUploadLimitError = typeof error?.code === 'string' && error.code.startsWith('LIMIT_');
    const status = error?.code === 'LIMIT_FILE_SIZE'
      ? 413
      : isUploadLimitError
        ? 400
      : error?.status === 400 || error?.type === 'entity.too.large'
        ? (error.type === 'entity.too.large' ? 413 : 400)
        : 500;
    const message = status === 413 ? 'Request is too large' : status === 400 ? 'Invalid request' : 'Something went wrong';
    if (status === 500) console.error('Unhandled request error:', error);
    res.status(status).json({ error: message });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  return app;
};

module.exports = createApp;
