import { Env, User, AuthCallbackResponse } from '../types.ts';

const CALLBACK_URI = 'https://send.huny.dev/api/auth/callback';

export async function handleAuthRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  if (path === '/api/auth/callback' && request.method === 'GET') {
    return handleCallback(request, env);
  }

  if (path === '/api/auth/userinfo' && request.method === 'GET') {
    return handleUserInfo(request, env);
  }

  if (path === '/api/auth/logout' && request.method === 'POST') {
    return handleLogout(request, env);
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return redirectWithError('Missing authorization code');
  }

  // Return HTML that handles token exchange on client side
  // This allows access to sessionStorage where code_verifier is stored
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Authenticating...</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; }
    .container { text-align: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Completing authentication...</p>
  </div>
  <script>
    (async function() {
      const code = ${JSON.stringify(code)};
      const state = ${JSON.stringify(state)};
      const origin = ${JSON.stringify(url.origin)};
      
      const savedState = sessionStorage.getItem('oauth_state');
      const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
      
      // Validate state
      if (state !== savedState) {
        sendError('State mismatch - possible CSRF attack');
        return;
      }
      
      if (!codeVerifier) {
        sendError('Missing code verifier - please try logging in again');
        return;
      }
      
      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('${env.AUTH_SERVER}/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: '${CALLBACK_URI}',
            client_id: '${env.CLIENT_ID}',
            code_verifier: codeVerifier,
          }),
        });
        
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('Token exchange failed:', errorText);
          sendError('Token exchange failed');
          return;
        }
        
        const tokens = await tokenResponse.json();
        
        // Fetch user info
        const userResponse = await fetch('${env.AUTH_SERVER}/oauth/userinfo', {
          headers: { Authorization: 'Bearer ' + tokens.access_token },
        });
        
        if (!userResponse.ok) {
          sendError('Failed to fetch user info');
          return;
        }
        
        const user = await userResponse.json();
        
        // Clean up PKCE data (stays in sessionStorage for security)
        sessionStorage.removeItem('pkce_code_verifier');
        sessionStorage.removeItem('oauth_state');
        
        // Send success to opener
        const authData = {
          type: 'AUTH_SUCCESS',
          token: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          user: user
        };
        
        if (window.opener) {
          window.opener.postMessage(authData, origin);
          window.close();
        } else {
          // Store in localStorage (persists across tabs) and redirect
          localStorage.setItem('auth_token', tokens.access_token);
          localStorage.setItem('auth_refresh_token', tokens.refresh_token);
          localStorage.setItem('auth_expires_at', String(Date.now() + (tokens.expires_in * 1000)));
          localStorage.setItem('auth_user', JSON.stringify(user));
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Auth error:', error);
        sendError('Authentication failed: ' + error.message);
      }
      
      function sendError(message) {
        if (window.opener) {
          window.opener.postMessage({ type: 'AUTH_ERROR', error: message }, origin);
          window.close();
        } else {
          window.location.href = '/?error=' + encodeURIComponent(message);
        }
      }
    })();
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

function redirectWithError(error: string): Response {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'AUTH_ERROR',
        error: ${JSON.stringify(error)}
      }, '*');
      window.close();
    } else {
      window.location.href = '/?error=' + encodeURIComponent(${JSON.stringify(error)});
    }
  </script>
  <p>Authentication failed: ${error}</p>
  <p><a href="/">Return to login</a></p>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

async function handleUserInfo(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.slice(7);

  try {
    // Validate token by fetching user info from auth server
    const response = await fetch(`${env.AUTH_SERVER}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = await response.json();
    return new Response(JSON.stringify({ success: true, data: user }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to validate token' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.slice(7);

  try {
    // Revoke token at auth server
    await fetch(`${env.AUTH_SERVER}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  } catch (error) {
    console.error('Token revocation failed:', error);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Helper to extract user from request
export async function getUserFromRequest(request: Request, env: Env): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const response = await fetch(`${env.AUTH_SERVER}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as User;
  } catch {
    return null;
  }
}
