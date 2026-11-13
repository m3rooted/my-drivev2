import { canCreateShareLink, createDashboardActions, getDisplayedFileRole, getDriveNavigationTarget } from './dashboardActions';

describe('dashboard trash actions', () => {
  const createApis = () => ({
    filesAPI: {
      deleteFile: jest.fn().mockResolvedValue(undefined),
      restoreFile: jest.fn().mockResolvedValue(undefined),
      permanentlyDeleteFile: jest.fn().mockResolvedValue(undefined)
    },
    foldersAPI: {
      deleteFolder: jest.fn().mockResolvedValue(undefined),
      restoreFolder: jest.fn().mockResolvedValue(undefined),
      permanentlyDeleteFolder: jest.fn().mockResolvedValue(undefined)
    }
  });

  test('moves, restores, and permanently deletes files through the matching API routes', async () => {
    const apis = createApis();
    const actions = createDashboardActions(apis);
    const file = { id: 'file-1', itemType: 'file' };

    await actions.moveToTrash(file);
    await actions.restore(file);
    await actions.deletePermanently(file);

    expect(apis.filesAPI.deleteFile).toHaveBeenCalledWith('file-1');
    expect(apis.filesAPI.restoreFile).toHaveBeenCalledWith('file-1');
    expect(apis.filesAPI.permanentlyDeleteFile).toHaveBeenCalledWith('file-1');
    expect(apis.foldersAPI.deleteFolder).not.toHaveBeenCalled();
  });

  test('moves, restores, and permanently deletes folders through the matching API routes', async () => {
    const apis = createApis();
    const actions = createDashboardActions(apis);
    const folder = { id: 'folder-1', itemType: 'folder' };

    await actions.moveToTrash(folder);
    await actions.restore(folder);
    await actions.deletePermanently(folder);

    expect(apis.foldersAPI.deleteFolder).toHaveBeenCalledWith('folder-1');
    expect(apis.foldersAPI.restoreFolder).toHaveBeenCalledWith('folder-1');
    expect(apis.foldersAPI.permanentlyDeleteFolder).toHaveBeenCalledWith('folder-1');
    expect(apis.filesAPI.deleteFile).not.toHaveBeenCalled();
  });
});

describe('shared file dashboard behavior', () => {
  test('opens a shared starred file in Shared with me instead of its unavailable owner folder', () => {
    expect(getDriveNavigationTarget({ isShared: true, folderId: 'owner-folder' })).toEqual({
      driveScope: 'shared',
      currentFolder: null
    });
  });

  test('opens an owned starred file in its folder in My Drive', () => {
    expect(getDriveNavigationTarget({ isShared: false, folderId: 'my-folder' })).toEqual({
      driveScope: 'my-drive',
      currentFolder: 'my-folder'
    });
  });

  test('allows share-link creation only for owned files', () => {
    expect(canCreateShareLink({ isShared: false })).toBe(true);
    expect(canCreateShareLink({ isShared: true })).toBe(false);
  });

  test('shows the permission granted to the current user on shared files', () => {
    expect(getDisplayedFileRole({ id: 'shared-viewer', isShared: true, sharedPermission: 'viewer' }, {})).toBe('viewer');
    expect(getDisplayedFileRole({ id: 'shared-commenter', isShared: true, sharedPermission: 'commenter' }, {})).toBe('commenter');
    expect(getDisplayedFileRole({ id: 'shared-default', isShared: true }, {})).toBe('viewer');
  });
});
