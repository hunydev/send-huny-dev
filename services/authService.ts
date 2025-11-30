import { User } from '../types';

const CLIENT_ID = 'client_HRENw26wlSsgG4HfrAGjqMMw';
const CALLBACK_URI = 'https://send.huny.dev/api/auth/callback';
const AUTH_SERVER = 'https://auth.huny.dev';

// Note: Client Secret is provided but typically not used in SPA PKCE flow for security.
// We adhere to the JS Example provided in the guide which omits it for client-side calls.
// const CLIENT_SECRET = 'secret_xxxxx';

class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // --- PKCE Generators ---

  private base64UrlEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  // --- Auth Flow ---

  public async initiateLoginPopup(): Promise<void> {
    // Clear any previous PKCE data before starting a new login flow
    // This fixes the issue where switching from account A to B fails
    // due to stale state/code_verifier from previous login attempt
    sessionStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('oauth_state');
    
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();

    // Store verifier and state in Session Storage (shared with popup if same domain, 
    // but essential for validation when popup redirects back to callback)
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: CALLBACK_URI,
      scope: 'openid profile email',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const url = `${AUTH_SERVER}/oauth/authorize?${params.toString()}`;
    
    // Open the popup
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      url, 
      'HunyDevSSO', 
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
    );
  }

  public async handleCallback(): Promise<{ accessToken: string, user: User }> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    const savedState = sessionStorage.getItem('oauth_state');
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier');

    if (!code || !state || !codeVerifier) {
      throw new Error('Missing auth parameters');
    }

    if (state !== savedState) {
      throw new Error('State mismatch security error');
    }

    // Exchange token
    const response = await fetch(`${AUTH_SERVER}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: CALLBACK_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    const tokens = await response.json();
    
    // Fetch User Info
    const user = await this.fetchUserInfo(tokens.access_token);

    // Clean up
    sessionStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('oauth_state');

    return { accessToken: tokens.access_token, user };
  }

  public async fetchUserInfo(token: string): Promise<User> {
    const response = await fetch(`${AUTH_SERVER}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }
    
    return await response.json();
  }

  public async logout(token: string): Promise<void> {
    try {
      await fetch(`${AUTH_SERVER}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      });
    } catch (e) {
      console.error("Logout revoke failed", e);
    }
  }
}

export const authService = AuthService.getInstance();