export const createDashboardActions = ({ filesAPI, foldersAPI }) => ({
  moveToTrash(item) {
    return item.itemType === 'folder'
      ? foldersAPI.deleteFolder(item.id)
      : filesAPI.deleteFile(item.id);
  },
  restore(item) {
    return item.itemType === 'folder'
      ? foldersAPI.restoreFolder(item.id)
      : filesAPI.restoreFile(item.id);
  },
  deletePermanently(item) {
    return item.itemType === 'folder'
      ? foldersAPI.permanentlyDeleteFolder(item.id)
      : filesAPI.permanentlyDeleteFile(item.id);
  }
});

export const getDriveNavigationTarget = (file) => file?.isShared
  ? { driveScope: 'shared', currentFolder: null }
  : { driveScope: 'my-drive', currentFolder: file?.folderId || null };

export const canCreateShareLink = (file) => Boolean(file && !file.isShared);

export const getDisplayedFileRole = (file, filePermissions = {}) => file?.isShared
  ? file.sharedPermission || 'viewer'
  : filePermissions[file?.id]?.role || 'editor';
