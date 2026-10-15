# 책갈피 — AI 코딩 작업 지침

같은 책을 읽는 소그룹이 읽은 위치마다 감상·인용을 나누는 웹 서비스. 책 본문은 서비스하지 않는다.
제품 요구사항 전체는 `docs/PRD.md`. 이 파일과 PRD가 충돌하면 이 파일이 우선이다(더 최근 결정).

## 스택

- Next.js 16 (App Router, Turbopack), TypeScript strict, Node.js 20.9 이상
- Supabase: Postgres + Auth(구글, 이메일). 클라이언트는 `@supabase/ssr` (Realtime은 보류)
- Tailwind CSS + shadcn/ui, 모바일 우선 반응형
- 검증: Zod / 테스트: Vitest(단위), Playwright(E2E), pgTAP(DB)
- 린트·포맷: ESLint(+ eslint-config-prettier) + Prettier(+ prettier-plugin-tailwindcss)
- 호스팅: Vercel / CI: GitHub Actions

## 명령

| 목적 | 명령 |
| --- | --- |
| 개발 서버 | `npm run dev` |
| 린트 / 포맷 검사 / 자동 포맷 | `npm run lint` / `npm run format:check` / `npm run format` |
| 타입 검사 | `npm run typecheck` |
| 단위 테스트 | `npm run test` |
| E2E 테스트 | `npm run test:e2e` |
| DB 테스트 (Docker 필요) | `npx supabase start` 후 `npm run db:test` |
| DB 타입 생성 | `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts` |

**완료 기준:** 작업을 끝내기 전에 lint, format:check, typecheck, test, build가 모두 통과해야 한다. DB를 바꿨다면 pgTAP 테스트도 추가·통과시킨다. 실패를 숨기려고 테스트나 규칙을 끄지 않는다.

## 절대 규칙 (보안·저작권)

1. **비밀값:** `NEXT_PUBLIC_` 접두어는 Supabase URL과 Publishable key에만 쓴다. `NLK_API_KEY`(국립중앙도서관), `KAKAO_REST_API_KEY`(카카오 책 검색), Supabase Secret/service_role 키에는 절대 붙이지 않는다. 키를 코드·테스트·로그에 직접 쓰지 않는다. `.env.local`은 커밋하지 않는다.
2. **Secret/service_role 키 사용 금지(MVP):** 모든 데이터 접근은 로그인 사용자 권한으로 하고 RLS가 지키게 한다. RLS를 우회하는 코드를 쓰지 않는다.
3. **DB 변경은 새 마이그레이션으로만:** `npx supabase migration new <이름>`으로 파일을 만든다. 이미 있는 `supabase/migrations/*.sql`은 수정하지 않는다.
4. **새 테이블:** RLS를 켜고, 정책을 쓰고, `anon`/`authenticated` 기본 권한을 필요한 컬럼만 남기도록 정리하고, `supabase/tests/database/`에 pgTAP 테스트를 추가한다.
5. **새 DB 함수:** `security definer`면 `set search_path = ''`와 스키마 명시(`public.`)를 지킨다. 만든 뒤 `revoke all on function ... from public, anon, authenticated;` 하고 필요한 것만 `grant execute ... to authenticated;`.
6. **입력 검증:** 서버(Server Action·Route Handler)에서 받는 모든 값은 Zod로 `parse`한다. 화면 폼 검증은 같은 스키마를 재사용한다.
7. **저작권:** 책 본문 파일(PDF·EPUB 등)이나 페이지 사진을 올리는 기능을 만들지 않는다. 인용은 카드당 300자, 그룹당 합계 10,000자, 등록 시 본인 감상 필수.
8. **외부 API:** 카카오 책 검색과 국립중앙도서관 API는 서버에서만 호출한다(Route Handler 또는 Server Action). 응답은 Zod로 검사하고, 실패하면 "직접 입력" 흐름으로 넘긴다. 책 검색·표지는 카카오(`src/lib/kakao`), 목차·전체 쪽수는 국립중앙도서관(`src/lib/nlk`)에서 가져온다. 표지는 이미지 파일을 저장하지 않고 카카오 이미지 서버의 https 주소만 `books.cover_url`에 적는다.

## 데이터 모델 요약

위치는 항상 **그룹 대표 도서의 목차 기준 (chapter, pct)** 쌍이다. chapter는 1부터, pct는 0–100(소수 둘째 자리).

| 테이블 | 핵심 |
| --- | --- |
| profiles | 가입 시 트리거로 자동 생성. nickname 1–30자 |
| books / book_chapters | 대표 도서와 목차. start_page는 선택(쪽수 환산용). 같은 ISBN에 목차 버전 여러 개(행마다 한 버전, based_on·toc_source). 그룹이 쓰는 목차는 고치지 않고 새 버전으로 |
| groups | owner_id = 리더. capacity 3–8, quote_limit 10,000, invite_code |
| memberships | 진도 (progress_chapter, progress_pct), finished_at = 완독 |
| quotes | 인용 카드 1–300자. 다른 회원 감상이 달리면 locked_at 설정 |
| notes | kind: impression·memo·question·summary. body 1–2000자. quote_id(카드 감상), parent_id(답글, 1단계만). chapter NULL = 책 전체(완독자 전용) |
| reactions | 좋아요. (note_id, user_id) 하나만 |

