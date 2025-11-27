import React, { useEffect, useState } from 'react';
import { getFileMetadata, incrementDownloadCount } from '../services/mockStorage';
import { SharedFile } from '../types';
import { Download, FileText, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react';

interface PublicDownloadProps {
  fileId: string;
  onBack: () => void;
}

const PublicDownload: React.FC<PublicDownloadProps> = ({ fileId, onBack }) => {
  const [file, setFile] = useState<SharedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const fetchFile = async () => {
      setLoading(true);
      try {
        const data = await getFileMetadata(fileId);
        if (!data) {
          setError("File not found.");
        } else if (data.isExpired) {
          setError("This link has expired.");
          setFile(data); // Keep metadata to show name if desired
        } else {
          setFile(data);
        }
      } catch (err) {
        setError("Error loading file.");
      } finally {
        setLoading(false);
      }
    };
    fetchFile();
  }, [fileId]);

  const handleDownload = async () => {
    if (!file || !file.blobData) return;
    
    // Simulate download trigger
    const link = document.createElement('a');
    link.href = file.blobData;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Update server state
    await incrementDownloadCount(file.id);
    setDownloaded(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 relative">
      <button 
        onClick={onBack}
        className="absolute top-6 right-6 text-sm text-slate-400 hover:text-slate-600"
      >
        Wait, I'm the Admin
      </button>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-center">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4">
            <Download className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">SendSecure</h1>
          <p className="text-indigo-100 text-sm">Secure, ephemeral file delivery.</p>
        </div>

        {/* Content */}
        <div className="p-8">
          {error && !file?.isExpired ? (
             <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Unavailable</h3>
                <p className="text-slate-500">{error}</p>
             </div>
          ) : (file?.isExpired) ? (
            <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Link Expired</h3>
                <p className="text-slate-500 text-sm mb-6">
                  This file is no longer available. It has reached its download limit or time expiration.
                </p>
                {file && (
                  <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-400">
                    Previously: {file.name}
                  </div>
                )}
             </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="min-w-0">
                   <h3 className="font-medium text-slate-900 truncate" title={file!.name}>{file!.name}</h3>
                   <p className="text-xs text-slate-500">{(file!.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>

              {file!.summary && (
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-4 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">AI Summary</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {file!.summary}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                 <button
                  onClick={handleDownload}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download File
                </button>
                
                <p className="text-center text-xs text-slate-400">
                   {file!.maxDownloads - file!.currentDownloads} downloads remaining
                </p>
              </div>

              {downloaded && (
                 <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg animate-fade-in">
                    <CheckCircle className="w-4 h-4" />
                    Download started!
                 </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-slate-50 p-4 text-center border-t border-slate-200">
           <p className="text-xs text-slate-400">Powered by SendSecure & Gemini</p>
        </div>
      </div>
    </div>
  );
};

export default PublicDownload;