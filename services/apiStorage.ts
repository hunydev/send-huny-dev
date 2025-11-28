import { SharedFile, FileConfig, UploadResponse } from '../types';

const API_BASE = '/api';

// Custom error class for auth errors
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Helper to get auth header
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Helper to handle response errors
const handleResponseError = async (response: Response): Promise<never> => {
  if (response.status === 401) {
    // Clear invalid auth data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    throw new AuthError('Session expired. Please log in again.');
  }
  const error = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
  throw new Error(error.error || 'Request failed');
};

export const uploadFileToStorage = async (
  file: File, 
  config: FileConfig, 
  aiSummary?: string
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('config', JSON.stringify(config));
  if (aiSummary) {
    formData.append('summary', aiSummary);
  }

  const response = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    await handleResponseError(response);
  }

  const result = await response.json() as { data: UploadResponse };
  return result.data;
};

export const getFileMetadata = async (fileId: string): Promise<SharedFile | null> => {
  // For public access (via publicId)
  const response = await fetch(`${API_BASE}/public/${fileId}`);
  
  if (!response.ok) {
    if (response.status === 404 || response.status === 410) {
      const result = await response.json() as { data?: { isExpired?: boolean; name?: string } };
      if (result.data?.isExpired) {
        return {
          id: fileId,
          name: result.data.name || 'Unknown',
          size: 0,
          type: '',
          createdAt: 0,
          expiresAt: null,
          maxDownloads: 0,
          currentDownloads: 0,
          isExpired: true,
        };
      }
      return null;
    }
    throw new Error('Failed to get file metadata');
  }

  const result = await response.json() as { data: Partial<SharedFile> };
  return {
    id: fileId,
    ...result.data,
    isExpired: false,
  } as SharedFile;
};

export const incrementDownloadCount = async (fileId: string): Promise<void> => {
  // Download count is incremented automatically when downloading
  // This function is kept for compatibility but does nothing now
};

export const downloadPublicFile = async (publicId: string): Promise<{ blob: Blob; filename: string } | null> => {
  const response = await fetch(`${API_BASE}/public/${publicId}/download`);
  
  if (!response.ok) {
    return null;
  }

  // Get filename from Content-Disposition header
  const disposition = response.headers.get('Content-Disposition');
  let filename = 'download';
  if (disposition) {
    const match = disposition.match(/filename="(.+)"/);
    if (match) {
      filename = decodeURIComponent(match[1]);
    }
  }

  const blob = await response.blob();
  return { blob, filename };
};

export const deleteFile = async (fileId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    await handleResponseError(response);
  }
};

export const listFiles = async (): Promise<SharedFile[]> => {
  const response = await fetch(`${API_BASE}/files`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    await handleResponseError(response);
  }

  const result = await response.json() as { data?: SharedFile[] };
  return result.data || [];
};
