# Supabase 안내

Sokudoku의 DB 변경은 `migrations/`에 시간순으로 기록합니다. 현재 데이터 관계와 규칙은 [데이터 모델](../docs/data-model.md), API 연결은 [아키텍처](../docs/architecture.md)를 먼저 읽으세요.

## 연결

`.env.example`에 필요한 공개 환경 변수 이름이 있습니다. 실제 값은 Git에서 제외된 `.env.local` 또는 배포 환경 설정에 둡니다. 일반 앱 인증/사용자 데이터 처리에 service role 키를 추가하지 않습니다.

## 현재 주요 계약

| 대상 | 역할 |
| --- | --- |
| `word` | 공통 단어/가나 카탈로그 |
| `personal_word` | 소유자별 개인 단어; `(user_id,term,kana)` 중복 제약 |
| `answer_log` | 중복 방지 ID를 가진 답변 이벤트 |
| 학습 snapshot/history/commit RPC | 공유 학습 엔진의 상태 동기화와 revision 제어 |
| `personal_word_page` | 검색/단계/정렬/전체 개수/20개 페이지 |
| `notebook_page` | 최근 오답과 P 등록 상태 |
| `learning_dashboard` | 시간대별 학습 현황 집계 |
| `word_recent_stat` | 최근 답변 통계 |

초기 migration의 정책은 이후 migration으로 변경될 수 있습니다. 특히 개인 단어 삭제를 초기 논리 삭제 설명으로 구현하지 마세요. 현재 API는 물리 삭제와 관련 기록 정리를 수행하며 수정/삭제 충돌에는 `updated_at`을 사용합니다.

## 변경과 검증

1. 현재 스키마·RLS·기존 RPC를 확인합니다.
2. 기존 적용 파일을 다시 쓰지 않고 새 migration을 만듭니다.
3. 인증/소유자 격리, 함수 실행 권한, `search_path`, 입력 한도를 검토합니다.
4. 별도 검증 DB에서 관련 `../tests/sql/*.sql`을 확인하고 실행합니다.
5. 타입 생성 결과와 API 호출을 맞추고, 적용된 migration과 검증 결과를 PR에 기록합니다.

SQL 테스트는 `pnpm test`에 포함되지 않습니다. 테스트용 데이터 생성/삭제와 BEGIN/ROLLBACK 여부를 먼저 확인하세요. Git 머지가 DB 적용 완료를 의미하지 않습니다.

2026-11-13 읽기 최적화는 `20261113005917_optimize_learning_page_reads.sql`과 `../tests/sql/learning_page_reads.sql`에서 확인할 수 있습니다. 과거 `personal_word_list` 등은 이전 호출 경로이며 현재 API는 위 페이지 RPC를 사용합니다.
