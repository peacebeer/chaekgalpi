-- 책갈피 RLS·규칙 테스트 (pgTAP)
-- 실행: supabase test db   (CI에서는 .github/workflows/db-tests.yml이 실행)
-- 모든 변경은 마지막 rollback으로 되돌려진다.

begin;
create extension if not exists pgtap with schema extensions;

select plan(35);

-- 준비: 회원 5명 ------------------------------------------------------------------
-- A: 리더(3장 0%), B: 1장 20%, D: 2장 50%, C·E: 그룹 밖
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev', '{"nickname":"리더A"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.dev', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.dev', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'e@test.dev', '{}');

-- 대표 도서: 5장, 장 시작 쪽 1·30·60·90·120, 전체 150쪽
insert into public.books (id, title, pages, created_by)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '테스트 도서', 150, '11111111-1111-1111-1111-111111111111');
insert into public.book_chapters (book_id, number, title, start_page) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, '1장', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, '2장', 30),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 3, '3장', 60),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 4, '4장', 90),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 5, '5장', 120);

-- 그룹 G (A가 리더로 자동 가입), B·D 가입
insert into public.groups (id, book_id, owner_id, name, invite_code)
values ('99999999-9999-9999-9999-999999999999', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '11111111-1111-1111-1111-111111111111', '테스트 모임', 'invite-test');
insert into public.memberships (group_id, user_id) values
  ('99999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222'),
  ('99999999-9999-9999-9999-999999999999', '44444444-4444-4444-4444-444444444444');
update public.memberships set progress_chapter = 3, progress_pct = 0
  where user_id = '11111111-1111-1111-1111-111111111111';
update public.memberships set progress_chapter = 1, progress_pct = 20
  where user_id = '22222222-2222-2222-2222-222222222222';
update public.memberships set progress_chapter = 2, progress_pct = 50
  where user_id = '44444444-4444-4444-4444-444444444444';

select is(
  (select nickname from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  '리더A',
  '가입하면 프로필이 자동으로 만들어진다'
);

-- A: 2장 10%에 인용 카드 등록 -----------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ select public.create_quote('99999999-9999-9999-9999-999999999999', 2, 10, '그 문장은 오래 남았다', '첫 감상') $$,
  'A는 자기 진도 이하 위치(2장 10%)에 인용 카드를 등록할 수 있다'
);

-- D: A의 카드에 감상 추가 + 1장 10%에 메모 ------------------------------------------
set local "request.jwt.claims" to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select lives_ok(
  $$ insert into public.notes (group_id, quote_id, body)
     select '99999999-9999-9999-9999-999999999999', q.id, 'D의 감상'
     from public.quotes q where q.text = '그 문장은 오래 남았다' $$,
  'D는 다른 회원의 인용 카드에 감상을 남길 수 있다'
);
select lives_ok(
  $$ insert into public.notes (group_id, chapter, pct, kind, body)
     values ('99999999-9999-9999-9999-999999999999', 1, 10, 'memo', '첫 장 메모') $$,
  'D는 1장 10%에 메모를 남길 수 있다'
);

reset role;
select ok(
  (select locked_at is not null from public.quotes where text = '그 문장은 오래 남았다'),
  '다른 회원 감상이 달리면 인용 카드가 잠긴다'
);

-- 진도 잠금: B(1장 20%) ----------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.quotes where group_id = '99999999-9999-9999-9999-999999999999'),
  0::bigint,
  '1장 20%까지 읽은 회원은 2장 인용 카드를 조회할 수 없다'
);
select is(
  (select count(*) from public.notes where chapter = 2),
  0::bigint,
  '1장 20%까지 읽은 회원은 2장 감상을 조회할 수 없다'
);
select is(
  (select count(*) from public.notes where chapter = 1),
  1::bigint,
  '1장 20%까지 읽은 회원은 1장 10% 메모는 볼 수 있다'
);
select is(
  (select quotes from public.locked_counts('99999999-9999-9999-9999-999999999999') where chapter = 2),
  1::bigint,
  '흐림 처리용 개수: 2장에 잠긴 인용 카드 1개'
);
select is(
  (select notes from public.locked_counts('99999999-9999-9999-9999-999999999999') where chapter = 2),
  2::bigint,
  '흐림 처리용 개수: 2장에 잠긴 감상 2개'
);
select throws_ok(
  $$ insert into public.notes (group_id, chapter, pct, body)
     values ('99999999-9999-9999-9999-999999999999', 2, 0, '앞서 쓰기') $$,
  '42501', null,
  '자기 진도보다 뒤 위치에는 감상을 쓸 수 없다'
);
select throws_ok(
  $$ select public.create_quote('99999999-9999-9999-9999-999999999999', 2, 0, '미리 본 문장', '감상') $$,
  'P0001', 'position_ahead_of_progress',
  '자기 진도보다 뒤 위치에는 인용 카드를 등록할 수 없다'
);
select throws_ok(
  $$ update public.memberships set progress_chapter = 6
     where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'P0001', 'progress_out_of_range',
  '진도는 대표 도서 목차 범위를 넘을 수 없다'
);

