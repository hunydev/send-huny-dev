# HunyDev SSO Integration Guide

이 가이드는 `auth.huny.dev` OAuth 2.0 서버를 사용하여 클라이언트 사이드 애플리케이션에서 SSO 로그인을 구현하는 방법을 설명합니다.

## 개요

- **Authorization Server**: `https://auth.huny.dev`
- **인증 방식**: OAuth 2.0 Authorization Code Flow with PKCE
- **지원 스코프**: `openid`, `profile`, `email`

## 사전 준비

1. `auth.huny.dev` 관리자에게 OAuth 클라이언트 등록 요청
2. 발급받은 정보:
   - `CLIENT_ID`: 클라이언트 식별자 (예: `client_xxxxxxxxxxxxx`)
   - `CALLBACK_URI`: 인증 완료 후 리다이렉트될 URI (예: `https://yourapp.com/callback`)

## 인증 플로우

```
┌──────────┐     1. 로그인 요청      ┌──────────────┐
│  Client  │ ──────────────────────> │ auth.huny.dev│
│   App    │                         │   /authorize │
└──────────┘                         └──────────────┘
     │                                      │
     │  2. 사용자 로그인 & 동의              │
     │                                      │
     │     3. Authorization Code            │
     │ <────────────────────────────────────┘
     │
     │  4. Code + Verifier로 Token 교환
     │ ────────────────────────────────────>
     │                                      │
     │     5. Access Token + Refresh Token  │
     │ <────────────────────────────────────┘
     │
     │  6. Access Token으로 UserInfo 요청
     │ ────────────────────────────────────>
     │                                      │
     │     7. User Profile                  │
     │ <────────────────────────────────────┘
```

## 구현 가이드

### 1. PKCE 유틸리티 함수

PKCE(Proof Key for Code Exchange)는 공개 클라이언트를 위한 보안 확장입니다.

```typescript
// Base64 URL 인코딩
function base64UrlEncode(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Code Verifier 생성 (랜덤 문자열)
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// Code Challenge 생성 (Verifier의 SHA-256 해시)
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

// State 생성 (CSRF 방지)
function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}
```

### 2. 로그인 요청 시작

```typescript
const CLIENT_ID = 'your_client_id';
const CALLBACK_URI = 'https://yourapp.com/callback';
const AUTH_SERVER = 'https://auth.huny.dev';

async function initiateLogin(): Promise<void> {
  // PKCE 값 생성
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  // 콜백에서 검증을 위해 저장 (sessionStorage 권장 - 탭별 격리)
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  // Authorization URL 구성
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URI,
    scope: 'openid profile email',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // 인증 서버로 리다이렉트
  window.location.href = `${AUTH_SERVER}/oauth/authorize?${params.toString()}`;
}
```

### 3. 팝업 방식 로그인 (선택)

새 탭이 아닌 팝업 창으로 로그인 진행:

```typescript
async function initiateLoginPopup(): Promise<void> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

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
  
  // 팝업 창 열기
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
```

### 4. 콜백 처리 (Token 교환)

콜백 URI에서 authorization code를 받아 access token으로 교환:

```typescript
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

interface User {
  sub: string;        // 사용자 고유 ID
  name?: string;      // 표시 이름
  email?: string;     // 이메일
  picture?: string;   // 프로필 이미지 URL
}

async function handleCallback(): Promise<{ accessToken: string; user: User }> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  // 저장된 값 확인
  const savedState = sessionStorage.getItem('oauth_state');
  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');

  // 유효성 검증
  if (!code || !state || !codeVerifier) {
    throw new Error('Missing authentication parameters');
  }

  if (state !== savedState) {
    throw new Error('State mismatch - possible CSRF attack');
  }

  // Token 교환
  const tokenResponse = await fetch(`${AUTH_SERVER}/oauth/token`, {
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

  if (!tokenResponse.ok) {
    throw new Error('Token exchange failed');
  }

  const tokens: TokenResponse = await tokenResponse.json();

  // 사용자 정보 조회
  const user = await fetchUserInfo(tokens.access_token);

  // PKCE 데이터 정리
  sessionStorage.removeItem('pkce_code_verifier');
  sessionStorage.removeItem('oauth_state');

  // Token 저장 (localStorage는 탭 간 공유됨)
  localStorage.setItem('auth_token', tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem('auth_refresh_token', tokens.refresh_token);
  }
  if (tokens.expires_in) {
    localStorage.setItem('auth_expires_at', String(Date.now() + tokens.expires_in * 1000));
  }
  localStorage.setItem('auth_user', JSON.stringify(user));

  return { accessToken: tokens.access_token, user };
}
```

### 5. 사용자 정보 조회

```typescript
async function fetchUserInfo(accessToken: string): Promise<User> {
  const response = await fetch(`${AUTH_SERVER}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return await response.json();
}
```

### 6. 팝업 방식 콜백 처리

팝업에서 부모 창으로 결과 전달:

```typescript
// 콜백 페이지에서 실행
async function handlePopupCallback(): Promise<void> {
  try {
    const { accessToken, user } = await handleCallback();
    
    // 부모 창으로 결과 전달
    if (window.opener) {
      window.opener.postMessage({
        type: 'AUTH_SUCCESS',
        token: accessToken,
        user: user,
      }, window.location.origin);
      window.close();
    }
  } catch (error) {
    if (window.opener) {
      window.opener.postMessage({
        type: 'AUTH_ERROR',
        error: error.message,
      }, window.location.origin);
      window.close();
    }
  }
}

