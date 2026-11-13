const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const auth = require('../middleware/auth');
const FileModel = require('../models/File');
const UserModel = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { isRecord, isValidEmail, normalizeDisplayName, normalizeEmail } = require('../utils/validation');

const router = express.Router();

const serializeFile = (file, extra = {}) => ({
  id: file.id,
  originalName: file.originalName,
  mimetype: file.mimetype,
  size: file.size,
  folderId: file.folderId || null,
  favorite: false,
  recentAt: null,
  deletedAt: file.deletedAt || null,
  createdAt: file.createdAt,
  updatedAt: file.updatedAt,
  ...extra
});

const serializeFileForUser = (file, userId, extra = {}) => {
  const isShared = file.userId !== userId;
  const share = isShared
    ? (file.sharedWith || []).find((entry) => entry.userId === userId)
    : null;

  return serializeFile(file, {
    favorite: FileModel.isFavoriteForUser(file, userId),
    recentAt: FileModel.getRecentAtForUser(file, userId),
    isShared,
    sharedPermission: share?.permission || (isShared ? 'viewer' : null),
    ...extra
  });
};

const serializeFolder = (folder) => ({
  id: folder.id,
  name: folder.name,
  parentId: folder.parentId || null,
  favorite: Boolean(folder.favorite),
  createdAt: folder.createdAt,
  updatedAt: folder.updatedAt
});

router.get('/trash', auth, asyncHandler(async (req,res) => {
  const trash = await FileModel.getTrash(req.user.id);
  return res.json({
    files: trash.files.map((file) => ({ ...serializeFile(file), itemType: 'file' })),
    folders: trash.folders.map((folder) => ({ ...serializeFolder(folder), deletedAt: folder.deletedAt, itemType: 'folder' }))
  });
}));
router.post('/:id/restore', auth, asyncHandler(async (req,res) => {
  const restored = await FileModel.restoreFile(req.params.id, req.user.id);
  return res.status(restored ? 200 : 404).json({ restored });
}));
router.delete('/:id/permanent', auth, asyncHandler(async (req,res) => {
  const deleted = await FileModel.permanentlyDeleteFile(req.params.id, req.user.id);
  return res.status(deleted ? 200 : 404).json({ deleted });
}));
router.get('/recent', auth, (req, res) => {
  const files = FileModel.files
    .filter((file) => !file.deletedAt &&
      (file.userId === req.user.id || (file.sharedWith || []).some((share) => share.userId === req.user.id)) &&
      FileModel.getRecentAtForUser(file, req.user.id))
    .sort((a, b) => new Date(FileModel.getRecentAtForUser(b, req.user.id)) - new Date(FileModel.getRecentAtForUser(a, req.user.id)))
    .map((file) => serializeFileForUser(file, req.user.id));
  return res.json({ files });
});
router.get('/favorites', auth, asyncHandler(async (req, res) => {
  const favorites = await FileModel.getFavorites(req.user.id);
  return res.json({
    files: favorites.files.map((file) => serializeFileForUser(file, req.user.id)),
    folders: favorites.folders.map(serializeFolder)
  });
}));
router.get('/storage', auth, asyncHandler(async (req,res) => res.json(await FileModel.getStorage(req.user.id))));
router.get('/link/:token', asyncHandler(async (req,res) => { const f=await FileModel.getByShareToken(req.params.token); if(!f)return res.status(404).json({error:'Share link not found'}); res.setHeader('Cache-Control', 'no-store'); res.json({file:serializeFile(f),permission:f.linkPermission||'viewer'}); }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const originalName = normalizeDisplayName(file.originalname, 255);
    if (!originalName) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
    }
    file.originalname = originalName;
    cb(null, true);
  }
});

// Upload file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  let uploadedPath;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    uploadedPath = req.file.path;

    const folderId = req.body?.folderId || null;
    if (folderId !== null && (typeof folderId !== 'string' || !await FileModel.getFolderById(folderId, req.user.id))) {
      await fs.remove(req.file.path);
      return res.status(404).json({ error: 'Folder not found' });
    }

    const storageQuota = await FileModel.getStorage(req.user.id);
    if (req.file.size > storageQuota.available) {
      await fs.remove(req.file.path);
      return res.status(413).json({ error: 'Storage quota exceeded' });
    }

    const fileData = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      userId: req.user.id,
      folderId: folderId || null
    };

    const file = await FileModel.createFile(fileData);
    uploadedPath = null;

    res.status(201).json({
      message: 'File uploaded successfully',
      file: serializeFileForUser(file, req.user.id)
    });
  } catch (error) {
    if (uploadedPath) await fs.remove(uploadedPath).catch(() => undefined);
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get files and folders
router.get('/', auth, async (req, res) => {
  try {
    const { folderId } = req.query;
    
    const files = await FileModel.getFilesByUserId(req.user.id, folderId || null);
    const folders = await FileModel.getFoldersByUserId(req.user.id, folderId || null);

    res.json({
      files: files.map((file) => serializeFileForUser(file, req.user.id)),
      folders: folders.map(serializeFolder),
      currentFolder: folderId || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get files' });
  }
});

// Get files shared with current user
router.get('/shared', auth, async (req, res) => {
  try {
    const sharedFiles = await FileModel.getSharedFilesForUser(req.user.id);
    const mapped = sharedFiles.map((file) => {
      const share = (file.sharedWith || []).find((entry) => entry.userId === req.user.id);
      return {
        ...serializeFileForUser(file, req.user.id),
        sharedPermission: share?.permission || 'viewer'
      };
    });

    res.json({ files: mapped });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get shared files' });
  }
});

// Download file
router.get('/download/:id', auth, async (req, res) => {
  try {
    const file = await FileModel.getFileByIdForUser(req.params.id, req.user.id);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    await FileModel.markRecent(file.id, req.user.id);

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
    const filePath = path.resolve(uploadDir, path.basename(file.filename));
    if (!filePath.startsWith(`${uploadDir}${path.sep}`)) return res.status(404).json({ error: 'File not found' });
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'Physical file not found' });
    }

    res.attachment(file.originalName);
    res.type('application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download file' });
  }
});

