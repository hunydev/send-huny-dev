import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminDashboard from './components/AdminDashboard';
import PublicDownload from './components/PublicDownload';
import GuestDashboard from './components/GuestDashboard';
import Login from './components/Login';
import { AppView, AuthState } from './types';
import { authService } from './services/authService';

const AUTH_SERVER = 'https://auth.huny.dev';
const CLIENT_ID = 'client_HRENw26wlSsgG4HfrAGjqMMw';

// Refresh token 5 minutes before expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

const App: React.FC = () => {
  const refreshTimeoutRef = useRef<number | null>(null);
  
  // Check for hash-based public download route immediately
  const initialHash = window.location.hash.substring(1);
  const initialFileId = initialHash || null;
  
  const [currentView, setCurrentView] = useState<AppView>(() => {
    // If there's a hash, show public download immediately (no flash)
    if (initialHash) {
      return AppView.PUBLIC_DOWNLOAD;
    }
    // Otherwise, determine based on auth state
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    if (token && userStr) {
      return AppView.ADMIN_DASHBOARD;
    }
    return AppView.LOGIN;
  });
  
  const [targetFileId, setTargetFileId] = useState<string | null>(initialFileId);
  const [auth, setAuth] = useState<AuthState>(() => {
    // Restore auth state from localStorage (persists across tabs)
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        return { isAuthenticated: true, isGuest: false, token, user };
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    return { isAuthenticated: false, isGuest: false };
  });

  // Token refresh function
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem('auth_refresh_token');
    if (!refreshToken) {
      console.log('No refresh token available');
      return false;
    }

    try {
      const response = await fetch(`${AUTH_SERVER}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: CLIENT_ID,
        }),
      });

      if (!response.ok) {
        console.error('Token refresh failed:', response.status);
        // Clear auth state on refresh failure
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_refresh_token');
        localStorage.removeItem('auth_expires_at');
        setAuth({ isAuthenticated: false, isGuest: false });
        setCurrentView(AppView.LOGIN);
        return false;
      }

      const tokens = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      
      // Update localStorage
      localStorage.setItem('auth_token', tokens.access_token);
      if (tokens.refresh_token) {
        localStorage.setItem('auth_refresh_token', tokens.refresh_token);
      }
      if (tokens.expires_in) {
        localStorage.setItem('auth_expires_at', String(Date.now() + (tokens.expires_in * 1000)));
      }

      // Update auth state
      setAuth(prev => ({
        ...prev,
        token: tokens.access_token,
      }));

      console.log('Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }, []);

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback(() => {
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    const expiresAtStr = localStorage.getItem('auth_expires_at');
    if (!expiresAtStr) return;

    const expiresAt = parseInt(expiresAtStr, 10);
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const timeUntilRefresh = timeUntilExpiry - REFRESH_BUFFER_MS;

    if (timeUntilRefresh <= 0) {
      // Token is expired or about to expire, refresh immediately
      refreshAccessToken().then(success => {
        if (success) {
          scheduleTokenRefresh();
        }
      });
    } else {
      // Schedule refresh
      console.log(`Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000)} seconds`);
      refreshTimeoutRef.current = window.setTimeout(async () => {
        const success = await refreshAccessToken();
        if (success) {
          scheduleTokenRefresh();
        }
      }, timeUntilRefresh);
    }
  }, [refreshAccessToken]);

  // Setup token refresh on mount and when auth changes
  useEffect(() => {
    if (auth.isAuthenticated) {
      scheduleTokenRefresh();
    }

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [auth.isAuthenticated, scheduleTokenRefresh]);

  // Check token validity when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && auth.isAuthenticated) {
        const expiresAtStr = localStorage.getItem('auth_expires_at');
        if (expiresAtStr) {
          const expiresAt = parseInt(expiresAtStr, 10);
          const now = Date.now();
          
          // If token is expired or will expire within the buffer time
          if (expiresAt - now <= REFRESH_BUFFER_MS) {
            console.log('Token expired or expiring soon, refreshing on visibility change...');
            const success = await refreshAccessToken();
            if (success) {
              scheduleTokenRefresh();
            }
          } else {
            // Re-schedule refresh (timer may have drifted while tab was hidden)
            scheduleTokenRefresh();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [auth.isAuthenticated, refreshAccessToken, scheduleTokenRefresh]);

  // Listen for auth events from apiStorage
  useEffect(() => {
    const handleAuthFailed = () => {
      console.log('Auth failed event received, logging out...');
      setAuth({ isAuthenticated: false, isGuest: false, token: undefined, user: undefined });
      setCurrentView(AppView.LOGIN);
    };

    const handleTokenRefreshed = (event: CustomEvent<{ token: string }>) => {
      console.log('Token refreshed event received');
      setAuth(prev => ({
        ...prev,
        token: event.detail.token,
      }));
      // Re-schedule the refresh timer
      scheduleTokenRefresh();
    };

    window.addEventListener('authFailed', handleAuthFailed);
    window.addEventListener('tokenRefreshed', handleTokenRefreshed as EventListener);
    
    return () => {
      window.removeEventListener('authFailed', handleAuthFailed);
      window.removeEventListener('tokenRefreshed', handleTokenRefreshed as EventListener);
    };
  }, [scheduleTokenRefresh]);

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
        // Store in localStorage for persistence across tabs
        localStorage.setItem('auth_token', event.data.token);
        localStorage.setItem('auth_user', JSON.stringify(event.data.user));
        if (event.data.refreshToken) {
          localStorage.setItem('auth_refresh_token', event.data.refreshToken);
        }
        if (event.data.expiresIn) {
          localStorage.setItem('auth_expires_at', String(Date.now() + (event.data.expiresIn * 1000)));
        }
        
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
    // Clear localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('auth_expires_at');
    
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