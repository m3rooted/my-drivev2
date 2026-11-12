import React, { useState, useEffect, useCallback } from 'react';
import './Dashboard.css';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { filesAPI, foldersAPI } from '../services/api';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import mammoth from 'mammoth';
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
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  FileArchive,
  ChevronRight,
  MoreVertical,
  Info,
  X,
  Plus,
  Star,
  Clock,
  Shield,
  Eye,
  Link2
} from 'lucide-react';
import NotesPlanner from './NotesPlanner';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);

  // --- STATE THÙNG RÁC (TRASH) ĐỒNG BỘ LOCALSTORAGE ---
  const [trashFiles, setTrashFiles] = useState(() => {
    try {
      const saved = localStorage.getItem('drive_trash_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [deletedIds, setDeletedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('drive_deleted_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [starredIds, setStarredIds] = useState(() => {
    try {
      const saved = localStorage.getItem('drive_starred_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [recentFileIds, setRecentFileIds] = useState(() => {
    try {
      const saved = localStorage.getItem('drive_recent_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [filePermissions, setFilePermissions] = useState(() => {
    try {
      const saved = localStorage.getItem('drive_file_permissions');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeTab, setActiveTab] = useState('drive'); 
  const [driveScope, setDriveScope] = useState('my-drive');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFileToShare, setSelectedFileToShare] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('viewer');
  const [sharing, setSharing] = useState(false);

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedItemForInfo, setSelectedItemForInfo] = useState(null);

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

  useEffect(() => {
    try { localStorage.setItem('drive_trash_items', JSON.stringify(trashFiles)); } catch (e) {}
  }, [trashFiles]);

  useEffect(() => {
    try { localStorage.setItem('drive_deleted_ids', JSON.stringify(deletedIds)); } catch (e) {}
  }, [deletedIds]);

  useEffect(() => {
    try { localStorage.setItem('drive_starred_ids', JSON.stringify(starredIds)); } catch (e) {}
  }, [starredIds]);

  useEffect(() => {
    try { localStorage.setItem('drive_recent_ids', JSON.stringify(recentFileIds)); } catch (e) {}
  }, [recentFileIds]);

  useEffect(() => {
    try { localStorage.setItem('drive_file_permissions', JSON.stringify(filePermissions)); } catch (e) {}
  }, [filePermissions]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const savedDeletedIds = JSON.parse(localStorage.getItem('drive_deleted_ids') || '[]');

      if (driveScope === 'shared' || activeTab === 'shared') {
        const response = await filesAPI.getSharedFiles();
        const validFiles = (response.data.files || []).filter(f => !savedDeletedIds.includes(f.id));
        setFiles(validFiles);
        setFolders([]);
      } else {
        const response = await filesAPI.getFiles(currentFolder);
        const validFiles = (response.data.files || []).filter(f => !savedDeletedIds.includes(f.id));
        const validFolders = (response.data.folders || []).filter(f => !savedDeletedIds.includes(f.id));
        setFiles(validFiles);
        setFolders(validFolders);
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
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop, multiple: true });

  const trackRecentFile = (fileId) => {
    setRecentFileIds((prev) => {
      const filtered = prev.filter((id) => id !== fileId);
      return [fileId, ...filtered].slice(0, 20);
    });
  };

  // --- HÀM NHẬN DIỆN ĐỊNH DẠNG TỆP ĐỂ TRẢ VỀ ICON VÀ MÀU SẮC RIÊNG ---
  const getFileVisualInfo = (fileName = '') => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      return { icon: <FileText size={18} />, badgeClass: 'file-badge-pdf', label: 'PDF' };
    }
    if (['doc', 'docx', 'txt'].includes(ext)) {
      return { icon: <FileText size={18} />, badgeClass: 'file-badge-word', label: ext.toUpperCase() };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return { icon: <FileSpreadsheet size={18} />, badgeClass: 'file-badge-excel', label: ext.toUpperCase() };
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      return { icon: <ImageIcon size={18} />, badgeClass: 'file-badge-image', label: ext.toUpperCase() };
    }
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) {
      return { icon: <FileArchive size={18} />, badgeClass: 'file-badge-archive', label: ext.toUpperCase() };
    }
    return { icon: <File size={18} />, badgeClass: 'file-badge-default', label: ext ? ext.toUpperCase() : 'FILE' };
  };

  const handleCopyShareLink = (file) => {
    trackRecentFile(file.id);
    const shareUrl = `${window.location.origin}/share?fileId=${file.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success(`Đã sao chép liên kết chia sẻ cho "${file.originalName}"!`);
    setActiveMenuId(null);
  };

  const handlePreviewFile = async (file) => {
    setPreviewFile(file);
    setPreviewLoading(true);
    setPreviewContent('');
    trackRecentFile(file.id);
    setActiveMenuId(null);

    try {
      const response = await filesAPI.downloadFile(file.id);
      const blob = new Blob([response.data], { type: file.mimetype });
      const url = window.URL.createObjectURL(blob);

      if (file.originalName.endsWith('.docx') || file.mimetype?.includes('word')) {
        const arrayBuffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setPreviewContent(result.value);
      } else {
        setPreviewContent(url);
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
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const toggleStar = (e, id) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      if (prev.includes(id)) {
        toast.success('Removed from starred');
        return prev.filter((item) => item !== id);
      } else {
        toast.success('Added to starred');
        return [...prev, id];
      }
    });
  };

  const handleMoveToTrash = (item, type = 'file') => {
    if (type === 'file') {
      setFiles((prev) => prev.filter((f) => f.id !== item.id));
      setTrashFiles((prev) => [...prev, { ...item, itemType: 'file', deletedAt: new Date() }]);
      setRecentFileIds((prev) => prev.filter((id) => id !== item.id));
    } else {
      setFolders((prev) => prev.filter((f) => f.id !== item.id));
      setTrashFiles((prev) => [...prev, { ...item, itemType: 'folder', deletedAt: new Date() }]);
    }

    setDeletedIds((prev) => [...new Set([...prev, item.id])]);
    setStarredIds((prev) => prev.filter((id) => id !== item.id));
    setActiveMenuId(null);
    if (selectedItemForInfo?.id === item.id) setSelectedItemForInfo(null);
    toast.success(`Đã chuyển vào thùng rác`);
  };

  const handleRestoreFromTrash = (item) => {
    setTrashFiles((prev) => prev.filter((i) => i.id !== item.id));
    setDeletedIds((prev) => prev.filter((id) => id !== item.id));
    if (item.itemType === 'file') setFiles((prev) => [...prev, item]);
    else setFolders((prev) => [...prev, item]);
    toast.success(`Đã khôi phục "${item.originalName || item.name}"`);
  };

  const handleDeletePermanently = async (item) => {
    if (!window.confirm(`Xóa vĩnh viễn "${item.originalName || item.name}"?`)) return;
    try {
      if (item.itemType === 'file') await filesAPI.deleteFile(item.id);
      else await foldersAPI.deleteFolder(item.id);
    } catch (error) {}
    setTrashFiles((prev) => prev.filter((i) => i.id !== item.id));
    setDeletedIds((prev) => [...new Set([...prev, item.id])]);
    toast.success('Đã xóa vĩnh viễn');
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Dọn sạch toàn bộ thùng rác?')) return;
    for (const item of trashFiles) {
      try {
        if (item.itemType === 'file') await filesAPI.deleteFile(item.id);
        else await foldersAPI.deleteFolder(item.id);
      } catch (e) {}
    }
    const allTrashIds = trashFiles.map(i => i.id);
    setDeletedIds((prev) => [...new Set([...prev, ...allTrashIds])]);
    setTrashFiles([]);
    toast.success('Đã dọn sạch thùng rác');
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

  const starredFiles = files.filter(f => starredIds.includes(f.id) && f.originalName.toLowerCase().includes(searchTerm.toLowerCase()));
  const starredFolders = folders.filter(f => starredIds.includes(f.id) && f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const recentFiles = recentFileIds
    .map(id => files.find(f => f.id === id))
    .filter(f => f && f.originalName.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalBytesUsed = files.reduce((acc, f) => acc + (f.size || 0), 0);

  return (
    <div className="min-h-screen workspace-bg text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans flex flex-col">
      
      {/* Top Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  Drive Clone
                </span>
                <span className="block text-[10px] text-slate-400 font-medium tracking-wider uppercase">Workspace Pro</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search in drive..."
                  className="pl-10 pr-4 py-2 text-sm bg-slate-100/80 dark:bg-slate-800/80 border border-transparent focus:border-blue-500/40 rounded-2xl focus:ring-2 focus:ring-blue-500/30 focus:outline-none transition-all w-64 lg:w-96"
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

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800 p-4 hidden md:flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            {driveScope === 'my-drive' && activeTab === 'drive' && (
              <div className="relative group">
                <div {...getRootProps()} className="w-full">
                  <input {...getInputProps()} />
                  <button className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold text-sm btn-pulse-glow transition-all cursor-pointer">
                    <Plus size={18} />
                    New Upload
                  </button>
                </div>
              </div>
            )}

            <nav className="space-y-1">
              <button
                onClick={() => { setActiveTab('drive'); setDriveScope('my-drive'); setCurrentFolder(null); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  activeTab === 'drive' && driveScope === 'my-drive'
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                }`}
              >
                <HardDrive size={18} />
                My Drive
              </button>

              <button
                onClick={() => { setActiveTab('recent'); setCurrentFolder(null); }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  activeTab === 'recent'
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock size={18} />
                  Recent
                </div>
                {recentFiles.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-bold">
                    {recentFiles.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('starred'); setCurrentFolder(null); }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  activeTab === 'starred'
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Star size={18} />
                  Starred
                </div>
                {(starredFiles.length + starredFolders.length) > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                    {starredFiles.length + starredFolders.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('drive'); setDriveScope('shared'); setCurrentFolder(null); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  activeTab === 'drive' && driveScope === 'shared'
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                }`}
              >
                <Users size={18} />
                Shared with me
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  activeTab === 'notes'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                }`}
              >
                <Sparkles size={18} />
                Notes & Planner
              </button>

              <button
                onClick={() => setActiveTab('trash')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  activeTab === 'trash'
                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Trash2 size={18} />
                  Trash Bin
                </div>
                {trashFiles.length > 0 && (
                  <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                    {trashFiles.length}
                  </span>
                )}
              </button>
            </nav>
          </div>

          <div className="pro-item-card p-3.5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2.5">
              <Cloud size={16} className="text-blue-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Storage</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((totalBytesUsed / (1024 * 1024 * 500)) * 100, 100)}%` }}></div>
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>{formatFileSize(totalBytesUsed)} used</span>
              <span>500 MB</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          {activeTab === 'notes' ? (
            <NotesPlanner />
          ) : activeTab === 'trash' ? (
            <div>
              <div className="mb-6 flex justify-between items-center pro-item-card p-5 rounded-3xl">
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

              {filteredTrash.length === 0 ? (
                <div className="text-center py-20 pro-item-card rounded-3xl">
                  <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Your trash is empty</h3>
                  <p className="text-xs text-slate-400 mt-1">Deleted items will safely rest here until you remove them.</p>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
                  {filteredTrash.map((item) => (
                    <div key={item.id} className="pro-item-card rounded-2xl p-4 flex items-center justify-between">
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
                        <button onClick={() => handleRestoreFromTrash(item)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all" title="Restore">
                          <RotateCcw size={15} />
                        </button>
                        <button onClick={() => handleDeletePermanently(item)} className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all" title="Delete forever">
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
              <div className="mb-6 pro-item-card p-5 rounded-3xl">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Star className="text-amber-500 fill-amber-500" size={18} />
                  Starred Files & Folders
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Quickly access your important items marked with a star.</p>
              </div>

              {starredFiles.length === 0 && starredFolders.length === 0 ? (
                <div className="text-center py-20 pro-item-card rounded-3xl">
                  <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Star size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No starred items</h3>
                  <p className="text-xs text-slate-400 mt-1">Click the star icon on any file or folder to add it here.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {starredFolders.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Starred Folders</h3>
                      <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5' : 'space-y-2'}>
                        {starredFolders.map((folder) => (
                          <div
                            key={folder.id}
                            className={`pro-item-card rounded-2xl cursor-pointer group relative p-3.5 ${
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
                              <button onClick={(e) => toggleStar(e, folder.id)} className="p-1.5 text-amber-500 hover:scale-110 transition-transform" title="Unstar">
                                <Star size={16} className="fill-amber-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {starredFiles.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Starred Files</h3>
                      <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5' : 'space-y-2'}>
                        {starredFiles.map((file) => {
                          const visual = getFileVisualInfo(file.originalName);
                          return (
                            <div
                              key={file.id}
                              onClick={() => handlePreviewFile(file)}
                              className={`pro-item-card rounded-2xl group relative p-3.5 cursor-pointer ${
                                viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col justify-between h-24'
                              }`}
                            >
                              <div className="flex items-center space-x-3 min-w-0 pr-12">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${visual.badgeClass}`}>
                                  {visual.icon}
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
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'recent' ? (
            <div>
              <div className="mb-6 pro-item-card p-5 rounded-3xl">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Clock className="text-blue-500" size={18} />
                  Recent Files
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Files you have recently opened, downloaded, or interacted with.</p>
              </div>

              {recentFiles.length === 0 ? (
                <div className="text-center py-20 pro-item-card rounded-3xl">
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Clock size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No recent files</h3>
                  <p className="text-xs text-slate-400 mt-1">Files you interact with will automatically appear here.</p>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5' : 'space-y-2'}>
                  {recentFiles.map((file) => {
                    const isStarred = starredIds.includes(file.id);
                    const visual = getFileVisualInfo(file.originalName);
                    return (
                      <div
                        key={file.id}
                        onClick={() => handlePreviewFile(file)}
                        className={`pro-item-card rounded-2xl group relative p-3.5 cursor-pointer ${
                          viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col justify-between h-24'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 pr-12">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${visual.badgeClass}`}>
                            {visual.icon}
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
                        ? 'bg-blue-100/90 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-2xs'
                        : 'pro-item-card text-slate-600 dark:text-slate-400'
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
                      className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 pro-item-card text-xs font-semibold rounded-2xl cursor-pointer"
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
                    <div key={n} className="pro-item-card rounded-2xl p-4 animate-pulse space-y-3">
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
                              className={`pro-item-card rounded-2xl cursor-pointer group relative p-3.5 ${
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
                                  onClick={(e) => toggleStar(e, folder.id)}
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
                                  <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 py-1.5 text-xs font-medium animate-modal-custom">
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
                        const visual = getFileVisualInfo(file.originalName);
                        return (
                          <div
                            key={file.id}
                            onClick={() => handlePreviewFile(file)}
                            className={`pro-item-card rounded-2xl group relative p-3.5 cursor-pointer ${
                              viewMode === 'list' ? 'flex items-center justify-between' : 'flex flex-col justify-between h-24'
                            }`}
                          >
                            <div className="flex items-center space-x-3 min-w-0 pr-12">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${visual.badgeClass}`}>
                                {visual.icon}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">{file.originalName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-400">{formatFileSize(file.size)}</span>
                                  <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase ${visual.badgeClass}`}>
                                    {visual.label}
                                  </span>
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
                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 py-1.5 text-xs font-medium animate-modal-custom">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePreviewFile(file); }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-blue-600 dark:text-blue-400"
                                  >
                                    <Eye size={14} /> Preview
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCopyShareLink(file); }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-emerald-600 dark:text-emerald-400"
                                  >
                                    <Link2 size={14} /> Sao chép liên kết
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
                <div className="text-center py-20 pro-item-card rounded-3xl border-dashed mt-2">
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
          <aside className="w-80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-l border-slate-200 dark:border-slate-800 p-6 hidden xl:flex flex-col justify-between shrink-0 animate-modal-custom">
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
                  onClick={() => handleCopyShareLink(selectedItemForInfo)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-semibold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Link2 size={15} /> Sao chép liên kết
                </button>
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-custom">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="min-w-0 pr-4">
                <h3 className="text-sm font-bold truncate text-slate-800 dark:text-slate-100">{previewFile.originalName}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Xem trước tệp trực tiếp trên trình duyệt</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyShareLink(previewFile)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <Link2 size={14} /> Sao chép link
                </button>
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
                <div className="w-full h-full bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm overflow-y-auto prose dark:prose-invert text-xs" dangerouslySetInnerHTML={{ __html: previewContent }} />
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

      {/* Modal New Folder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl animate-modal-custom">
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

      {/* Modal Share & Roles */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl animate-modal-custom">
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