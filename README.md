# Sokudoku

일본어 단어의 의미와 읽기를 빠르게 인식하는 훈련 게임.

## 현재 상태

Next.js 프로젝트 초기화와 Supabase 브라우저/서버 클라이언트, 세션 갱신 proxy를 준비했습니다. 게임, DB 스키마, 로그인 화면 및 기록 동기화는 아직 구현 전입니다. 상세 설계서는 로컬에서 별도 관리합니다. 미정 사항은 확정 요구로 취급하지 않습니다.

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
