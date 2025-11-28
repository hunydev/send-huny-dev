import { FileMetadata } from '../types.ts';

/**
 * R2 Storage Structure:
 * 
 * users/{userId}/files/{fileId}/data     - Actual file content
 * users/{userId}/files/{fileId}/meta     - File metadata (JSON)
 * users/{userId}/index                    - User's file list (JSON array of fileIds)
 * public/{publicId}                       - Public reference (JSON: {userId, fileId})
 */

export interface PublicReference {
  userId: string;
  fileId: string;
  createdAt: number;
}

export class R2StorageService {
  constructor(private bucket: R2Bucket) {}

  // --- User Files ---

  async uploadFile(
    userId: string,
    fileId: string,
    file: File | Blob | ArrayBuffer | ReadableStream,
    metadata: FileMetadata
  ): Promise<void> {
    const dataKey = `users/${userId}/files/${fileId}/data`;
    const metaKey = `users/${userId}/files/${fileId}/meta`;

    // Upload file data
    await this.bucket.put(dataKey, file, {
      httpMetadata: {
        contentType: metadata.type,
      },
      customMetadata: {
        fileName: metadata.name,
      },
    });

    // Upload metadata
    await this.bucket.put(metaKey, JSON.stringify(metadata), {
      httpMetadata: {
        contentType: 'application/json',
      },
    });

    // Update user's file index
    await this.addToUserIndex(userId, fileId);
  }

  async getFileMetadata(userId: string, fileId: string): Promise<FileMetadata | null> {
    const metaKey = `users/${userId}/files/${fileId}/meta`;
    const object = await this.bucket.get(metaKey);
    
    if (!object) {
      return null;
    }

    const text = await object.text();
    return JSON.parse(text) as FileMetadata;
  }

  async updateFileMetadata(userId: string, fileId: string, metadata: FileMetadata): Promise<void> {
    const metaKey = `users/${userId}/files/${fileId}/meta`;
    await this.bucket.put(metaKey, JSON.stringify(metadata), {
      httpMetadata: {
        contentType: 'application/json',
      },
    });
  }

  async getFileData(
    userId: string,
    fileId: string
  ): Promise<{ data: ReadableStream; metadata: FileMetadata } | null> {
    const metadata = await this.getFileMetadata(userId, fileId);
    if (!metadata) {
      return null;
    }

    const dataKey = `users/${userId}/files/${fileId}/data`;
    const object = await this.bucket.get(dataKey);
    
    if (!object || !object.body) {
      return null;
    }

    return {
      data: object.body,
      metadata,
    };
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    const dataKey = `users/${userId}/files/${fileId}/data`;
    const metaKey = `users/${userId}/files/${fileId}/meta`;

    await Promise.all([
      this.bucket.delete(dataKey),
      this.bucket.delete(metaKey),
    ]);

    await this.removeFromUserIndex(userId, fileId);
  }

  async listUserFiles(userId: string): Promise<FileMetadata[]> {
    const indexKey = `users/${userId}/index`;
    const indexObject = await this.bucket.get(indexKey);
    
    if (!indexObject) {
      return [];
    }

    const fileIds: string[] = JSON.parse(await indexObject.text());
    
    // Fetch all metadata in parallel
    const metadataPromises = fileIds.map(fileId => this.getFileMetadata(userId, fileId));
    const results = await Promise.all(metadataPromises);
    
    // Filter out nulls (deleted files)
    return results.filter((m): m is FileMetadata => m !== null);
  }

  // --- User Index Management ---

  private async getUserIndex(userId: string): Promise<string[]> {
    const indexKey = `users/${userId}/index`;
    const object = await this.bucket.get(indexKey);
    
    if (!object) {
      return [];
    }

    return JSON.parse(await object.text());
  }

  private async saveUserIndex(userId: string, fileIds: string[]): Promise<void> {
    const indexKey = `users/${userId}/index`;
    await this.bucket.put(indexKey, JSON.stringify(fileIds), {
      httpMetadata: {
        contentType: 'application/json',
      },
    });
  }

  private async addToUserIndex(userId: string, fileId: string): Promise<void> {
    const fileIds = await this.getUserIndex(userId);
    if (!fileIds.includes(fileId)) {
      fileIds.push(fileId);
      await this.saveUserIndex(userId, fileIds);
    }
  }

  private async removeFromUserIndex(userId: string, fileId: string): Promise<void> {
    const fileIds = await this.getUserIndex(userId);
    const index = fileIds.indexOf(fileId);
    if (index !== -1) {
      fileIds.splice(index, 1);
      await this.saveUserIndex(userId, fileIds);
    }
  }

  // --- Public References ---

  async createPublicReference(publicId: string, userId: string, fileId: string): Promise<void> {
    const key = `public/${publicId}`;
    const ref: PublicReference = {
      userId,
      fileId,
      createdAt: Date.now(),
    };
    
    await this.bucket.put(key, JSON.stringify(ref), {
      httpMetadata: {
        contentType: 'application/json',
      },
    });
  }

  async getPublicReference(publicId: string): Promise<PublicReference | null> {
    const key = `public/${publicId}`;
    const object = await this.bucket.get(key);
    
    if (!object) {
      return null;
    }

    return JSON.parse(await object.text()) as PublicReference;
  }

  async deletePublicReference(publicId: string): Promise<void> {
    const key = `public/${publicId}`;
    await this.bucket.delete(key);
  }
}
