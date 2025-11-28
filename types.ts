export enum AppView {
  LOGIN = 'LOGIN',
  CALLBACK = 'CALLBACK',
  ADMIN_LOGIN = 'ADMIN_LOGIN', // Legacy/Unused
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  PUBLIC_DOWNLOAD = 'PUBLIC_DOWNLOAD',
  GUEST_HOME = 'GUEST_HOME',
}

export interface FileConfig {
  maxDownloads: number;
  expiresInMinutes: number; // 0 for strictly download count based
  password?: string;
}

export interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: number;
  expiresAt: number | null; // null if no time limit
  maxDownloads: number;
  currentDownloads: number;
  isExpired: boolean;
  summary?: string; // AI Summary
  blobData?: string; // Base64 simulation for demo purposes
}

export interface UploadResponse {
  fileId: string;
  shareUrl: string;
}

export interface User {
  sub: string;
  name: string;
  email: string;
  email_verified: boolean;
  role?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isGuest: boolean;
  token?: string;
  user?: User;
}