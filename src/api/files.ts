import { Env, FileMetadata, FileConfig, UploadResponse } from '../types.ts';
import { getUserFromRequest } from './auth.ts';
import { R2StorageService } from '../services/r2Storage.ts';

export async function handleFileRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const storage = new R2StorageService(env.STORAGE);
  
  // All file routes require authentication
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /api/files - List user's files
  if (path === '/api/files' && request.method === 'GET') {
    return listFiles(user.sub, storage);
  }

  // POST /api/files - Upload a new file
  if (path === '/api/files' && request.method === 'POST') {
    return uploadFile(request, user.sub, storage);
  }

  // Match /api/files/:id patterns
  const fileIdMatch = path.match(/^\/api\/files\/([^/]+)$/);
  if (fileIdMatch) {
    const fileId = fileIdMatch[1];

    // GET /api/files/:id - Get file metadata
    if (request.method === 'GET') {
      return getFileMetadata(fileId, user.sub, storage);
    }

    // DELETE /api/files/:id - Delete file
    if (request.method === 'DELETE') {
      return deleteFile(fileId, user.sub, storage);
    }
  }

  // GET /api/files/:id/download - Download file (for owner)
  const downloadMatch = path.match(/^\/api\/files\/([^/]+)\/download$/);
  if (downloadMatch && request.method === 'GET') {
    const fileId = downloadMatch[1];
    return downloadFileAsOwner(fileId, user.sub, storage);
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function listFiles(userId: string, storage: R2StorageService): Promise<Response> {
  try {
    const files = await storage.listUserFiles(userId);
    
    // Update expiration status
    const now = Date.now();
    const updatedFiles = files.map(file => ({
      ...file,
      isExpired: file.isExpired || 
        (file.expiresAt !== null && now > file.expiresAt) ||
        file.currentDownloads >= file.maxDownloads
    }));

    return new Response(JSON.stringify({ success: true, data: updatedFiles }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List files error:', error);
    return new Response(JSON.stringify({ error: 'Failed to list files' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function uploadFile(
  request: Request,
  userId: string,
  storage: R2StorageService
): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const configStr = formData.get('config') as string | null;
    const summary = formData.get('summary') as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse config
    const config: FileConfig = configStr 
      ? JSON.parse(configStr) 
      : { maxDownloads: 1, expiresInMinutes: 1440 };

    // Generate IDs
    const fileId = generateId();
    const publicId = generateId();

    // Calculate expiration
    const expiresAt = config.expiresInMinutes > 0
      ? Date.now() + config.expiresInMinutes * 60 * 1000
      : null;

    // Create metadata
    const metadata: FileMetadata = {
      id: fileId,
      userId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      createdAt: Date.now(),
      expiresAt,
      maxDownloads: config.maxDownloads,
      currentDownloads: 0,
      isExpired: false,
      summary: summary || undefined,
      isPublic: true,
      publicId,
    };

    // Upload to R2
    await storage.uploadFile(userId, fileId, file, metadata);

    // Create public reference
    await storage.createPublicReference(publicId, userId, fileId);

    const shareUrl = `https://send.huny.dev/#${publicId}`;

    const response: UploadResponse = {
      fileId,
      publicId,
      shareUrl,
    };

    return new Response(JSON.stringify({ success: true, data: response }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function getFileMetadata(
  fileId: string,
  userId: string,
  storage: R2StorageService
): Promise<Response> {
  try {
    const metadata = await storage.getFileMetadata(userId, fileId);
    
    if (!metadata) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data: metadata }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get metadata error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get file metadata' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function deleteFile(
  fileId: string,
  userId: string,
  storage: R2StorageService
): Promise<Response> {
  try {
    // Get metadata first to find publicId
    const metadata = await storage.getFileMetadata(userId, fileId);
    
    if (!metadata) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete file and public reference
    await storage.deleteFile(userId, fileId);
    if (metadata.publicId) {
      await storage.deletePublicReference(metadata.publicId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function downloadFileAsOwner(
  fileId: string,
  userId: string,
  storage: R2StorageService
): Promise<Response> {
  try {
    const result = await storage.getFileData(userId, fileId);
    
    if (!result) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, metadata } = result;

    return new Response(data, {
      headers: {
        'Content-Type': metadata.type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(metadata.name)}"`,
        'Content-Length': metadata.size.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return new Response(JSON.stringify({ error: 'Failed to download file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function generateId(): string {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
