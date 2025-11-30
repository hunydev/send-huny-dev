import { SharedFile, FileConfig, UploadResponse } from '../types';

const API_BASE = '/api';
const AUTH_SERVER = 'https://auth.huny.dev';
const CLIENT_ID = 'client_HRENw26wlSsgG4HfrAGjqMMw';

// Custom error class for auth errors
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Helper to get auth header
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Token refresh function
const refreshAccessToken = async (): Promise<boolean> => {
  const refreshToken = localStorage.getItem('auth_refresh_token');
  if (!refreshToken) {
    console.log('No refresh token available');
    return false;
  }

  try {
    const response = await fetch(`${AUTH_SERVER}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', response.status);
      return false;
    }

    const tokens = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    // Update localStorage
    localStorage.setItem('auth_token', tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem('auth_refresh_token', tokens.refresh_token);
    }
    if (tokens.expires_in) {
      localStorage.setItem('auth_expires_at', String(Date.now() + (tokens.expires_in * 1000)));
    }

    console.log('Token refreshed successfully via API interceptor');
    
    // Dispatch event to notify App.tsx about the token refresh
    window.dispatchEvent(new CustomEvent('tokenRefreshed', { 
      detail: { token: tokens.access_token } 
    }));
    
    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
};

// Coordinated refresh to prevent race conditions
const coordinatedRefresh = async (): Promise<boolean> => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = refreshAccessToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  
  return refreshPromise;
};

// Clear auth data helper
const clearAuthData = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_refresh_token');
  localStorage.removeItem('auth_expires_at');
  
  // Dispatch event to notify App.tsx about auth failure
  window.dispatchEvent(new CustomEvent('authFailed'));
};

// Fetch with automatic token refresh on 401
const fetchWithAuth = async (
  url: string, 
  options: RequestInit = {},
  retry = true
): Promise<Response> => {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const response = await fetch(url, { ...options, headers });
  
  // If 401 and we haven't retried yet, try refreshing the token
  if (response.status === 401 && retry) {
    const refreshSuccess = await coordinatedRefresh();
    
    if (refreshSuccess) {
      // Retry the request with new token
      return fetchWithAuth(url, options, false);
    } else {
      // Refresh failed, clear auth data
      clearAuthData();
      throw new AuthError('Session expired. Please log in again.');
    }
  }
  
  return response;
};

// Helper to handle response errors (for non-401 errors)
const handleResponseError = async (response: Response): Promise<never> => {
  if (response.status === 401) {
    // This shouldn't normally be reached as fetchWithAuth handles 401
    clearAuthData();
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

  // Note: Don't set Content-Type header for FormData, browser will set it with boundary
  const response = await fetchWithAuth(`${API_BASE}/files`, {
    method: 'POST',
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
  const response = await fetchWithAuth(`${API_BASE}/files/${fileId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    await handleResponseError(response);
  }
};

export const listFiles = async (): Promise<SharedFile[]> => {
  const response = await fetchWithAuth(`${API_BASE}/files`);

  if (!response.ok) {
    await handleResponseError(response);
  }

  const result = await response.json() as { data?: SharedFile[] };
  return result.data || [];
};
