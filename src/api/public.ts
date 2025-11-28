import { Env, FileMetadata } from '../types.ts';
import { R2StorageService } from '../services/r2Storage.ts';

export async function handlePublicRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const storage = new R2StorageService(env.STORAGE);

  // GET /api/public/:publicId - Get public file metadata
  const metadataMatch = path.match(/^\/api\/public\/([^/]+)$/);
  if (metadataMatch && request.method === 'GET') {
    const publicId = metadataMatch[1];
    return getPublicFileMetadata(publicId, storage);
  }

  // GET /api/public/:publicId/download - Download public file
  const downloadMatch = path.match(/^\/api\/public\/([^/]+)\/download$/);
  if (downloadMatch && request.method === 'GET') {
    const publicId = downloadMatch[1];
    return downloadPublicFile(publicId, storage);
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getPublicFileMetadata(
  publicId: string,
  storage: R2StorageService
): Promise<Response> {
  try {
    // Get public reference
    const ref = await storage.getPublicReference(publicId);
    
    if (!ref) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'File not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get actual file metadata
    const metadata = await storage.getFileMetadata(ref.userId, ref.fileId);
    
    if (!metadata) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'File not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check expiration
    const now = Date.now();
    const timeExpired = metadata.expiresAt !== null && now > metadata.expiresAt;
    const downloadsExpired = metadata.currentDownloads >= metadata.maxDownloads;
    const isExpired = metadata.isExpired || timeExpired || downloadsExpired;

    if (isExpired) {
      // Update expired status if needed
      if (!metadata.isExpired) {
        metadata.isExpired = true;
        await storage.updateFileMetadata(ref.userId, ref.fileId, metadata);
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'This link has expired',
        data: {
          name: metadata.name,
          isExpired: true,
        }
      }), {
        status: 410, // Gone
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return public-safe metadata (without userId, fileId)
    const publicMetadata = {
      name: metadata.name,
      size: metadata.size,
      type: metadata.type,
      createdAt: metadata.createdAt,
      expiresAt: metadata.expiresAt,
      maxDownloads: metadata.maxDownloads,
      currentDownloads: metadata.currentDownloads,
      remainingDownloads: metadata.maxDownloads - metadata.currentDownloads,
      summary: metadata.summary,
      isExpired: false,
    };

    return new Response(JSON.stringify({ success: true, data: publicMetadata }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get public metadata error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get file info' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function downloadPublicFile(
  publicId: string,
  storage: R2StorageService
): Promise<Response> {
  try {
    // Get public reference
    const ref = await storage.getPublicReference(publicId);
    
    if (!ref) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get file metadata
    const metadata = await storage.getFileMetadata(ref.userId, ref.fileId);
    
    if (!metadata) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check expiration BEFORE download
    const now = Date.now();
    const timeExpired = metadata.expiresAt !== null && now > metadata.expiresAt;
    const downloadsExpired = metadata.currentDownloads >= metadata.maxDownloads;
    
    if (metadata.isExpired || timeExpired || downloadsExpired) {
      return new Response(JSON.stringify({ error: 'This link has expired' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get file data
    const result = await storage.getFileData(ref.userId, ref.fileId);
    
    if (!result) {
      return new Response(JSON.stringify({ error: 'File data not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Increment download count
    metadata.currentDownloads += 1;
    
    // Check if this download causes expiration
    if (metadata.currentDownloads >= metadata.maxDownloads) {
      metadata.isExpired = true;
    }
    
    await storage.updateFileMetadata(ref.userId, ref.fileId, metadata);

    return new Response(result.data, {
      headers: {
        'Content-Type': metadata.type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(metadata.name)}"`,
        'Content-Length': metadata.size.toString(),
        'X-Downloads-Remaining': (metadata.maxDownloads - metadata.currentDownloads).toString(),
      },
    });
  } catch (error) {
    console.error('Download public file error:', error);
    return new Response(JSON.stringify({ error: 'Failed to download file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
