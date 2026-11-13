# Sokudoku · 速読

일본어 단어의 뜻과 읽기를 4지선다 게임과 간격 반복으로 익히는 웹 앱입니다.

[서비스](https://sokudoku-jp.vercel.app) · 한국어/일본어 · 라이트/다크

## 처음 읽는 순서

1. **[프로젝트 지도](docs/architecture.md)** — 화면, 서버, 학습 엔진, 저장소가 어떻게 연결되는가
2. **[데이터와 학습 규칙](docs/data-model.md)** — 공통/P 단어, 단계, 답변 저장과 복습
3. **[개발 안내](docs/development.md)** — 실행, 검증, DB 변경, 문제 찾는 순서
4. **[개선 계획](docs/improvements.md)** — 확인된 문제와 우선순위, 이후 기능 제안

기존 게임 연출·아트 설계 문서는 [문서 목록](docs/README.md)에서 찾습니다.

## 사용자가 할 수 있는 일

- 단어·히라가나·가타카나의 뜻/읽기 훈련: 탐색, 복습, 시험
- 개인 단어 추가·검색·단계 필터·정렬·수정·삭제
- 최근 오답 확인, 검색·필터, 개인 단어장에 추가/해제
- 학습 현황에서 기억 상태·활동·단계별 진행 확인
- 문장 훈련: 단어 훈련과 구분되는 별도 기능

## 실행

Node.js 24, pnpm 11을 사용합니다. 정확한 패키지 버전은 `package.json`과 `pnpm-lock.yaml`이 기준입니다.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

PowerShell에서는 `Copy-Item .env.example .env.local`을 사용할 수 있습니다. `.env.local`에 Supabase URL과 공개 가능 키를 넣고, Auth 리다이렉트 URL에 `<origin>/auth/callback`을 등록합니다. 비밀 키는 커밋하지 않습니다.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

검사별 역할과 현재 알려진 실패는 [개발 안내](docs/development.md#검증)와 [개선 계획](docs/improvements.md)을 확인하세요. SQL 테스트는 `pnpm test`에 포함되지 않습니다.

## 구조 한눈에 보기

| 위치 | 책임 |
| --- | --- |
| `app/` | 페이지와 HTTP API 진입점 |
| `components/` | 기능별 React UI와 상태 연결 |
| `lib/game/learning/` | FSRS, 학습 상태, 출제 계획 |
| `lib/game/data/` | 단어 캐시, 미전송 답변, 서버 동기화 |
| `lib/game/phaser/` | 게임 화면, 입력, 효과, 실행 수명주기 |
| `lib/{personal,notebook,dashboard,sentence}/` | 각 기능의 규칙·타입·검증 |
| `styles/` | 공통/홈 등 전역 스타일; 기능 CSS Modules는 컴포넌트 옆 |
| `supabase/migrations/` | DB 스키마, RLS, RPC의 순서 있는 변경 |
| `tests/`, `tests/sql/` | 로직 테스트와 별도 DB 회귀 검증 |

`main` 변경은 자동 배포 흐름에 연결됩니다. DB 마이그레이션은 Git 머지와 별개로 적용·검증해야 합니다.
