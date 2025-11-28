import React, { useState, useCallback } from 'react';
import { UploadCloud, FileText, X, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { FileConfig } from '../types';
import { uploadFileToStorage } from '../services/apiStorage';
import { generateFileSummary } from '../services/geminiService';

interface FileUploadProps {
  onUploadComplete: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<FileConfig>({
    maxDownloads: 1,
    expiresInMinutes: 60 * 24, // 1 day default
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);

    try {
      let summary = undefined;
      
      // Only attempt summary for text-based files
      if (useAI && (selectedFile.type.startsWith('text/') || selectedFile.name.endsWith('.md') || selectedFile.name.endsWith('.json') || selectedFile.name.endsWith('.csv'))) {
         summary = await generateFileSummary(selectedFile);
      } else if (useAI) {
        summary = "AI Summary skipped (File type not supported for text extraction in demo).";
      }

      await uploadFileToStorage(selectedFile, config, summary);
      
      // Reset
      setSelectedFile(null);
      setUseAI(false);
      onUploadComplete();
    } catch (err) {
      console.error(err);
      setError("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <UploadCloud className="w-5 h-5 text-indigo-600" />
        Upload Files
      </h2>

      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ease-in-out
            ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}
          `}
        >
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileSelect}
          />
          <div className="flex flex-col items-center pointer-events-none">
            <UploadCloud className={`w-12 h-12 mb-3 ${isDragging ? 'text-indigo-600' : 'text-slate-400'}`} />
            <p className="text-sm font-medium text-slate-700">
              Drag and drop a file here, or click to browse
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Any file type allowed (Max 5MB for demo)
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Selected File Card */}
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-white rounded-lg border border-slate-200 shrink-0">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedFile(null)}
              className="p-1 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Download Limit
              </label>
              <select
                value={config.maxDownloads}
                onChange={(e) => setConfig({ ...config, maxDownloads: Number(e.target.value) })}
                className="w-full rounded-lg border-slate-300 border text-sm py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value={1}>1 download</option>
                <option value={2}>2 downloads</option>
                <option value={5}>5 downloads</option>
                <option value={10}>10 downloads</option>
                <option value={100}>100 downloads</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Expires After
              </label>
              <select
                value={config.expiresInMinutes}
                onChange={(e) => setConfig({ ...config, expiresInMinutes: Number(e.target.value) })}
                className="w-full rounded-lg border-slate-300 border text-sm py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value={5}>5 minutes</option>
                <option value={60}>1 hour</option>
                <option value={1440}>1 day</option>
                <option value={10080}>7 days</option>
              </select>
            </div>
          </div>

          {/* AI Toggle */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-indigo-100 bg-indigo-50/50">
            <div className="flex items-center h-5">
              <input
                id="ai-summary"
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>
            <div className="ml-1 text-sm">
              <label htmlFor="ai-summary" className="font-medium text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Generate Smart Summary
              </label>
              <p className="text-indigo-700/80 text-xs">
                Use Gemini to analyze and describe the file content for the recipient.
              </p>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className={`
              w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all
              ${isUploading 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow'
              }
            `}
          >
            {isUploading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                Upload & Create Link
              </>
            )}
          </button>
          
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUpload;