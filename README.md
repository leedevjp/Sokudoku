# Sokudoku

일본어 단어의 의미와 읽기를 빠르게 인식하는 훈련 게임.

## 현재 상태

이메일·비밀번호 로그인, 회원가입, 메일 인증 콜백, 로그아웃, 세션 복원 및 검증된 사용자 조회 API를 구현했습니다. 별도 public 테이블 없이 Supabase Auth를 사용합니다. 게임, DB 스키마 및 기록 동기화는 아직 구현 전입니다. 상세 설계서는 로컬에서 별도 관리합니다. 미정 사항은 확정 요구로 취급하지 않습니다.

## 로컬 실행

Node.js 20.9 이상과 pnpm을 사용합니다.

```sh
pnpm install
cp .env.example .env.local
# .env.local에 Sokudoku 전용 프로젝트 URL과 publishable key 입력
pnpm dev
```

```sh
pnpm build
```

`.env.local`은 Git에서 제외됩니다. service_role/secret key를 NEXT_PUBLIC 변수나 저장소에 넣지 마세요. 기존 Todo 프로젝트와 별도 구성입니다.

## 인증 설정

Supabase Authentication > URL Configuration에서 개발 주소(http://localhost:3010 또는 사용하는 포트)와 배포 주소를 설정하세요. Redirect URLs에 각 주소의 /auth/callback을 등록해야 합니다. 배포 후 Site URL도 실제 서비스 주소로 설정하세요. Email provider와 이메일 인증이 활성화되어 있어야 합니다.

인증 메일은 가입한 브라우저에서 열어야 PKCE 코드를 세션으로 교환할 수 있습니다. 만료되거나 잘못된 링크는 /auth/error로 안내합니다. /api/auth/user는 서버 getUser() 검증 후 최소 사용자 정보만 반환하며 비로그인 요청에는 401을 반환합니다. 인증 응답은 private, no-store입니다.

## Vercel 배포

프로젝트: leedevjps-projects/sokudoku (Next.js, Node 24). 배포 주소: https://sokudoku-weld.vercel.app

CLI 배포: vercel deploy --prod --scope leedevjps-projects. GitHub 자동 배포에는 leedevjp/Sokudoku에 대한 Vercel GitHub App 접근 허용과 저장소 연결이 필요합니다.

Supabase Auth의 Site URL은 위 주소, Redirect URLs에는 https://sokudoku-weld.vercel.app/auth/callback을 등록해야 합니다.