-- 남의 감상 수정·삭제 금지, 좋아요 1회 -----------------------------------------------
update public.notes set body = '바꿔치기' where body = '첫 장 메모';
delete from public.notes where body = '첫 장 메모';
select lives_ok(
  $$ insert into public.reactions (note_id) select id from public.notes where body = '첫 장 메모' $$,
  'B는 볼 수 있는 감상에 좋아요를 남길 수 있다'
);
select throws_ok(
  $$ insert into public.reactions (note_id) select id from public.notes where body = '첫 장 메모' $$,
  '23505', null,
  '같은 감상에 같은 사람이 좋아요를 두 번 누를 수 없다'
);

reset role;
select ok(
  exists (select 1 from public.notes where body = '첫 장 메모'),
  '남의 감상은 수정·삭제할 수 없다'
);

-- 그룹 밖 회원 C ------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is(
  (select count(*) from public.quotes) + (select count(*) from public.notes)
    + (select count(*) from public.memberships where group_id = '99999999-9999-9999-9999-999999999999'),
  0::bigint,
  '그룹 밖 회원은 그 그룹의 카드·감상·회원 목록을 조회할 수 없다'
);
select throws_ok(
  $$ insert into public.notes (group_id, chapter, pct, body)
     values ('99999999-9999-9999-9999-999999999999', 1, 0, '끼어들기') $$,
  '42501', null,
  '그룹 밖 회원은 감상을 쓸 수 없다'
);

-- 잠긴 카드 규칙: A ---------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

delete from public.quotes where text = '그 문장은 오래 남았다';
select throws_ok(
  $$ update public.quotes set text = '완전히 다른 문장으로 바꿔 버린 인용문' where text = '그 문장은 오래 남았다' $$,
  'P0001', 'quote_locked',
  '잠긴 인용 카드는 크게 고칠 수 없다'
);
select lives_ok(
  $$ update public.quotes set text = '그 문장은 오래 남았다.' where text = '그 문장은 오래 남았다' $$,
  '잠긴 인용 카드도 오타 수정(10자 이하)은 할 수 있다'
);

reset role;
select ok(
  exists (select 1 from public.quotes where text = '그 문장은 오래 남았다.'),
  '다른 회원 감상이 달린 카드는 등록자도 삭제할 수 없다'
);

-- 비슷한 카드 추천 ------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select ok(
  exists (
    select 1 from public.similar_quotes('99999999-9999-9999-9999-999999999999', 2, 12, '그 문장은 오래')
    where text = '그 문장은 오래 남았다.'
  ),
  '같은 장의 비슷한 인용 카드를 추천한다'
);

-- 쪽수 환산 ------------------------------------------------------------------------
select is(
  (select chapter from public.page_to_position('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 75)),
  3,
  '75쪽은 3장으로 환산된다'
);
select is(
  (select pct from public.page_to_position('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 75)),
  50.00::numeric,
  '75쪽은 3장 50%로 환산된다 (60~89쪽 구간)'
);
select is(
  (select pct from public.page_to_position('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 135)),
  48.39::numeric,
  '마지막 장은 책 전체 쪽수로 끝을 잡는다'
);

-- 인용 합계 10,000자 한도 -----------------------------------------------------------
reset role;
insert into public.quotes (group_id, chapter, pct, text, created_by)
select '99999999-9999-9999-9999-999999999999', 1, 0, repeat('가', 300), '11111111-1111-1111-1111-111111111111'
from generate_series(1, 33);  -- 9,900자 + 기존 카드

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok(
  $$ select public.create_quote('99999999-9999-9999-9999-999999999999', 1, 5, repeat('나', 300), '감상') $$,
  'P0001', 'quote_limit_exceeded',
  '인용 합계가 10,000자를 넘는 카드는 등록되지 않는다'
);
select lives_ok(
  $$ select public.create_quote('99999999-9999-9999-9999-999999999999', 1, 5, repeat('나', 50), '감상') $$,
  '한도 안의 카드는 등록된다'
);

-- 책 전체 노트와 숨김 -----------------------------------------------------------------
reset role;
update public.memberships set finished_at = now()
  where user_id = '44444444-4444-4444-4444-444444444444';

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select lives_ok(
  $$ insert into public.notes (group_id, body, kind)
     values ('99999999-9999-9999-9999-999999999999', '다 읽고 나서', 'summary') $$,
  '완독한 회원은 책 전체 노트를 쓸 수 있다'
);

set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is(
  (select count(*) from public.notes where chapter is null),
  0::bigint,
  '완독하지 않은 회원은 책 전체 노트를 볼 수 없다'
);

set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ select public.hide_note(id) from public.notes where body = '첫 장 메모' $$,
  '리더는 감상을 숨길 수 있다'
);

set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is(
  (select count(*) from public.notes where body = '첫 장 메모'),
  0::bigint,
  '숨긴 감상은 다른 회원에게 보이지 않는다'
);

-- 입장과 정원 -----------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select lives_ok(
  $$ select public.join_group('invite-test') $$,
  '초대 코드로 그룹에 입장할 수 있다'
);

reset role;
update public.groups set capacity = 4 where id = '99999999-9999-9999-9999-999999999999';

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select throws_ok(
  $$ select public.join_group('invite-test') $$,
  'P0001', 'group_full',
  '정원이 찬 그룹에는 입장할 수 없다'
);

-- 비로그인과 RLS 누락 점검 ------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select count(*) from public.quotes $$,
  '42501', null,
  '비로그인 사용자는 테이블을 조회할 수 없다'
);

reset role;
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint,
  'RLS가 꺼진 테이블이 하나도 없다'
);

select * from finish();
rollback;
