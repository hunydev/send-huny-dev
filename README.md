<div align="center">
  
# 🔐 SendSecure AI

**보안 임시 파일 공유 서비스 | Secure Ephemeral File Sharing**

[![Deploy to Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)

<img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" alt="SendSecure AI Banner" width="100%" />

*다운로드 횟수 및 시간 제한이 있는 보안 파일 공유 + AI 기반 파일 요약*

[🚀 Live Demo](https://send.huny.dev) • [📖 Documentation](#-사용-방법) • [🛠️ Installation](#️-설치-방법)

</div>

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 🔒 **보안 파일 공유** | 일회성 또는 제한된 다운로드 링크 생성 |
| ⏱️ **자동 만료** | 시간 또는 다운로드 횟수 기반 자동 삭제 |
| 🤖 **AI 파일 요약** | Google Gemini로 파일 내용 자동 요약 |
| 🔑 **SSO 인증** | OAuth 2.0 PKCE 기반 안전한 로그인 |
| 👤 **게스트 모드** | 로그인 없이 파일 다운로드 가능 |
| ☁️ **엣지 배포** | Cloudflare Workers + R2로 글로벌 저지연 |

---

## 🛠️ 기술 스택

### Frontend
- **React 19** - 최신 React와 Hooks 기반 UI
- **TypeScript 5.8** - 타입 안정성 보장
- **Vite 6** - 빠른 개발 환경 및 빌드
- **Lucide Icons** - 깔끔한 아이콘 세트

### Backend
- **Cloudflare Workers** - 엣지 서버리스 런타임
- **Cloudflare R2** - S3 호환 오브젝트 스토리지
- **Hono/Itty Router** - 경량 API 라우팅

### AI & Auth
- **Google Gemini 2.5 Flash** - 빠른 텍스트 분석 및 요약
- **OAuth 2.0 PKCE** - 보안 인증 플로우
- **HunyDev SSO** - 중앙 집중식 인증 서버

---

## 📁 프로젝트 구조

```
SendSecure-AI/
├── 📁 components/           # React 컴포넌트
│   ├── AdminDashboard.tsx   # 관리자 대시보드
│   ├── FileUpload.tsx       # 파일 업로드 컴포넌트
│   ├── GuestDashboard.tsx   # 게스트 대시보드
│   ├── Login.tsx            # 로그인 화면
│   └── PublicDownload.tsx   # 공개 다운로드 페이지
├── 📁 services/             # 프론트엔드 서비스
│   ├── apiStorage.ts        # API 통신 서비스
│   ├── authService.ts       # OAuth 인증 서비스
│   ├── geminiService.ts     # Gemini AI 서비스
│   └── mockStorage.ts       # 로컬 개발용 Mock
├── 📁 src/                  # Cloudflare Worker 소스
│   ├── api/                 # API 엔드포인트
│   │   ├── auth.ts          # 인증 API
│   │   ├── files.ts         # 파일 관리 API
│   │   ├── index.ts         # API 라우터
│   │   └── public.ts        # 공개 API
│   ├── middleware/          # 미들웨어
│   │   └── cors.ts          # CORS 처리
│   ├── services/            # 백엔드 서비스
│   │   └── r2Storage.ts     # R2 스토리지 서비스
│   ├── types.ts             # 타입 정의
│   └── worker.ts            # Worker 엔트리포인트
├── 📁 docs/                 # 문서
│   └── SSO_INTEGRATION_GUIDE.md  # SSO 통합 가이드
├── 📁 public/               # 정적 자산
├── App.tsx                  # 메인 앱 컴포넌트
├── types.ts                 # 공유 타입 정의
├── wrangler.toml            # Cloudflare 설정
└── package.json             # 의존성 관리
```

---

## 🚀 설치 방법

### 사전 요구사항
- Node.js 18+
- npm 또는 yarn
- Cloudflare 계정 (배포 시)

### 로컬 개발

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/sendsecure-ai.git
cd sendsecure-ai

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 GEMINI_API_KEY 설정

# 4. 개발 서버 실행
npm run dev
```

### Cloudflare Workers 배포

```bash
# 1. Wrangler 로그인
npx wrangler login

# 2. R2 버킷 생성 (최초 1회)
npx wrangler r2 bucket create send

# 3. 시크릿 설정
npx wrangler secret put AUTH_CLIENT_SECRET

# 4. 빌드 및 배포
npm run worker:deploy
```

---

## 💡 사용 방법

### 파일 업로드 (관리자)

1. **로그인** - HunyDev SSO로 로그인
2. **파일 선택** - 드래그 앤 드롭 또는 클릭으로 파일 선택
3. **설정 구성**
   - 다운로드 제한: 1 / 2 / 5 / 10 / 100회
   - 만료 시간: 5분 / 1시간 / 1일 / 7일
4. **AI 요약** (선택) - 텍스트 파일의 경우 Gemini가 자동 요약
5. **업로드** - 공유 링크 자동 생성

### 파일 다운로드 (수신자)

1. 공유 링크 접속 (예: `https://send.huny.dev/#abc123`)
2. 파일 정보 및 AI 요약 확인
3. **Download File** 버튼 클릭
4. 남은 다운로드 횟수 확인

---

## 🔐 보안 기능

| 기능 | 설명 |
|------|------|
| **PKCE 인증** | 클라이언트 사이드에서 안전한 OAuth 2.0 |
| **토큰 자동 갱신** | Access Token 만료 5분 전 자동 갱신 |
| **다운로드 제한** | 설정된 횟수 초과 시 자동 만료 |
| **시간 제한** | 설정된 시간 초과 시 자동 만료 |
| **격리된 스토리지** | 사용자별 독립된 파일 저장 공간 |

---

## 📡 API 엔드포인트

### 인증 필요 (Bearer Token)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/files/upload` | 파일 업로드 |
| `GET` | `/api/files` | 파일 목록 조회 |
| `DELETE` | `/api/files/:id` | 파일 삭제 |

### 공개 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/public/:id/meta` | 파일 메타데이터 조회 |
| `GET` | `/api/public/:id/download` | 파일 다운로드 |

---

## ⚙️ 환경 변수

### Frontend (.env.local)

```env
GEMINI_API_KEY=your_gemini_api_key
```

### Cloudflare Workers (wrangler.toml)

```toml
[vars]
AUTH_SERVER = "https://auth.huny.dev"
CLIENT_ID = "your_client_id"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "send"
```

### Secrets (wrangler secret)

```bash
# OAuth 클라이언트 시크릿
npx wrangler secret put AUTH_CLIENT_SECRET
```

---

## 📜 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | Vite 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run worker:dev` | Worker 로컬 실행 |
| `npm run worker:deploy` | Worker 배포 |
| `npm run worker:tail` | Worker 로그 실시간 확인 |

---

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

<div align="center">

**Made with ❤️ by [HunyDev](https://huny.dev)**

[⬆️ 맨 위로](#-sendsecure-ai)

</div>
