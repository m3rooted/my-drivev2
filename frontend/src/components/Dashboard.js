import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { filesAPI, foldersAPI } from '../services/api';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { extractDocxText } from '../services/docxPreview';
import {
  HardDrive,
  LogOut,
  FolderPlus,
  File,
  Folder,
  Download,
  Trash2,
  Search,
  Grid,
  List,
  Share2,
  Users,
  Sun,
  Moon,
  RotateCcw,
  Sparkles,
  Cloud,
  FileText,
  ChevronRight,
  MoreVertical,
  Info,
  X,
  Plus,
  Star,
  Clock,
  Shield,
  Eye
} from 'lucide-react';
import NotesPlanner from './NotesPlanner';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [trashFiles, setTrashFiles] = useState([]);
  
  // --- STATE YÊU THÍCH (STARRED) ---
  const [starredIds, setStarredIds] = useState([]);
  const [starredFiles, setStarredFiles] = useState([]);
  const [starredFolders, setStarredFolders] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [storageStats, setStorageStats] = useState({ used: 0, quota: 15 * 1024 * 1024 * 1024 });
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState(false);

  // --- STATE FILE GẦN ĐÂY (RECENT FILES) ---
  // --- STATE PHÂN QUYỀN TRUY CẬP (PERMISSIONS) ---
  const [filePermissions, setFilePermissions] = useState(() => {
    try {
      const saved = localStorage.getItem('drive_file_permissions');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // --- STATE XEM TRƯỚC TỆP (PREVIEW) ---
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!previewContent.startsWith('blob:')) return undefined;
    const previewUrl = previewContent;
    return () => window.URL.revokeObjectURL(previewUrl);
  }, [previewContent]);

  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeTab, setActiveTab] = useState('drive'); // 'drive' | 'starred' | 'recent' | 'notes' | 'trash' | 'shared'
  const [driveScope, setDriveScope] = useState('my-drive');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFileToShare, setSelectedFileToShare] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('viewer');
  const [sharing, setSharing] = useState(false);

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedItemForInfo, setSelectedItemForInfo] = useState(null);

  // --- ĐÓNG MENU 3 CHẤM KHI BẤM RA NGOÀI KHOẢNG TRẮNG ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeMenuId !== null && !event.target.closest('.relative')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenuId]);

  // Lưu starredIds vào localStorage
  // Favorite state is loaded from the durable API.

  // Lưu recentFileIds vào localStorage
  // Recent state is loaded from the durable API.

  // Lưu filePermissions vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('drive_file_permissions', JSON.stringify(filePermissions));
    } catch (e) {}
  }, [filePermissions]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      if (driveScope === 'shared' || activeTab === 'shared') {
        const response = await filesAPI.getSharedFiles();
        setFiles(response.data.files || []);
        setFolders([]);
      } else {
        const response = await filesAPI.getFiles(currentFolder);
        setFiles(response.data.files || []);
        setFolders(response.data.folders || []);
      }
    } catch (error) {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [currentFolder, driveScope, activeTab]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const loadStorageStats = useCallback(async () => {
    try {
      const response = await filesAPI.getStorage();
      setStorageStats(response.data);
    } catch {
      toast.error('Failed to load storage usage');
    }
  }, []);

  useEffect(() => {
    loadStorageStats();
  }, [loadStorageStats]);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    setTrashError(false);
    try {
      const response = await filesAPI.getTrash();
      setTrashFiles([...(response.data.files || []), ...(response.data.folders || [])]);
    } catch {
      setTrashError(true);
      toast.error('Failed to load trash');
    } finally {
      setTrashLoading(false);
    }
  }, []);

  const loadRecentFiles = useCallback(async () => {
    try {
      const response = await filesAPI.getRecent();
      setRecentFiles(response.data.files || []);
    } catch {
      toast.error('Failed to load recent files');
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const response = await filesAPI.getFavorites();
      const nextFiles = response.data.files || [];
      const nextFolders = response.data.folders || [];
      setStarredFiles(nextFiles);
      setStarredFolders(nextFolders);
      setStarredIds([...nextFiles, ...nextFolders].map((item) => item.id));
    } catch {
      toast.error('Failed to load favorites');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'trash') loadTrash();
    if (activeTab === 'recent') loadRecentFiles();
    if (activeTab === 'starred') loadFavorites();
  }, [activeTab, loadTrash, loadRecentFiles, loadFavorites]);

  const onDrop = async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      if (currentFolder) formData.append('folderId', currentFolder);

      try {
        await filesAPI.uploadFile(formData);
        toast.success(`${file.name} uploaded successfully`);
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    loadFiles();
    loadStorageStats();
  };

  const { getRootProps, getInputProps, open } = useDropzone({ onDrop, multiple: true, noClick: true, noKeyboard: true });

  // --- GHI NHẬN FILE VỪA TRUY CẬP (RECENT) ---
  const trackRecentFile = async (fileId) => {
    try {
      await filesAPI.markRecent(fileId);
      await loadRecentFiles();
    } catch {
      // The file can disappear while a menu is open.
    }
  };

  // --- HÀM XEM TRƯỚC TỆP (PREVIEW) ---
  const handlePreviewFile = async (file) => {
    setPreviewFile(file);
    setPreviewLoading(true);
    setPreviewContent('');
    trackRecentFile(file.id);
    setActiveMenuId(null);

    try {
      const response = await filesAPI.downloadFile(file.id);
      const blob = new Blob([response.data], { type: file.mimetype });
      if (file.originalName.endsWith('.docx') || file.mimetype?.includes('word')) {
        const arrayBuffer = await blob.arrayBuffer();
        setPreviewContent(await extractDocxText(arrayBuffer));
      } else {
        setPreviewContent(window.URL.createObjectURL(blob));
      }
    } catch (error) {
      toast.error('Không thể tải nội dung xem trước');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (file) => {
    trackRecentFile(file.id);
    try {
      const response = await filesAPI.downloadFile(file.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const toggleStar = async (e, id, itemType = 'file') => {
    e.stopPropagation();
    try {
      const response = itemType === 'folder'
        ? await foldersAPI.toggleFavorite(id)
        : await filesAPI.toggleFavorite(id);
      const item = response.data.folder || response.data.file;
      setStarredIds((previous) => item.favorite
        ? [...new Set([...previous, id])]
        : previous.filter((starredId) => starredId !== id));
      await loadFavorites();
      toast.success(item.favorite ? 'Added to starred' : 'Removed from starred');
    } catch {
      toast.error('Failed to update favorite');
    }
  };

  const handleMoveToTrash = async (item, type = 'file') => {
    try {
      if (type === 'file') await filesAPI.deleteFile(item.id);
      else await foldersAPI.deleteFolder(item.id);
      setActiveMenuId(null);
      if (selectedItemForInfo?.id === item.id) setSelectedItemForInfo(null);
      await Promise.all([loadFiles(), loadTrash(), loadFavorites(), loadRecentFiles(), loadStorageStats()]);
      toast.success('Moved to trash');
    } catch {
      toast.error('Could not move item to trash');
    }
  };

  const handleRestoreFromTrash = async (item) => {
    try {
      if (item.itemType === 'file') await filesAPI.restoreFile(item.id);
      else await foldersAPI.restoreFolder(item.id);
      await Promise.all([loadTrash(), loadFiles(), loadStorageStats()]);
      toast.success(`Restored "${item.originalName || item.name}"`);
    } catch {
      toast.error('Could not restore item');
    }
  };

  const handleDeletePermanently = async (item) => {
    if (!window.confirm(`Permanently delete "${item.originalName || item.name}"?`)) return;
    try {
      if (item.itemType === 'file') await filesAPI.permanentlyDeleteFile(item.id);
      else await foldersAPI.permanentlyDeleteFolder(item.id);
      await Promise.all([loadTrash(), loadFiles(), loadStorageStats()]);
      toast.success('Permanently deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Empty trash completely?')) return;
    const results = await Promise.allSettled(trashFiles.map((item) => item.itemType === 'file'
      ? filesAPI.permanentlyDeleteFile(item.id)
      : foldersAPI.permanentlyDeleteFolder(item.id)));
    await Promise.all([loadTrash(), loadFiles(), loadStorageStats()]);
    if (results.every((result) => result.status === 'fulfilled')) toast.success('Trash emptied');
    else toast.error('Some trash items could not be deleted');
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }
    try {
      await foldersAPI.createFolder({ name: newFolderName, parentId: currentFolder });
      toast.success('Folder created successfully');
      setNewFolderName('');
      setShowNewFolderModal(false);
      loadFiles();
    } catch (error) {
      toast.error('Failed to create folder');
    }
  };

  const openShareModal = (file) => {
    trackRecentFile(file.id);
    setSelectedFileToShare(file);
    setShareEmail(filePermissions[file.id]?.email || '');
    setSharePermission(filePermissions[file.id]?.role || 'viewer');
    setShowShareModal(true);
    setActiveMenuId(null);
  };

  const handleShareFile = async () => {
    if (!shareEmail.trim()) {
      toast.error('Please enter an email');
      return;
    }
    setSharing(true);
    try {
      await filesAPI.shareFile(selectedFileToShare.id, { email: shareEmail, permission: sharePermission });
      
      setFilePermissions((prev) => ({
        ...prev,
        [selectedFileToShare.id]: {
          email: shareEmail,
          role: sharePermission
        }
      }));

      toast.success(`File shared as ${sharePermission} successfully`);
      setShowShareModal(false);
      setSelectedFileToShare(null);
      loadFiles();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const getFileRole = (fileId) => {
    return filePermissions[fileId]?.role || 'editor';
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredFiles = files.filter(f => f.originalName.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredTrash = trashFiles.filter(i => (i.originalName || i.name).toLowerCase().includes(searchTerm.toLowerCase()));

  const visibleStarredFiles = starredFiles.filter((file) => file.originalName.toLowerCase().includes(searchTerm.toLowerCase()));
  const visibleStarredFolders = starredFolders.filter((folder) => folder.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const visibleRecentFiles = recentFiles.filter((file) => file.originalName.toLowerCase().includes(searchTerm.toLowerCase()));

  const storagePercent = storageStats.quota > 0
    ? Math.min((storageStats.used / storageStats.quota) * 100, 100)
    : 0;

  const navItems = [
    {
      id: 'drive',
      label: 'My Drive',
      icon: HardDrive,
      active: activeTab === 'drive' && driveScope === 'my-drive',
      onClick: () => { setActiveTab('drive'); setDriveScope('my-drive'); setCurrentFolder(null); }
    },
    {
      id: 'recent',
      label: 'Recent',
      icon: Clock,
      active: activeTab === 'recent',
      count: recentFiles.length,
      onClick: () => { setActiveTab('recent'); setCurrentFolder(null); }
    },
    {
      id: 'starred',
      label: 'Starred',
      icon: Star,
      active: activeTab === 'starred',
      count: starredFiles.length + starredFolders.length,
      onClick: () => { setActiveTab('starred'); setCurrentFolder(null); }
    },
    {
      id: 'shared',
      label: 'Shared with me',
      icon: Users,
      active: activeTab === 'drive' && driveScope === 'shared',
      onClick: () => { setActiveTab('drive'); setDriveScope('shared'); setCurrentFolder(null); }
    },
    {
      id: 'notes',
      label: 'Notes & Planner',
      icon: Sparkles,
      active: activeTab === 'notes',
      onClick: () => setActiveTab('notes')
    },
    {
      id: 'trash',
      label: 'Trash',
      icon: Trash2,
      active: activeTab === 'trash',
      count: trashFiles.length,
      onClick: () => setActiveTab('trash')
    }
  ];

  return (
    <div className="min-h-screen bg-archive-fog dark:bg-slate-950 text-archive-ink dark:text-slate-100 transition-colors duration-300 font-sans flex flex-col">
      
      {/* Top Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-archive-teal rounded-2xl flex items-center justify-center text-white">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg font-bold text-archive-ink dark:text-white">Drive</span>
                <span className="block text-[10px] text-slate-400 font-medium">Your file archive</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search in drive..."
                  aria-label="Search files and folders"
                  className="pl-10 pr-4 py-2 text-sm bg-slate-100 dark:bg-slate-800/80 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all w-64 lg:w-96"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                <button
                  onClick={toggleTheme}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all shadow-2xs"
                  title="Toggle Theme"
                >
                  {theme === 'dark' ? (
                    <Sun size={17} className="text-amber-400 transform rotate-90 scale-110" />
                  ) : (
                    <Moon size={17} className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)] transform -rotate-12 scale-110" />
                  )}
                </button>

                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all shadow-2xs"
                  title="Toggle View Mode"
                >
                  {viewMode === 'grid' ? <List size={17} /> : <Grid size={17} />}
                </button>
              </div>
              
              <div className="flex items-center space-x-3 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="hidden md:block text-right">
                  <div className="text-xs font-semibold">{user?.name}</div>
                  <div className="text-[10px] text-slate-400">{user?.email}</div>
                </div>
                <button
                  onClick={logout}
                  className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-2xl transition-all"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="md:hidden sticky top-16 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800" aria-label="Workspace sections">
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                aria-current={item.active ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${item.active ? 'bg-archive-teal/10 text-archive-teal' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
                {item.count > 0 && <span className="rounded-full bg-archive-teal px-1.5 py-0.5 text-[10px] text-white">{item.count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search files and folders"
              placeholder="Search your archive"
              className="w-full rounded-xl border border-slate-200 bg-archive-fog py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          {activeTab === 'drive' && driveScope === 'my-drive' && (
            <>
              <button type="button" onClick={open} aria-label="Upload files" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-archive-teal px-3 py-2 text-xs font-semibold text-white">
                <Plus size={15} aria-hidden="true" /> Upload
              </button>
              <button type="button" onClick={() => setShowNewFolderModal(true)} aria-label="Create a folder" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-archive-ink dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <FolderPlus size={15} aria-hidden="true" /> Folder
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-archive-ink border-r border-slate-200 dark:border-slate-800 p-4 hidden md:flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            {driveScope === 'my-drive' && activeTab === 'drive' && (
              <div className="relative group">
                <div {...getRootProps()} className="w-full">
                  <input {...getInputProps()} />
                  <button type="button" onClick={open} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-archive-teal hover:bg-teal-800 text-white rounded-2xl font-semibold text-sm transition-colors">
                    <Plus size={18} />
                    New Upload
                  </button>
                </div>
              </div>
            )}

            <nav className="space-y-1" aria-label="Workspace sections">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    aria-current={item.active ? 'page' : undefined}
                    className={`w-full flex items-center justify-between border-l-2 px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${item.active ? 'border-archive-teal bg-archive-teal/10 text-archive-teal dark:text-teal-300' : 'border-transparent rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <span className="flex items-center gap-3"><Icon size={18} aria-hidden="true" />{item.label}</span>
                    {item.count > 0 && <span className="rounded-full bg-archive-teal px-2 py-0.5 text-[10px] font-bold text-white">{item.count}</span>}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2.5">
              <Cloud size={16} className="text-blue-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Storage</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-archive-teal h-full rounded-full transition-all duration-500" style={{ width: `${storagePercent}%` }}></div>
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>{formatFileSize(storageStats.used)} used</span>
              <span>{formatFileSize(storageStats.quota)}</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          {activeTab === 'notes' ? (
            <NotesPlanner />
          ) : activeTab === 'trash' ? (
            <div>
              <div className="mb-6 flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Trash2 className="text-rose-500" size={18} />
                    Trash Bin Management
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Restore files or permanently clean up your workspace.</p>
                </div>
                {trashFiles.length > 0 && (
                  <button
                    onClick={handleEmptyTrash}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-2xl transition-all shadow-sm"
                  >
                    Empty Trash
                  </button>
                )}
              </div>

              {trashLoading ? (
                <div role="status" className="py-16 text-center text-sm text-slate-500">Loading trash…</div>
              ) : trashError ? (
                <div role="alert" className="py-16 text-center text-sm text-rose-600">
                  <p>Trash could not be loaded.</p>
                  <button type="button" onClick={loadTrash} className="mt-3 font-semibold underline">Try again</button>
                </div>
              ) : filteredTrash.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Your trash is empty</h3>
                  <p className="text-xs text-slate-400 mt-1">Deleted items will safely rest here until you remove them.</p>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
                  {filteredTrash.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`p-2 rounded-xl ${item.itemType === 'folder' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                          {item.itemType === 'folder' ? <Folder size={18} /> : <File size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{item.originalName || item.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.itemType === 'file' ? formatFileSize(item.size) : 'Folder'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button type="button" onClick={() => handleRestoreFromTrash(item)} aria-label={`Restore ${item.originalName || item.name}`} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all" title="Restore">
                          <RotateCcw size={15} />
                        </button>
                        <button type="button" onClick={() => handleDeletePermanently(item)} aria-label={`Delete ${item.originalName || item.name} forever`} className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all" title="Delete forever">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'starred' ? (
            <div>
              <div className="mb-6 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Star className="text-amber-500 fill-amber-500" size={18} />
                  Starred Files & Folders
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Quickly access your important items marked with a star.</p>
              </div>

              {visibleStarredFiles.length === 0 && visibleStarredFolders.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Star size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No starred items</h3>
                  <p className="text-xs text-slate-400 mt-1">Click the star icon on any file or folder to add it here.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {visibleStarredFolders.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Starred Folders</h3>
                      <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5' : 'space-y-2'}>
                        {visibleStarredFolders.map((folder) => (
                          <div
                            key={folder.id}
                            className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all cursor-pointer group relative p-3.5 ${
                              viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col justify-between h-24'
                            }`}
                            onClick={() => {
                              setActiveTab('drive');
                              setDriveScope('my-drive');
                              setCurrentFolder(folder.id);
                            }}
                          >
                            <div className="flex items-center space-x-3 min-w-0 pr-12">
                              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 shadow-xs">
                                <Folder size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">{folder.name}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Folder</p>
                              </div>
                            </div>
                            
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                              <button onClick={(e) => toggleStar(e, folder.id, 'folder')} className="p-1.5 text-amber-500 hover:scale-110 transition-transform" title="Unstar">
                                <Star size={16} className="fill-amber-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {visibleStarredFiles.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Starred Files</h3>
                      <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5' : 'space-y-2'}>
                        {visibleStarredFiles.map((file) => (
                          <div
                            key={file.id}
                            onClick={() => {
                              trackRecentFile(file.id);
                              setActiveTab('drive');
                              setDriveScope('my-drive');
                              setCurrentFolder(file.folderId || null);
                            }}
                            className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all group relative p-3.5 cursor-pointer ${
                              viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col justify-between h-24'
                            }`}
                          >
                            <div className="flex items-center space-x-3 min-w-0 pr-12">
                              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 shadow-xs">
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">{file.originalName}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                            
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                              <button onClick={(e) => toggleStar(e, file.id)} className="p-1.5 text-amber-500 hover:scale-110 transition-transform" title="Unstar">
                                <Star size={16} className="fill-amber-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'recent' ? (
            <div>
              <div className="mb-6 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Clock className="text-blue-500" size={18} />
                  Recent Files
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Files you have recently opened, downloaded, or interacted with.</p>
              </div>

              {visibleRecentFiles.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Clock size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No recent files</h3>
                  <p className="text-xs text-slate-400 mt-1">Files you interact with will automatically appear here.</p>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5' : 'space-y-2'}>
                  {visibleRecentFiles.map((file) => {
                    const isStarred = starredIds.includes(file.id);
                    return (
                      <div
                        key={file.id}
                        onClick={() => handlePreviewFile(file)}
                        className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all group relative p-3.5 cursor-pointer ${
                          viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col justify-between h-24'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 pr-12">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 shadow-xs">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">{file.originalName}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                          <button
                            onClick={(e) => toggleStar(e, file.id)}
                            className={`p-1.5 rounded-lg transition-all ${isStarred ? 'text-amber-500' : 'text-slate-300 dark:text-slate-700 hover:text-amber-400'}`}
                            title={isStarred ? 'Unstar' : 'Star'}
                          >
                            <Star size={15} className={isStarred ? 'fill-amber-500' : ''} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Toolbar & Breadcrumbs */}
              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setDriveScope('my-drive'); setCurrentFolder(null); }}
                    className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
                      driveScope === 'my-drive'
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    My Drive
                  </button>
                  {currentFolder && (
                    <div className="flex items-center text-xs text-slate-400 gap-1.5">
                      <ChevronRight size={14} />
                      <span className="font-medium text-slate-700 dark:text-slate-200">Folder View</span>
                    </div>
                  )}
                </div>

                {driveScope === 'my-drive' && (
                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <button
                      onClick={() => setShowNewFolderModal(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded-2xl transition-all shadow-2xs"
                    >
                      <FolderPlus size={16} className="mr-2 text-blue-500" />
                      New Folder
                    </button>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-6">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
                      <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-8">
                  
                  {/* Folders Section */}
                  {filteredFolders.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Folders</h3>
                      <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5' : 'space-y-2'}>
                        {filteredFolders.map((folder) => {
                          const isStarred = starredIds.includes(folder.id);
                          return (
                            <div
                              key={folder.id}
                              className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all cursor-pointer group relative p-3.5 ${
                                viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col justify-between h-24'
                              }`}
                              onClick={() => setCurrentFolder(folder.id)}
                            >
                              <div className="flex items-center space-x-3 min-w-0 pr-12">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 shadow-xs">
                                  <Folder size={18} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">{folder.name}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Folder</p>
                                </div>
                              </div>
                              
                              <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                                <button
                                  onClick={(e) => toggleStar(e, folder.id, 'folder')}
                                  className={`p-1.5 rounded-lg transition-all ${isStarred ? 'text-amber-500' : 'text-slate-300 dark:text-slate-700 hover:text-amber-400'}`}
                                  title={isStarred ? 'Unstar' : 'Star'}
                                >
                                  <Star size={15} className={isStarred ? 'fill-amber-500' : ''} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === folder.id ? null : folder.id); }}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                >
                                  <MoreVertical size={15} />
                                </button>

                                {activeMenuId === folder.id && (
                                  <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 py-1.5 text-xs font-medium">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedItemForInfo({ ...folder, type: 'folder' }); setActiveMenuId(null); }}
                                      className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                      <Info size={14} /> Details
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMoveToTrash(folder, 'folder'); }}
                                      className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                                    >
                                      <Trash2 size={14} /> Remove
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Files Section */}
                  <div>
                    {filteredFolders.length > 0 && filteredFiles.length > 0 && (
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Files</h3>
                    )}
                    
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5' : 'space-y-2'}>
                      {filteredFiles.map((file) => {
                        const isStarred = starredIds.includes(file.id);
                        const role = getFileRole(file.id);
                        return (
                          <div
                            key={file.id}
                            onClick={() => handlePreviewFile(file)}
                            className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all group relative p-3.5 cursor-pointer ${
                              viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col justify-between h-24'
                            }`}
                          >
                            <div className="flex items-center space-x-3 min-w-0 pr-12">
                              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 shadow-xs">
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">{file.originalName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-400">{formatFileSize(file.size)}</span>
                                  {role && (
                                    <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded font-medium uppercase">
                                      {role}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleStar(e, file.id); }}
                                className={`p-1.5 rounded-lg transition-all ${isStarred ? 'text-amber-500' : 'text-slate-300 dark:text-slate-700 hover:text-amber-400'}`}
                                title={isStarred ? 'Unstar' : 'Star'}
                              >
                                <Star size={15} className={isStarred ? 'fill-amber-500' : ''} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === file.id ? null : file.id); }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                              >
                                <MoreVertical size={15} />
                              </button>

                              {activeMenuId === file.id && (
                                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 py-1.5 text-xs font-medium">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePreviewFile(file); }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-blue-600 dark:text-blue-400"
                                  >
                                    <Eye size={14} /> Preview
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); trackRecentFile(file.id); handleDownload(file); setActiveMenuId(null); }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Download size={14} /> Download
                                  </button>
                                  {driveScope === 'my-drive' && role !== 'viewer' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openShareModal(file); }}
                                      className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                      <Share2 size={14} /> Share & Roles
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); trackRecentFile(file.id); setSelectedItemForInfo({ ...file, type: 'file' }); setActiveMenuId(null); }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Info size={14} /> Details
                                  </button>
                                  {driveScope === 'my-drive' && role !== 'viewer' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMoveToTrash(file, 'file'); }}
                                      className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                                    >
                                      <Trash2 size={14} /> Remove
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

              {!loading && filteredFiles.length === 0 && filteredFolders.length === 0 && (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 mt-2">
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Cloud size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No folders or files found</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Create a new folder or upload files to populate your workspace.
                  </p>
                </div>
              )}
            </>
          )}
        </main>

        {/* Right Info Drawer */}
        {selectedItemForInfo && (
          <aside className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 hidden xl:flex flex-col justify-between shrink-0 animate-in slide-in-from-right duration-300">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Info size={16} className="text-blue-500" /> Item Details
                </h3>
                <button
                  onClick={() => setSelectedItemForInfo(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="text-center py-6 border-b border-slate-200 dark:border-slate-800">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  {selectedItemForInfo.type === 'folder' ? <Folder size={28} /> : <FileText size={28} />}
                </div>
                <h4 className="text-sm font-bold truncate px-2">{selectedItemForInfo.originalName || selectedItemForInfo.name}</h4>
                <span className="inline-block mt-1 px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] rounded-full font-semibold uppercase">
                  {selectedItemForInfo.type}
                </span>
              </div>

              <div className="py-4 space-y-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Size</span>
                  <span className="font-semibold">{formatFileSize(selectedItemForInfo.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Created Date</span>
                  <span className="font-semibold">{formatDate(selectedItemForInfo.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Access Role</span>
                  <span className="font-semibold uppercase text-indigo-500">{getFileRole(selectedItemForInfo.id)}</span>
                </div>
              </div>
            </div>

            {selectedItemForInfo.type === 'file' && (
              <div className="space-y-2">
                <button
                  onClick={() => handlePreviewFile(selectedItemForInfo)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-semibold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  <Eye size={15} /> Preview File
                </button>
                <button
                  onClick={() => handleDownload(selectedItemForInfo)}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Download size={15} /> Download File
                </button>
              </div>
            )}
          </aside>
        )}

      </div>

      {/* Modal Preview File */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="min-w-0 pr-4">
                <h3 className="text-sm font-bold truncate text-slate-800 dark:text-slate-100">{previewFile.originalName}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Xem trước tệp trực tiếp trên trình duyệt</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewFile)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <Download size={14} /> Tải xuống
                </button>
                <button
                  onClick={() => { setPreviewFile(null); setPreviewContent(''); }}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center bg-slate-100/50 dark:bg-slate-950/50 relative">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-400 font-medium">Đang tải tệp xem trước...</p>
                </div>
              ) : previewFile.mimetype?.includes('image') ? (
                <img src={previewContent} alt={previewFile.originalName} className="max-h-full max-w-full object-contain rounded-2xl shadow-lg" />
              ) : previewFile.mimetype?.includes('pdf') ? (
                <iframe src={previewContent} title={previewFile.originalName} className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-800" />
              ) : previewFile.originalName.endsWith('.docx') || previewFile.mimetype?.includes('word') ? (
                <pre className="w-full h-full whitespace-pre-wrap bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm overflow-y-auto text-xs font-sans">{previewContent}</pre>
              ) : (
                <div className="text-center py-12">
                  <p className="text-xs text-slate-500 mb-3">Định dạng này không hỗ trợ xem trước trực tiếp.</p>
                  <button
                    onClick={() => handleDownload(previewFile)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-md"
                  >
                    Tải xuống để xem
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold mb-3">Create New Folder</h3>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              onKeyPress={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
            />
            <div className="flex justify-end space-x-2.5 mt-5">
              <button
                onClick={() => { setShowNewFolderModal(false); setNewFolderName(''); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold mb-1 flex items-center gap-2">
              <Shield size={18} className="text-indigo-500" /> Share & Access Roles
            </h3>
            <p className="text-xs text-slate-400 mb-4 truncate">{selectedFileToShare?.originalName}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Recipient Email</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Permission Role</label>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="viewer">👀 Người xem (Chỉ xem và tải xuống)</option>
                  <option value="commenter">💬 Người nhận xét (Xem và góp ý)</option>
                  <option value="editor">✏️ Người chỉnh sửa (Toàn quyền quản lý)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2.5 mt-6">
              <button
                onClick={() => { setShowShareModal(false); setSelectedFileToShare(null); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleShareFile}
                disabled={sharing}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-500/20 disabled:opacity-60"
              >
                {sharing ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
