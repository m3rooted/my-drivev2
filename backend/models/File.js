const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');

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
      deletedAt: null,
      shareToken: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.files.push(file);
    return file;
  }

  async createFolder(folderData) {
    const folder = {
      id: uuidv4(),
      ...folderData,
      type: 'folder',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.folders.push(folder);
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
    return this.files.find(file => file.id === id && file.userId === userId);
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
      (file.sharedWith || []).some((share) => share.userId === userId)
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
    return this.folders.find(folder => folder.id === id && folder.userId === userId);
  }

  async deleteFile(id, userId) {
    const file = this.files.find(file => file.id === id && file.userId === userId && !file.deletedAt);
    if (file) {
      file.deletedAt = new Date();
      return true;
    }
    return false;
  }

  async getTrash(userId) { return { files: this.files.filter(f => f.userId === userId && f.deletedAt), folders: this.folders.filter(f => f.userId === userId && f.deletedAt) }; }
  async restoreFile(id, userId) { const f = this.files.find(f => f.id === id && f.userId === userId && f.deletedAt); if (!f) return false; f.deletedAt = null; return true; }
  async permanentlyDeleteFile(id, userId) { const i = this.files.findIndex(f => f.id === id && f.userId === userId && f.deletedAt); if (i < 0) return false; const f = this.files[i]; await fs.remove(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', f.filename)); this.files.splice(i, 1); return true; }
  async toggleFavorite(id, userId) { const f = await this.getFileById(id,userId); if (!f) return null; f.favorite = !f.favorite; return f; }
  async markRecent(id,userId) { const f = await this.getFileByIdForUser(id,userId); if (f) f.recentAt = new Date(); return f; }
  async createShareLink(id,userId,permission='viewer') { const f = await this.getFileById(id,userId); if (!f) return null; f.shareToken ||= uuidv4(); f.linkPermission = permission; return f; }
  async getByShareToken(token) { return this.files.find(f => f.shareToken === token && !f.deletedAt) || null; }
  async saveVersion(id,userId) { const f = await this.getFileById(id,userId); if (!f) return null; f.versions ||= []; f.versions.push({ filename:f.filename, originalName:f.originalName, size:f.size, mimetype:f.mimetype, createdAt:new Date() }); return f.versions; }
  async getStorage(userId) { const files=this.files.filter(f=>f.userId===userId&&!f.deletedAt); const used=files.reduce((n,f)=>n+(f.size||0),0); const quota=Number(process.env.STORAGE_QUOTA_BYTES)||15*1024*1024*1024; return {used,quota,available:Math.max(0,quota-used)}; }

  async deleteFolder(id, userId) {
    const folderIndex = this.folders.findIndex(folder => folder.id === id && folder.userId === userId);
    if (folderIndex > -1) {
      // TODO: Add recursive deletion of contents
      this.folders.splice(folderIndex, 1);
      return true;
    }
    return false;
  }

  async renameFile(id, userId, newName) {
    const file = this.files.find(file => file.id === id && file.userId === userId);
    if (file) {
      file.originalName = newName;
      file.updatedAt = new Date();
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
    return file;
  }

  async renameFolder(id, userId, newName) {
    const folder = this.folders.find(folder => folder.id === id && folder.userId === userId);
    if (folder) {
      folder.name = newName;
      folder.updatedAt = new Date();
      return folder;
    }
    return null;
  }
}

module.exports = new File();