// 부모 창에서 메시지 수신
window.addEventListener('message', (event) => {
  // origin 검증 (보안)
  if (event.origin !== window.location.origin) return;

  if (event.data?.type === 'AUTH_SUCCESS') {
    const { token, user } = event.data;
    // 로그인 성공 처리
    console.log('Logged in as:', user.name);
  } else if (event.data?.type === 'AUTH_ERROR') {
    // 에러 처리
    console.error('Login failed:', event.data.error);
  }
});
```

### 7. Token 갱신 (Refresh)

Access Token 만료 전에 자동 갱신:

```typescript
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 만료 5분 전 갱신

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('auth_refresh_token');
  if (!refreshToken) return false;

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
      // Refresh 실패 시 로그아웃 처리
      clearAuthData();
      return false;
    }

    const tokens: TokenResponse = await response.json();

    // 새 토큰 저장
    localStorage.setItem('auth_token', tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem('auth_refresh_token', tokens.refresh_token);
    }
    if (tokens.expires_in) {
      localStorage.setItem('auth_expires_at', String(Date.now() + tokens.expires_in * 1000));
    }

    return true;
  } catch {
    return false;
  }
}

// 자동 갱신 스케줄링
function scheduleTokenRefresh(): void {
  const expiresAt = localStorage.getItem('auth_expires_at');
  if (!expiresAt) return;

  const timeUntilRefresh = parseInt(expiresAt) - Date.now() - REFRESH_BUFFER_MS;

  if (timeUntilRefresh <= 0) {
    // 즉시 갱신
    refreshAccessToken().then(success => {
      if (success) scheduleTokenRefresh();
    });
  } else {
    // 예약 갱신
    setTimeout(async () => {
      const success = await refreshAccessToken();
      if (success) scheduleTokenRefresh();
    }, timeUntilRefresh);
  }
}
```

### 8. 로그아웃

```typescript
async function logout(): Promise<void> {
  const token = localStorage.getItem('auth_token');

  if (token) {
    // 서버에 토큰 취소 요청 (선택)
    try {
      await fetch(`${AUTH_SERVER}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      });
    } catch {
      // 실패해도 로컬 데이터는 삭제
    }
  }

  clearAuthData();
}

function clearAuthData(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_refresh_token');
  localStorage.removeItem('auth_expires_at');
  localStorage.removeItem('auth_user');
}
```

### 9. API 요청 시 인증 헤더 추가

```typescript
async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...options, headers });

  // 401 응답 시 토큰 만료로 간주
  if (response.status === 401) {
    // Refresh 시도
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // 재시도
      headers.set('Authorization', `Bearer ${localStorage.getItem('auth_token')}`);
      return fetch(url, { ...options, headers });
    } else {
      clearAuthData();
      throw new Error('Session expired');
    }
  }

  return response;
}
```

## API 엔드포인트 요약

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/oauth/authorize` | GET | 인증 요청 시작 (브라우저 리다이렉트) |
| `/oauth/token` | POST | Authorization Code → Token 교환 |
| `/oauth/token` | POST | Refresh Token으로 Access Token 갱신 |
| `/oauth/userinfo` | GET | 사용자 정보 조회 (Bearer Token 필요) |
| `/oauth/revoke` | POST | 토큰 취소 (로그아웃) |

## 보안 권장사항

1. **PKCE 필수 사용**: 공개 클라이언트에서는 항상 PKCE를 사용하세요.
2. **State 검증**: CSRF 공격 방지를 위해 state 파라미터를 반드시 검증하세요.
3. **HTTPS 필수**: 모든 통신은 HTTPS를 통해 이루어져야 합니다.
4. **Origin 검증**: postMessage 사용 시 origin을 반드시 검증하세요.
5. **Token 저장**: 
   - Access Token: `localStorage` (탭 간 공유 필요 시) 또는 메모리
   - Refresh Token: `localStorage` (장기 세션) 또는 httpOnly 쿠키 (서버 지원 시)
   - PKCE 값: `sessionStorage` (탭별 격리)

## 전체 예제 (React)

```tsx
import React, { useState, useEffect } from 'react';

const CLIENT_ID = 'your_client_id';
const CALLBACK_URI = 'https://yourapp.com/callback';
const AUTH_SERVER = 'https://auth.huny.dev';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 저장된 사용자 정보 복원
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      scheduleTokenRefresh();
    }

    // 팝업 메시지 수신
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'AUTH_SUCCESS') {
        localStorage.setItem('auth_token', event.data.token);
        localStorage.setItem('auth_user', JSON.stringify(event.data.user));
        setUser(event.data.user);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLogin = () => initiateLoginPopup();
  
  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  if (!user) {
    return <button onClick={handleLogin}>Sign in with HunyDev</button>;
  }

  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={handleLogout}>Sign Out</button>
    </div>
  );
}
```

## 문의

OAuth 클라이언트 등록 및 기술 지원: admin@huny.dev
