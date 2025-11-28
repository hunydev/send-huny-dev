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
  const codeVerifier = url.searchParams.get('code_verifier');

  if (!code) {
    return redirectWithError('Missing authorization code');
  }

  try {
    // Exchange code for tokens
    // Note: code_verifier should be passed from the client since it's stored in sessionStorage
    // For server-side callback, the client needs to include it somehow
    // Option 1: Pass via state (encoded)
    // Option 2: Client calls this endpoint with code_verifier as query param
    
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: CALLBACK_URI,
      client_id: env.CLIENT_ID,
    };

    // If code_verifier is provided (from client), use it
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
    }

    // If we have client secret (confidential client), use it
    if (env.CLIENT_SECRET) {
      tokenParams.client_secret = env.CLIENT_SECRET;
    }

    const tokenResponse = await fetch(`${env.AUTH_SERVER}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return redirectWithError('Token exchange failed');
    }

    const tokens = await tokenResponse.json() as { access_token: string; refresh_token?: string };

    // Fetch user info
    const userResponse = await fetch(`${env.AUTH_SERVER}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      return redirectWithError('Failed to fetch user info');
    }

    const user = await userResponse.json() as User;

    // Return HTML that sends message to parent window and closes
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Successful</title>
</head>
<body>
  <script>
    const authData = {
      type: 'AUTH_SUCCESS',
      token: ${JSON.stringify(tokens.access_token)},
      user: ${JSON.stringify(user)}
    };
    
    if (window.opener) {
      window.opener.postMessage(authData, '${url.origin}');
      window.close();
    } else {
      // Fallback: redirect to main app with token in hash
      window.location.href = '/#auth=' + encodeURIComponent(JSON.stringify(authData));
    }
  </script>
  <p>Authentication successful. This window should close automatically.</p>
  <p>If it doesn't, <a href="/">click here to continue</a>.</p>
</body>
</html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Callback error:', error);
    return redirectWithError('Authentication failed');
  }
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
