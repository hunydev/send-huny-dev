import { SharedFile, FileConfig } from '../types';

const STORAGE_KEY = 'sendsecure_files_db';

// Helper to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to generate ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const loadDb = (): SharedFile[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveDb = (files: SharedFile[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
};

export const uploadFileToStorage = async (
  file: File, 
  config: FileConfig, 
  aiSummary?: string
): Promise<SharedFile> => {
  await delay(800); // Simulate network

  // Convert to base64 for local demo storage (LIMITATION: Small files only for demo)
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  const expiresAt = config.expiresInMinutes > 0 
    ? Date.now() + config.expiresInMinutes * 60 * 1000 
    : null;

  const newFile: SharedFile = {
    id: generateId(),
    name: file.name,
    size: file.size,
    type: file.type,
    createdAt: Date.now(),
    expiresAt,
    maxDownloads: config.maxDownloads,
    currentDownloads: 0,
    isExpired: false,
    summary: aiSummary,
    blobData: base64
  };

  const db = loadDb();
  db.push(newFile);
  saveDb(db);

  return newFile;
};

export const getFileMetadata = async (fileId: string): Promise<SharedFile | null> => {
  await delay(300);
  const db = loadDb();
  const file = db.find(f => f.id === fileId);
  
  if (!file) return null;

  // Check expiration logic
  const timeExpired = file.expiresAt && Date.now() > file.expiresAt;
  const downloadsExpired = file.currentDownloads >= file.maxDownloads;

  if ((timeExpired || downloadsExpired) && !file.isExpired) {
    file.isExpired = true;
    saveDb(db); // Update status
  }

  return file;
};

export const incrementDownloadCount = async (fileId: string): Promise<void> => {
  const db = loadDb();
  const index = db.findIndex(f => f.id === fileId);
  if (index !== -1) {
    db[index].currentDownloads += 1;
    saveDb(db);
  }
};

export const deleteFile = async (fileId: string): Promise<void> => {
  await delay(200);
  let db = loadDb();
  db = db.filter(f => f.id !== fileId);
  saveDb(db);
};

export const listFiles = async (): Promise<SharedFile[]> => {
  await delay(200);
  const db = loadDb();
  // Filter out expired for list view if desired, or keep them to show history
  // Here we update status real-time
  const now = Date.now();
  return db.map(f => {
    const timeExpired = f.expiresAt && now > f.expiresAt;
    const downloadsExpired = f.currentDownloads >= f.maxDownloads;
    return {
      ...f,
      isExpired: f.isExpired || !!timeExpired || downloadsExpired
    };
  });
};