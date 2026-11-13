const express = require('express');
const auth = require('../middleware/auth');
const FileModel = require('../models/File');
const asyncHandler = require('../utils/asyncHandler');
const { isRecord, normalizeDisplayName } = require('../utils/validation');

const router = express.Router();

const serializeFolder = (folder) => ({
  id: folder.id,
  name: folder.name,
  parentId: folder.parentId || null,
  favorite: Boolean(folder.favorite),
  createdAt: folder.createdAt,
  updatedAt: folder.updatedAt
});

const serializeFile = (file) => ({
  id: file.id,
  originalName: file.originalName,
  mimetype: file.mimetype,
  size: file.size,
  folderId: file.folderId || null,
  favorite: Boolean(file.favorite),
  recentAt: file.recentAt || null,
  createdAt: file.createdAt,
  updatedAt: file.updatedAt
});

// Create folder
router.post('/', auth, async (req, res) => {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const name = normalizeDisplayName(body.name, 100);
    const parentId = body.parentId || null;

    if (!name || (parentId !== null && typeof parentId !== 'string')) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    if (parentId && !await FileModel.getFolderById(parentId, req.user.id)) {
      return res.status(404).json({ error: 'Parent folder not found' });
    }

    const folderData = {
      name,
      parentId: parentId || null,
      userId: req.user.id
    };

    const folder = await FileModel.createFolder(folderData);

    res.status(201).json({
      message: 'Folder created successfully',
      folder: serializeFolder(folder)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Get folder contents
router.get('/:id', auth, async (req, res) => {
  try {
    const folderId = req.params.id;
    
    const folder = await FileModel.getFolderById(folderId, req.user.id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const files = await FileModel.getFilesByUserId(req.user.id, folderId);
    const subfolders = await FileModel.getFoldersByUserId(req.user.id, folderId);

    res.json({
      folder: serializeFolder(folder),
      files: files.map(serializeFile),
      folders: subfolders.map(serializeFolder)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get folder contents' });
  }
});

router.post('/:id/restore', auth, asyncHandler(async (req, res) => {
  const restored = await FileModel.restoreFolder(req.params.id, req.user.id);
  return res.status(restored ? 200 : 404).json({ restored });
}));

router.delete('/:id/permanent', auth, asyncHandler(async (req, res) => {
  const deleted = await FileModel.permanentlyDeleteFolder(req.params.id, req.user.id);
  return res.status(deleted ? 200 : 404).json({ deleted });
}));

router.post('/:id/favorite', auth, asyncHandler(async (req, res) => {
  const folder = await FileModel.toggleFolderFavorite(req.params.id, req.user.id);
  return folder ? res.json({ folder: serializeFolder(folder) }) : res.status(404).json({ error: 'Folder not found' });
}));

// Delete folder
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await FileModel.deleteFolder(req.params.id, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Rename folder
router.patch('/:id/rename', auth, async (req, res) => {
  try {
    const name = normalizeDisplayName(req.body?.name, 100);
    if (!name) {
      return res.status(400).json({ error: 'New name is required' });
    }

    const folder = await FileModel.renameFolder(req.params.id, req.user.id, name);
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ message: 'Folder renamed successfully', folder: serializeFolder(folder) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

module.exports = router;
