import React, { useEffect, useState } from 'react';
import { listFiles, deleteFile, AuthError } from '../services/apiStorage';
import { SharedFile, User } from '../types';
import FileUpload from './FileUpload';
import { Trash2, Copy, ExternalLink, Download, Clock, ShieldCheck, RefreshCw, LogOut, Check, AlertCircle } from 'lucide-react';

interface AdminDashboardProps {
  user?: User;
  onNavigateToPublic: (id: string) => void;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onNavigateToPublic, onLogout }) => {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAuthError = (error: unknown) => {
    if (error instanceof AuthError) {
      showToast('Session expired. Please login again.', 'error');
      setTimeout(() => onLogout(), 1500);
      return true;
    }
    return false;
  };

  const refreshFiles = async () => {
    setLoading(true);
    try {
      const data = await listFiles();
      // Sort by createdAt desc
      setFiles(data.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      if (!handleAuthError(error)) {
        showToast('Failed to load files.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshFiles();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        await deleteFile(id);
        showToast('File deleted successfully.');
        refreshFiles();
      } catch (error) {
        if (!handleAuthError(error)) {
          showToast('Failed to delete file.', 'error');
        }
      }
    }
  };

  const getPublicId = (file: SharedFile): string => {
    return (file as any).publicId || file.id;
  };

  const copyLink = (file: SharedFile) => {
    const publicId = getPublicId(file);
    const url = `${window.location.origin}/#${publicId}`;
    navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard!', 'success');
  };

  const openPublicView = (file: SharedFile) => {
    const publicId = getPublicId(file);
    window.open(`${window.location.origin}/#${publicId}`, '_blank');
  };

  const getExpirationText = (file: SharedFile) => {
    if (file.isExpired) return "Expired";
    if (file.currentDownloads >= file.maxDownloads) return "Limit Reached";
    
    if (file.expiresAt) {
      const minsLeft = Math.ceil((file.expiresAt - Date.now()) / 60000);
      if (minsLeft < 0) return "Expired";
      if (minsLeft < 60) return `${minsLeft} mins left`;
      return `${Math.ceil(minsLeft / 60)} hours left`;
    }
    
    return "Indefinite";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">{user?.name || 'Admin User'}</p>
            <p className="text-xs text-slate-500">{user?.email || 'admin@huny.dev'}</p>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Upload */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg">
              <h2 className="text-xl font-bold mb-2">SendSecure AI</h2>
              <p className="text-indigo-100 text-sm mb-6">
                Share files privately. They expire automatically.
              </p>
              <div className="flex items-center gap-2 text-xs font-medium bg-white/10 p-2 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Secure Admin Session</span>
              </div>
            </div>
            
            <FileUpload onUploadComplete={refreshFiles} onAuthError={onLogout} />
          </div>
        </div>

        {/* Right Column: List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Active Files</h2>
              <button 
                onClick={refreshFiles}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {files.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <ExternalLink className="w-8 h-8 opacity-50" />
                </div>
                <p>No active files found.</p>
                <p className="text-sm">Upload a file to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {files.map((file) => (
                  <div key={file.id} className={`p-4 transition-colors ${file.isExpired ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 p-2 bg-indigo-50 rounded-lg">
                          <Download className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900">{file.name}</h3>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {getExpirationText(file)}
                            </span>
                            <span>•</span>
                            <span>{file.currentDownloads} / {file.maxDownloads} downloads</span>
                            <span>•</span>
                            <span>{(file.size / 1024).toFixed(1)} KB</span>
                          </div>
                          {file.summary && (
                            <div className="mt-2 text-xs text-slate-600 bg-slate-100 p-2 rounded border border-slate-200">
                              <span className="font-semibold text-indigo-600">AI Summary: </span>
                              {file.summary}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                         <button 
                          onClick={() => copyLink(file)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Copy Link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openPublicView(file)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Open Public Page in New Tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(file.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${
            toast.type === 'error' 
              ? 'bg-red-600 text-white' 
              : 'bg-slate-900 text-white'
          }`}>
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-200" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;