**쓰기 경로 (직접 INSERT가 막힌 곳은 RPC로):**

| 하고 싶은 일 | 방법 |
| --- | --- |
| 그룹 만들기 | `groups` INSERT (리더 가입은 트리거가 처리) |
| 그룹 입장 | `rpc('join_group', { p_invite_code })` 또는 `{ p_group_id }`(공개 그룹) |
| 진도 저장 | `memberships` UPDATE (progress_chapter, progress_pct, finished_at만) |
| 쪽수 → 위치 | `rpc('page_to_position', { p_book_id, p_page })` → `{ chapter, pct }` (pct가 null이면 슬라이더로 받기) |
| 인용 카드 등록 | `rpc('create_quote', { p_group_id, p_chapter, p_pct, p_text, p_body, p_kind })` |
| 비슷한 카드 찾기 | `rpc('similar_quotes', { p_group_id, p_chapter, p_pct, p_text })` (입력 중 디바운스 300ms) |
| 카드에 감상 | `notes` INSERT `{ group_id, quote_id, body, kind }` (위치는 트리거가 채움) |
| 위치 메모·질문 | `notes` INSERT `{ group_id, chapter, pct, body, kind }` |
| 답글 | `notes` INSERT `{ group_id, parent_id, body }` |
| 좋아요 / 취소 | `reactions` INSERT `{ note_id }` / DELETE |
| 흐림 처리 개수 | `rpc('locked_counts', { p_group_id })` → 장별 잠긴 카드·감상 수 (본문 없음) |
| 리더의 감상 숨기기 | `rpc('hide_note', { p_note_id, p_hidden })` |
| 내 글 수정·삭제 | `notes` UPDATE (body, kind) / DELETE (작성자만) |
| 인용문 수정 | `quotes` UPDATE (text). 등록자는 잠기기 전 자유롭게, 잠긴 뒤와 리더는 오타 수정(10자 이내)만 |
| 인용 카드 삭제 | 등록자: `quotes` DELETE (잠기기 전만) / 리더: `rpc('remove_quote', { p_quote_id })` |
| 그룹 인용 한도 사용량 | `rpc('quote_usage', { p_group_id })` → `{ used, quote_limit }` (잠긴 카드 포함) |
| 같은 ISBN의 목차 버전 | `rpc('toc_versions', { p_isbn })` → 추천 순(도서관 제공 → 쓰는 그룹 수 → 시작 쪽 유무). 화면은 3개만 보여 주고 나머지는 더 보기. 똑같은 목차는 새로 저장하지 않는다 |
| 입장 전 그룹 소개 | `rpc('group_preview', { p_invite_code })` 또는 `{ p_group_id }`(공개 그룹) → 이름·리더·기간·책·목차 |
| 그룹 정보 수정·삭제, 회원 내보내기·나가기 | `groups` UPDATE/DELETE (리더), `memberships` DELETE (본인 또는 리더) |

잠긴(아직 못 읽은 위치의) 카드·감상은 RLS 때문에 조회 결과에 **아예 나오지 않는다.** 화면의 흐린 자리는 `locked_counts`로 그린다. 프런트에서 내용을 가리는 방식으로 구현하지 않는다.

## DB 오류 키 → 화면 문구

DB 함수는 아래 영어 키를 예외 메시지로 던진다. `src/lib/errors.ts` 한 곳에서 한국어 문구로 바꾼다.

| 키 | 화면 문구 |
| --- | --- |
| not_authenticated | 로그인이 필요해요. |
| not_member | 이 그룹의 회원만 할 수 있어요. |
| not_owner | 그룹 리더만 할 수 있어요. |
| group_not_found | 그룹을 찾을 수 없어요. 초대 코드를 확인해 주세요. |
| group_full | 그룹 정원이 가득 찼어요. |
| quote_empty / quote_too_long | 인용문을 1~300자로 입력해 주세요. |
| body_required | 인용과 함께 감상을 적어 주세요. |
| quote_limit_exceeded | 이 그룹의 인용 한도(10,000자)를 넘어서 등록할 수 없어요. |
| quote_locked | 다른 회원의 감상이 달린 카드는 오타 수정만 할 수 있어요. |
| quote_position_immutable | 인용 카드의 위치는 바꿀 수 없어요. |
| position_invalid / chapter_not_found | 위치를 다시 선택해 주세요. |
| position_ahead_of_progress | 아직 읽지 않은 위치예요. 진도를 먼저 기록해 주세요. |
| progress_out_of_range | 목차에 없는 장이에요. |
| page_invalid | 쪽수를 확인해 주세요. |
| page_mapping_unavailable | 이 책은 쪽수 입력을 지원하지 않아요. 장과 위치를 골라 주세요. |
| note_parent_invalid / note_quote_invalid / reply_depth_exceeded | 이 글에는 답할 수 없어요. |
| 42501 (RLS 거부) | 권한이 없어요. |
| 23505 (중복) | 이미 처리됐어요. |

