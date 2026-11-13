const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const { persistState } = require('../storage/persistence');
const { stageFilesForPermanentDelete } = require('../services/pendingFileDeletes');

const getUploadDirectory = () => path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads')
);

const getSafeUploadPath = (filename) => {
  if (typeof filename !== 'string' || !filename) return null;
  const uploadDirectory = getUploadDirectory();
  const filePath = path.resolve(uploadDirectory, path.basename(filename));
  return filePath.startsWith(`${uploadDirectory}${path.sep}`) ? filePath : null;
};

const collectFolderIds = (folders, userId, rootId) => {
  const folderIds = new Set([rootId]);
  const pending = [rootId];

  while (pending.length > 0) {
    const parentId = pending.pop();
    for (const folder of folders) {
      if (folder.userId === userId && folder.parentId === parentId && !folderIds.has(folder.id)) {
        folderIds.add(folder.id);
        pending.push(folder.id);
      }
    }
  }

  return folderIds;
};

class File {
  constructor() {
    this.files = [];
    this.folders = [];
  }

  async createFile(fileData) {
    const file = {
      id: uuidv4(),
      ...fileData,
      sharedWith: [],
      versions: [],
      favorite: false,
      recentAt: null,
      favoritedBy: [],
      recentByUser: {},
      deletedAt: null,
      shareToken: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.files.push(file);
    await persistState();
    return file;
  }

  async createFolder(folderData) {
    const folder = {
      id: uuidv4(),
      ...folderData,
      type: 'folder',
      favorite: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.folders.push(folder);
    await persistState();
    return folder;
  }

  async getFilesByUserId(userId, folderId = null) {
    return this.files.filter(file =>
      file.userId === userId && !file.deletedAt && file.folderId === folderId
    );
  }

  async getFoldersByUserId(userId, parentId = null) {
    return this.folders.filter(folder =>
      folder.userId === userId && !folder.deletedAt && folder.parentId === parentId
    );
  }

  async getFileById(id, userId) {
    return this.files.find(file => file.id === id && file.userId === userId && !file.deletedAt);
  }

  async getFileByIdForUser(id, userId) {
    return this.files.find((file) => {
      if (file.id !== id || file.deletedAt) {
        return false;
      }

      if (file.userId === userId) {
        return true;
      }

      return (file.sharedWith || []).some((share) => share.userId === userId);
    });
  }

  async getSharedFilesForUser(userId) {
    return this.files.filter((file) =>
      !file.deletedAt && (file.sharedWith || []).some((share) => share.userId === userId)
    );
  }

  async getShareEntry(file, userId) {
    return (file.sharedWith || []).find((share) => share.userId === userId) || null;
  }

  async shareFile(id, ownerId, shareUser, permission) {
    const file = await this.getFileById(id, ownerId);
    if (!file) {
      return null;
    }

    const existingShare = (file.sharedWith || []).find((share) => share.userId === shareUser.id);
    if (existingShare) {
      existingShare.permission = permission;
      existingShare.email = shareUser.email;
      existingShare.updatedAt = new Date();
    } else {
      file.sharedWith.push({
        userId: shareUser.id,
        email: shareUser.email,
        permission,
        sharedAt: new Date(),
        updatedAt: new Date()
      });
    }

    file.updatedAt = new Date();
    await persistState();
    return file;
  }

  async removeShare(id, ownerId, sharedUserId) {
    const file = await this.getFileById(id, ownerId);
    if (!file) {
      return null;
    }

    const previousLength = file.sharedWith.length;
    file.sharedWith = file.sharedWith.filter((share) => share.userId !== sharedUserId);

    if (file.sharedWith.length === previousLength) {
      return false;
    }

    file.updatedAt = new Date();
    await persistState();
    return true;
  }

  async canEditFile(id, userId) {
    const file = await this.getFileByIdForUser(id, userId);
    if (!file) {
      return false;
    }

    if (file.userId === userId) {
      return true;
    }

    const share = await this.getShareEntry(file, userId);
    return share?.permission === 'editor';
  }

  async getFolderById(id, userId) {
    return this.folders.find(folder => folder.id === id && folder.userId === userId && !folder.deletedAt);
  }

  async deleteFile(id, userId) {
    const file = this.files.find(file => file.id === id && file.userId === userId && !file.deletedAt);
    if (file) {
      file.deletedAt = new Date();
      await persistState();
      return true;
    }
    return false;
  }

  async getTrash(userId) {
    const trashedFolderIds = new Set(this.folders
      .filter((folder) => folder.userId === userId && folder.deletedAt)
      .map((folder) => folder.id));
    return {
      files: this.files.filter((file) => file.userId === userId && file.deletedAt && !trashedFolderIds.has(file.folderId)),
      folders: this.folders.filter((folder) => folder.userId === userId && folder.deletedAt && !trashedFolderIds.has(folder.parentId))
    };
  }

  async restoreFile(id, userId) {
    const file = this.files.find((entry) => entry.id === id && entry.userId === userId && entry.deletedAt);
    if (!file) return false;
    file.deletedAt = null;
    file.updatedAt = new Date();
    await persistState();
    return true;
  }

  async permanentlyDeleteFile(id, userId) {
    const file = this.files.find((entry) => entry.id === id && entry.userId === userId && entry.deletedAt);
    if (!file) return false;
    const filePath = getSafeUploadPath(file.filename);
    if (!filePath) return false;
    await fs.remove(filePath);
    const currentIndex = this.files.findIndex((entry) => entry.id === id && entry.userId === userId && entry.deletedAt);
    if (currentIndex < 0) return false;
    this.files.splice(currentIndex, 1);
    await persistState();
    return true;
  }

  async permanentlyDeleteFolder(id, userId) {
    const root = this.folders.find((folder) => folder.id === id && folder.userId === userId && folder.deletedAt);
    if (!root) return false;

    const folderIds = collectFolderIds(this.folders, userId, root.id);

    const files = this.files.filter((file) => file.userId === userId && folderIds.has(file.folderId));
    const stagedDelete = await stageFilesForPermanentDelete(files, getUploadDirectory());
    try {
      this.files = this.files.filter((file) => !(file.userId === userId && folderIds.has(file.folderId)));
      this.folders = this.folders.filter((folder) => !(folder.userId === userId && folderIds.has(folder.id)));
      await persistState();
    } catch (error) {
      await stagedDelete.rollback().catch((rollbackError) => {
        console.error('Failed to restore files after permanent folder delete failed:', rollbackError.message);
      });
      throw error;
    }
    await stagedDelete.finalize().catch((error) => {
      console.error('Could not clean staged files after permanent folder delete:', error.message);
    });
    return true;
  }

  async toggleFavorite(id, userId) {
    const file = await this.getFileByIdForUser(id, userId);
    if (!file) return null;
    file.favoritedBy ||= file.favorite && file.userId === userId ? [userId] : [];
    if (file.favoritedBy.includes(userId)) {
      file.favoritedBy = file.favoritedBy.filter((favoritedBy) => favoritedBy !== userId);
    } else {
      file.favoritedBy.push(userId);
    }
    file.favorite = file.favoritedBy.includes(file.userId);
    await persistState();
    return file;
  }

  isFavoriteForUser(file, userId) {
    if (Array.isArray(file.favoritedBy)) return file.favoritedBy.includes(userId);
    return file.userId === userId && Boolean(file.favorite);
  }

  getRecentAtForUser(file, userId) {
    return file.recentByUser?.[userId] || (file.userId === userId ? file.recentAt : null) || null;
  }

  async getFavorites(userId) {
    return {
      files: this.files.filter((file) =>
        !file.deletedAt &&
        (file.userId === userId || (file.sharedWith || []).some((share) => share.userId === userId)) &&
        this.isFavoriteForUser(file, userId)
      ),
      folders: this.folders.filter((folder) => folder.userId === userId && folder.favorite && !folder.deletedAt)
    };
  }

  async toggleFolderFavorite(id, userId) {
    const folder = await this.getFolderById(id, userId);
    if (!folder) return null;
    folder.favorite = !folder.favorite;
    folder.updatedAt = new Date();
    await persistState();
    return folder;
  }

  async markRecent(id, userId) {
    const file = await this.getFileByIdForUser(id, userId);
    if (file) {
      const recentAt = new Date();
      file.recentByUser ||= {};
      file.recentByUser[userId] = recentAt;
      if (file.userId === userId) file.recentAt = recentAt;
      await persistState();
    }
    return file;
  }

  async createShareLink(id, userId, permission = 'viewer') {
    const file = await this.getFileById(id, userId);
    if (!file) return null;
    file.shareToken ||= uuidv4();
    file.linkPermission = permission;
    await persistState();
    return file;
  }

  async getByShareToken(token) {
    return this.files.find((file) => file.shareToken === token && !file.deletedAt) || null;
  }

  async saveVersion(id, userId) {
    const file = await this.getFileById(id, userId);
    if (!file) return null;
    file.versions ||= [];
    file.versions.push({
      filename: file.filename,
      originalName: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
      createdAt: new Date()
    });
    await persistState();
    return file.versions;
  }

  async getStorage(userId) {
    const files = this.files.filter((file) => file.userId === userId);
    const used = files.reduce((total, file) => total + (file.size || 0), 0);
    const quota = Number(process.env.STORAGE_QUOTA_BYTES) || 15 * 1024 * 1024 * 1024;
    return { used, quota, available: Math.max(0, quota - used) };
  }

  async deleteFolder(id, userId) {
    const root = this.folders.find((folder) => folder.id === id && folder.userId === userId && !folder.deletedAt);
    if (!root) return false;

    const folderIds = collectFolderIds(this.folders, userId, root.id);

    const deletedAt = new Date();
    for (const folder of this.folders) {
      if (folderIds.has(folder.id) && !folder.deletedAt) folder.deletedAt = deletedAt;
    }
    for (const file of this.files) {
      if (file.userId === userId && folderIds.has(file.folderId) && !file.deletedAt) file.deletedAt = deletedAt;
    }
    await persistState();
    return true;
  }

  async restoreFolder(id, userId) {
    const root = this.folders.find((folder) => folder.id === id && folder.userId === userId && folder.deletedAt);
    if (!root) return false;
    const deletedAt = new Date(root.deletedAt).getTime();
    const folderIds = collectFolderIds(this.folders, userId, root.id);
    for (const folder of this.folders) {
        if (folderIds.has(folder.id) && new Date(folder.deletedAt).getTime() === deletedAt) folder.deletedAt = null;
    }
    for (const file of this.files) {
      if (file.userId === userId && folderIds.has(file.folderId) && new Date(file.deletedAt).getTime() === deletedAt) file.deletedAt = null;
    }
    await persistState();
    return true;
  }

  async renameFile(id, userId, newName) {
    const file = this.files.find(file => file.id === id && file.userId === userId && !file.deletedAt);
    if (file) {
      file.originalName = newName;
      file.updatedAt = new Date();
      await persistState();
      return file;
    }
    return null;
  }

  async renameFileByAccess(id, userId, newName) {
    const editable = await this.canEditFile(id, userId);
    if (!editable) {
      return null;
    }

    const file = await this.getFileByIdForUser(id, userId);
    if (!file) {
      return null;
    }

    file.originalName = newName;
    file.updatedAt = new Date();
    await persistState();
    return file;
  }

  async renameFolder(id, userId, newName) {
    const folder = this.folders.find(folder => folder.id === id && folder.userId === userId && !folder.deletedAt);
    if (folder) {
      folder.name = newName;
      folder.updatedAt = new Date();
      await persistState();
      return folder;
    }
    return null;
  }
}

module.exports = new File();
