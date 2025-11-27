import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard';
import PublicDownload from './components/PublicDownload';
import { AppView } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.ADMIN_DASHBOARD);
  const [targetFileId, setTargetFileId] = useState<string | null>(null);

  useEffect(() => {
    // Simple hash based routing to support link sharing
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1); // Remove #
      if (hash) {
        setTargetFileId(hash);
        setCurrentView(AppView.PUBLIC_DOWNLOAD);
      } else {
        setTargetFileId(null);
        setCurrentView(AppView.ADMIN_DASHBOARD);
      }
    };

    // Initial check
    handleHashChange();

    // Listen
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToPublic = (id: string) => {
    window.location.hash = id;
  };

  const navigateToAdmin = () => {
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
    setTargetFileId(null);
    setCurrentView(AppView.ADMIN_DASHBOARD);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {currentView === AppView.ADMIN_DASHBOARD && (
        <AdminDashboard onNavigateToPublic={navigateToPublic} />
      )}
      
      {currentView === AppView.PUBLIC_DOWNLOAD && targetFileId && (
        <PublicDownload 
          fileId={targetFileId} 
          onBack={navigateToAdmin}
        />
      )}
    </div>
  );
};

export default App;