router.get('/:id/preview', auth, asyncHandler(async (req, res) => {
  const file = await FileModel.getFileByIdForUser(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'File not found' });

  const filePath = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'), file.filename);
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
  if (!filePath.startsWith(`${uploadDir}${path.sep}`)) return res.status(404).json({ error: 'File not found' });
  if (!await fs.pathExists(filePath)) return res.status(404).json({ error: 'Physical file not found' });

  await FileModel.markRecent(file.id, req.user.id);
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.attachment(file.originalName);
  res.type('application/octet-stream');
  return res.sendFile(filePath);
}));
router.post('/:id/favorite', auth, asyncHandler(async (req, res) => {
  const file = await FileModel.toggleFavorite(req.params.id, req.user.id);
  return file
    ? res.json({ file: serializeFileForUser(file, req.user.id) })
    : res.status(404).json({ error: 'File not found' });
}));
router.post('/:id/recent', auth, asyncHandler(async (req, res) => {
  const file = await FileModel.markRecent(req.params.id, req.user.id);
  return file
    ? res.json({ file: serializeFileForUser(file, req.user.id) })
    : res.status(404).json({ error: 'File not found' });
}));
router.post('/:id/share-link', auth, asyncHandler(async (req, res) => {
  const permission = req.body?.permission || 'viewer';
  if (!['viewer', 'commenter', 'editor'].includes(permission)) {
    return res.status(400).json({ error: 'Invalid permission' });
  }

  const file = await FileModel.createShareLink(req.params.id, req.user.id, permission);
  if (!file) return res.status(404).json({ error: 'File not found' });

  const publicApiUrl = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}/api`).replace(/\/$/, '');
  return res.json({
    url: `${publicApiUrl}/files/link/${file.shareToken}/download`,
    token: file.shareToken,
    permission
  });
}));

router.get('/link/:token/download', asyncHandler(async (req, res) => {
  const file = await FileModel.getByShareToken(req.params.token);
  if (!file) return res.status(404).json({ error: 'Share link not found' });

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
  const filePath = path.resolve(uploadDir, path.basename(file.filename));
  if (!filePath.startsWith(`${uploadDir}${path.sep}`) || !await fs.pathExists(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.attachment(file.originalName);
  res.type('application/octet-stream');
  return res.sendFile(filePath);
}));
router.get('/:id/versions', auth, asyncHandler(async (req,res) => {const f=await FileModel.getFileById(req.params.id,req.user.id); return f?res.json({versions:f.versions||[]}):res.status(404).json({error:'File not found'});}));
router.post('/:id/versions', auth, asyncHandler(async (req,res) => {const v=await FileModel.saveVersion(req.params.id,req.user.id); return v?res.status(201).json({versions:v}):res.status(404).json({error:'File not found'});}));

// Share file with another user by email
router.post('/:id/share', auth, async (req, res) => {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const email = normalizeEmail(body.email);
    const permission = body.permission;
    const normalizedPermission = ['viewer','commenter','editor'].includes(permission) ? permission : 'viewer';

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    const targetUser = await UserModel.findByEmail(email);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'You already own this file' });
    }

    const sharedFile = await FileModel.shareFile(req.params.id, req.user.id, targetUser, normalizedPermission);
    if (!sharedFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      message: 'File shared successfully',
      file: serializeFileForUser(sharedFile, req.user.id)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to share file' });
  }
});

// Remove shared access for a user
router.delete('/:id/share/:sharedUserId', auth, async (req, res) => {
  try {
    const removed = await FileModel.removeShare(req.params.id, req.user.id, req.params.sharedUserId);

    if (removed === null) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (removed === false) {
      return res.status(404).json({ error: 'Share entry not found' });
    }

    res.json({ message: 'Shared access removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove share access' });
  }
});

// Delete file
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await FileModel.deleteFile(req.params.id, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Rename file
router.patch('/:id/rename', auth, async (req, res) => {
  try {
    const name = normalizeDisplayName(req.body?.name, 255);
    if (!name) {
      return res.status(400).json({ error: 'New name is required' });
    }

    const file = await FileModel.renameFileByAccess(req.params.id, req.user.id, name);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ message: 'File renamed successfully', file: serializeFileForUser(file, req.user.id) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

// Get file info
router.get('/:id', auth, async (req, res) => {
  try {
    const file = await FileModel.getFileByIdForUser(req.params.id, req.user.id);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ file: serializeFileForUser(file, req.user.id) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

module.exports = router;
