import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  getProfile: () => api.get('/auth/me'),
};

// Messages API
export const messagesAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (conversationId: number, markRead = false, limit = 50, offset = 0) =>
    api.get(`/messages/conversations/${conversationId}/messages`, { 
      params: { limit, offset, mark_read: markRead ? 'true' : 'false' } 
    }),
  createConversation: (name: string, type: string, participantIds: number[]) =>
    api.post('/messages/conversations', { name, type, participant_ids: participantIds }),
  sendMessage: (conversationId: number, content: string, image?: File) => {
    const formData = new FormData();
    formData.append('conversation_id', conversationId.toString());
    if (content) formData.append('content', content);
    if (image) formData.append('image', image);
    return api.post('/messages/messages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getMessageImage: (messageId: number) => 
    api.get(`/messages/messages/${messageId}/image`, { responseType: 'blob' }),
  deleteMessage: (messageId: number) => api.delete(`/messages/messages/${messageId}`),
  getUsers: () => api.get('/messages/users'),
  getUnreadCount: () => api.get('/messages/unread-count'),
  pinConversation: (conversationId: number, isPinned: boolean) =>
    api.put(`/messages/conversations/${conversationId}/pin`, { is_pinned: isPinned }),
  deleteConversation: (conversationId: number) =>
    api.delete(`/messages/conversations/${conversationId}`),
};

// Compatibility aliases for older code that used different names
// (keeps backward compatibility with previous versions)
(messagesAPI as any).send = messagesAPI.sendMessage;

// Sales API
export const salesAPI = {
  getAll: (filters?: any) => api.get('/sales', { params: filters }),
  getStats: (filters?: any) => api.get('/sales/stats', { params: filters }),
  create: (data: any) => api.post('/sales', data),
  update: (id: number, data: any) => api.put(`/sales/${id}`, data),
  delete: (id: number) => api.delete(`/sales/${id}`),
  uploadFile: (id: number, type: 'contract' | 'invoice', file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/sales/${id}/upload/${type}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  downloadFile: (id: number, type: 'contract' | 'invoice') =>
    api.get(`/sales/${id}/download/${type}`, { responseType: 'blob' }),
  deleteFile: (id: number, type: 'contract' | 'invoice') =>
    api.delete(`/sales/${id}/file/${type}`),
};

// Admin API
export const adminAPI = {
  getUsers: () => api.get('/admin/users'),
  createUser: (data: any) => api.post('/admin/users', data),
  updateUser: (id: number, data: any) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  getActivityLogs: (limit = 100, offset = 0) =>
    api.get('/admin/activity-logs', { params: { limit, offset } }),
  getDepartments: () => api.get('/admin/departments'),
  createDepartment: (name: string, description: string) =>
    api.post('/admin/departments', { name, description }),
};

// Drive API
export const driveAPI = {
  getFolders: () => api.get('/drive/folders'),
  createFolder: (data: any) => api.post('/drive/folders', data),
  updateFolder: (id: number, data: any) => api.put(`/drive/folders/${id}`, data),
  deleteFolder: (id: number) => api.delete(`/drive/folders/${id}`),
  getFolderFiles: (folderId: number) => api.get(`/drive/folders/${folderId}/files`),
  uploadFile: (folderId: number, file: File, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    return api.post(`/drive/folders/${folderId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  downloadFile: (fileId: number) =>
    api.get(`/drive/files/${fileId}/download`, { responseType: 'blob' }),
  updateFile: (fileId: number, data: any) => api.put(`/drive/files/${fileId}`, data),
  deleteFile: (fileId: number) => api.delete(`/drive/files/${fileId}`),
  searchFiles: (query: string) => api.get('/drive/search', { params: { query } }),
};

// Expenses API
export const expensesAPI = {
  getAll: (filters?: any) => api.get('/expenses', { params: filters }),
  getStats: (filters?: any) => api.get('/expenses/stats', { params: filters }),
  create: (data: any, receipt?: File) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description || '');
    formData.append('amount', data.amount.toString());
    formData.append('category', data.category);
    formData.append('expense_date', data.expense_date);
    if (receipt) formData.append('receipt', receipt);
    return api.post('/expenses', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  update: (id: number, data: any) => api.put(`/expenses/${id}`, data),
  delete: (id: number) => api.delete(`/expenses/${id}`),
  downloadReceipt: (id: number) => 
    api.get(`/expenses/${id}/receipt`, { responseType: 'blob' }),
};
