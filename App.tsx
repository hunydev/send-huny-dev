import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard';
import PublicDownload from './components/PublicDownload';
import GuestDashboard from './components/GuestDashboard';
import Login from './components/Login';
import { AppView, AuthState } from './types';
import { authService } from './services/authService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);
  const [targetFileId, setTargetFileId] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState>(() => {
    // Restore auth state from sessionStorage
    const token = sessionStorage.getItem('auth_token');
    const userStr = sessionStorage.getItem('auth_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        return { isAuthenticated: true, isGuest: false, token, user };
      } catch {
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_user');
      }
    }
    return { isAuthenticated: false, isGuest: false };
  });

  useEffect(() => {
    // 1. Handle OAuth Callback (Popup context)
    // If this window was opened by the main app, it will have 'code' in params
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      setCurrentView(AppView.CALLBACK);
      authService.handleCallback()
        .then(({ accessToken, user }) => {
          // Notify opener (Main App)
          if (window.opener) {
            window.opener.postMessage({
              type: 'AUTH_SUCCESS',
              token: accessToken,
              user: user
            }, '*'); // In production, replace '*' with specific origin
            window.close();
          } else {
             // Fallback if not opened via popup (e.g. direct redirect)
             setAuth({ isAuthenticated: true, isGuest: false, token: accessToken, user });
             window.history.replaceState({}, document.title, window.location.pathname);
             setCurrentView(AppView.ADMIN_DASHBOARD);
          }
        })
        .catch(err => {
          console.error("Auth callback error:", err);
          if (window.opener) {
            window.opener.postMessage({ type: 'AUTH_ERROR', error: err.message }, '*');
            window.close();
          } else {
             alert("Login failed. See console.");
             setCurrentView(AppView.LOGIN);
          }
        });
        return; // Stop further processing in callback mode
    }

    // 2. Handle Message Listener (Main App context)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AUTH_SUCCESS') {
        // Store in sessionStorage for persistence and API calls
        sessionStorage.setItem('auth_token', event.data.token);
        sessionStorage.setItem('auth_user', JSON.stringify(event.data.user));
        
        setAuth({
          isAuthenticated: true,
          isGuest: false,
          token: event.data.token,
          user: event.data.user
        });
        setCurrentView(AppView.ADMIN_DASHBOARD);
      } else if (event.data?.type === 'AUTH_ERROR') {
        alert("Authentication failed: " + event.data.error);
      }
    };
    window.addEventListener('message', handleMessage);


    // 3. Handle Routing (Hash based for file downloads)
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1); // Remove #
      if (hash) {
        setTargetFileId(hash);
        setCurrentView(AppView.PUBLIC_DOWNLOAD);
      } else {
        setTargetFileId(null);
        // Routing logic based on auth state
        if (auth.isAuthenticated) {
          setCurrentView(AppView.ADMIN_DASHBOARD);
        } else if (auth.isGuest) {
          setCurrentView(AppView.GUEST_HOME);
        } else {
          setCurrentView(AppView.LOGIN);
        }
      }
    };

    // Initial routing check
    // If not in callback mode
    if (!code) {
      handleHashChange();
    }

    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [auth.isAuthenticated, auth.isGuest]);

  // Effect to redirect to login if not authenticated and not viewing a public file
  useEffect(() => {
    // If trying to access admin dashboard without auth
    if (currentView === AppView.ADMIN_DASHBOARD && !auth.isAuthenticated) {
      setCurrentView(AppView.LOGIN);
    }
    // If trying to access guest home without guest auth (and not admin)
    if (currentView === AppView.GUEST_HOME && !auth.isGuest && !auth.isAuthenticated) {
      setCurrentView(AppView.LOGIN);
    }
  }, [currentView, auth.isAuthenticated, auth.isGuest]);


  const navigateToPublic = (id: string) => {
    window.location.hash = id;
  };

  const navigateToAdmin = () => {
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
    setTargetFileId(null);
    if (auth.isAuthenticated) {
      setCurrentView(AppView.ADMIN_DASHBOARD);
    } else if (auth.isGuest) {
      setCurrentView(AppView.GUEST_HOME);
    } else {
      setCurrentView(AppView.LOGIN);
    }
  };

  const handleGuestLogin = () => {
    setAuth({ ...auth, isGuest: true });
    // If there is a hash (user arrived via link but was forced to login), view will update via hashchange or effect
    if (targetFileId) {
      setCurrentView(AppView.PUBLIC_DOWNLOAD);
    } else {
      setCurrentView(AppView.GUEST_HOME);
    }
  };

  const handleLogout = async () => {
    if (auth.token) {
      await authService.logout(auth.token);
    }
    // Clear sessionStorage
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    
    setAuth({ isAuthenticated: false, isGuest: false, token: undefined, user: undefined });
    setCurrentView(AppView.LOGIN);
    // Clear hash if any, to prevent immediate re-routing to download if they want to fully logout
    // window.location.hash = ''; 
  };

  if (currentView === AppView.CALLBACK) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
           <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
           <p className="text-slate-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {currentView === AppView.LOGIN && (
        <Login onGuestLogin={handleGuestLogin} />
      )}

      {currentView === AppView.ADMIN_DASHBOARD && auth.isAuthenticated && (
        <AdminDashboard 
          user={auth.user}
          onNavigateToPublic={navigateToPublic} 
          onLogout={handleLogout}
        />
      )}
      
      {currentView === AppView.GUEST_HOME && auth.isGuest && (
        <GuestDashboard 
          onNavigateToFile={navigateToPublic}
          onLogout={handleLogout}
        />
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