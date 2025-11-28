import React, { useState } from 'react';
import { Download, Search, LogOut, FileText } from 'lucide-react';

interface GuestDashboardProps {
  onNavigateToFile: (id: string) => void;
  onLogout: () => void;
}

const GuestDashboard: React.FC<GuestDashboardProps> = ({ onNavigateToFile, onLogout }) => {
  const [inputId, setInputId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputId.trim()) {
      onNavigateToFile(inputId.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
           <div className="bg-indigo-600 p-1.5 rounded-lg">
             <Download className="w-4 h-4 text-white" />
           </div>
           <span className="font-bold text-slate-800 tracking-tight">SendSecure</span>
        </div>
        <button 
          onClick={onLogout}
          className="text-sm text-slate-500 hover:text-red-600 flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Guest Access</h1>
            <p className="text-slate-500">
              You are logged in as a guest. To download a file, please open a shared link or enter the File ID below.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="file-id" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Manual File Retrieval
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    id="file-id"
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow"
                    placeholder="Enter File ID (e.g., xyz123...)"
                    value={inputId}
                    onChange={(e) => setInputId(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
              >
                <FileText className="w-4 h-4" />
                Find File
              </button>
            </form>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
               <span>💡 Tip:</span>
               Ask the sender for the direct sharing link for easier access.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestDashboard;