// Cloudflare Worker Environment
export interface Env {
  // R2 Bucket
  STORAGE: R2Bucket;
  
  // Static assets binding
  ASSETS: Fetcher;
  
  // Environment variables
  AUTH_SERVER: string;
  CLIENT_ID: string;
  CLIENT_SECRET?: string;
  GEMINI_API_KEY?: string;
}

// User from OAuth
export interface User {
  sub: string;
  name: string;
  email: string;
  email_verified?: boolean;
  role?: string;
}

// File configuration for upload
export interface FileConfig {
  maxDownloads: number;
  expiresInMinutes: number;
  password?: string;
}

// File metadata stored in R2
export interface FileMetadata {
  id: string;
  userId: string;        // Owner's sub from OAuth
  name: string;
  size: number;
  type: string;
  createdAt: number;
  expiresAt: number | null;
  maxDownloads: number;
  currentDownloads: number;
  isExpired: boolean;
  summary?: string;
  // Public sharing
  isPublic: boolean;
  publicId?: string;     // Separate ID for public access
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UploadResponse {
  fileId: string;
  publicId: string;
  shareUrl: string;
}

export interface AuthCallbackResponse {
  accessToken: string;
  user: User;
}
