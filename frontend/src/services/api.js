import axios from 'axios';
import { resolveApiBaseUrl } from './apiConfig';

const API_BASE_URL = resolveApiBaseUrl(
  process.env.REACT_APP_API_URL,
  process.env.VITE_API_URL,
  process.env.NODE_ENV
);

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  me: () => api.get('/auth/me'),
};

export const filesAPI = {
  getFiles: (folderId) => api.get('/files', { params: { folderId } }),
  getTrash: () => api.get('/files/trash'),
  getRecent: () => api.get('/files/recent'),
  getFavorites: () => api.get('/files/favorites'),
  getStorage: () => api.get('/files/storage'),
  restoreFile: (id) => api.post(`/files/${id}/restore`),
  permanentlyDeleteFile: (id) => api.delete(`/files/${id}/permanent`),
  markRecent: (id) => api.post(`/files/${id}/recent`),
  toggleFavorite: (id) => api.post(`/files/${id}/favorite`),
  getSharedFiles: () => api.get('/files/shared'),
  uploadFile: (formData) => api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  downloadFile: (id) => api.get(`/files/download/${id}`, { responseType: 'blob' }),
  deleteFile: (id) => api.delete(`/files/${id}`),
  renameFile: (id, name) => api.patch(`/files/${id}/rename`, { name }),
  getFileInfo: (id) => api.get(`/files/${id}`),
  shareFile: (id, payload) => api.post(`/files/${id}/share`, payload),
  createShareLink: (id, payload) => api.post(`/files/${id}/share-link`, payload),
  removeShare: (id, sharedUserId) => api.delete(`/files/${id}/share/${sharedUserId}`),
};

export const foldersAPI = {
  createFolder: (folderData) => api.post('/folders', folderData),
  getFolderContents: (id) => api.get(`/folders/${id}`),
  deleteFolder: (id) => api.delete(`/folders/${id}`),
  restoreFolder: (id) => api.post(`/folders/${id}/restore`),
  permanentlyDeleteFolder: (id) => api.delete(`/folders/${id}/permanent`),
  toggleFavorite: (id) => api.post(`/folders/${id}/favorite`),
  renameFolder: (id, name) => api.patch(`/folders/${id}/rename`, { name }),
};

export const notesAPI = {
  getNotes: () => api.get('/notes'),
  createStreamTicket: () => api.post('/notes/stream-token'),
  createNote: (noteData) => api.post('/notes', noteData),
  updateNote: (id, noteData) => api.patch(`/notes/${id}`, noteData),
  deleteNote: (id) => api.delete(`/notes/${id}`),
};

export const notebooksAPI = {
  getStatus: () => api.get('/notebooks/status'),
  getSources: () => api.get('/notebooks/sources'),
  getNotebooks: () => api.get('/notebooks'),
  getNotebook: (id) => api.get(`/notebooks/${id}`),
  createNotebook: (notebook) => api.post('/notebooks', notebook),
  sendMessage: (id, question) => api.post(`/notebooks/${id}/messages`, { question }),
  deleteNotebook: (id) => api.delete(`/notebooks/${id}`)
};

export const getNotesStreamUrl = (ticket) => {
  const base = API_BASE_URL.replace(/\/$/, '');
  return `${base}/notes/stream?ticket=${encodeURIComponent(ticket)}`;
};

export default api;