## 코드 구조 (권장)

- `src/app/` 라우트: `(auth)/login`, `groups/new`, `groups/[id]`, `join/[code]`
- `src/lib/supabase/` 서버·브라우저 클라이언트, `database.types.ts`
- `src/lib/validation/` Zod 스키마 (DB 제약과 숫자 일치: 300, 10,000, 2,000, 30, 50, 3–8)
- `src/lib/errors.ts` 오류 키 → 문구
- `src/components/` UI, `src/components/ui/` shadcn
- 테스트: 단위는 대상 파일 옆 `*.test.ts`, E2E는 `e2e/`

## 작업 순서 (마일스톤)

한 번에 한 마일스톤씩 진행하고, 끝날 때마다 완료 기준을 통과시킨 뒤 커밋한다.

- **M0 기반:** eslint-config-prettier 연결, `vitest.config.mts`, `playwright.config.ts`(모바일 뷰포트 포함), Supabase 클라이언트(`@supabase/ssr`), proxy.ts로 세션 갱신, `src/lib/errors.ts`, Zod 스키마와 단위 테스트
- **M1 인증:** 구글·이메일 로그인/로그아웃, 프로필(닉네임) 수정
- **M2 책·그룹:** 국립중앙도서관 검색(서버) → 대표 도서·목차 저장, 실패 시 직접 입력. 그룹 생성, 초대 링크 `/join/[code]`, 공개 그룹 목록
- **M3 진도:** 장 선택 + 슬라이더, 쪽수 입력(`page_to_position`), 그룹 진도 현황판, 완독 처리
- **M4 교환:** 인용 카드 등록과 비슷한 카드 추천, 카드 감상, 위치 메모·질문, 답글, 좋아요, 흐림 처리, 리더 숨기기
- **M5 실시간:** quotes·notes·reactions·memberships 변경 구독으로 새로고침 없이 반영
  - **보류(2026-10-13 결정):** 비동기 교환이 핵심이라 MVP에서 뺐다. 구현은 `feat/m5-realtime` 브랜치에 남아 있고 main에는 합치지 않았다. 다시 넣을 때는 자동 새로고침 대신 "새 글이 있어요" 버튼 방식도 검토한다.
  - 실시간 없이도 화면은 Server Action 뒤 `refresh()`로 다시 그린다.
- **M6 E2E:** "A 그룹 생성 → B 초대 입장 → A가 2장 카드 등록 → 1장 읽는 B에게 흐림 → B 진도 2장 → 카드 보임" 흐름. CI에 E2E 잡 추가

## 현재 상태 (2026-10-13)

M0~M4, M6을 마쳤고 M5는 보류했다. 그 뒤 추가한 것:

- 그룹 설정(정보 수정, 회원 내보내기·나가기, 그룹 삭제), 3단계 그룹 만들기, 목차 선택 입력(없으면 "책 전체" 한 장)
- 카카오 책 검색(한 검색창, 표지, 더 보기), 그룹 목록 검색, 입장 전 그룹 소개
- 읽는 기간 달력과 권장 진도(`src/lib/books/schedule.ts`), 앱 안 알림(`/notifications`, 계산식, 테이블 없음)
- 디자인: 색·글꼴은 `src/app/globals.css`와 `src/app/layout.tsx` 한 곳에서 정한다. 화면에 색 값을 직접 쓰지 말고 토큰(`bg-card`, `text-primary`, `font-quote` 등)을 쓴다.

**작업 방식 메모**

- Docker가 없는 환경이라 pgTAP은 CI에서만 돈다. 마이그레이션을 바꿀 때는 테스트를 함께 쓰고, PR의 `pgtap` 검사로 확인한다.
- 두 회원 흐름 E2E(`e2e/progress-lock.spec.ts`)는 `.env.local`의 `E2E_USER_*` 계정이 있을 때만 돈다. CI는 임시 로컬 Supabase에 계정을 만들어 돌린다.
- 하나의 버튼 묶음 안의 펼침 칸(수정·답글·삭제 확인)은 `ActionGroup`(`src/components/action-group.tsx`) 안에 두어 한 번에 하나만 열리게 한다.

**미뤄 둔 것**

- 목차 입력 부담 줄이기 (ISBN 하나에 목차 여러 벌은 2026-10-16에 구현)
- 이메일·웹 푸시 알림, 주차별 읽기 범위, 내보낸 회원 재입장 차단
- Vercel 배포와 그 뒤의 운영 준비(PRD "배포 실습")

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
