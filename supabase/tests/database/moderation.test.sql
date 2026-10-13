-- 책갈피 테스트 (pgTAP): 리더의 인용 카드 관리, 인용 한도 조회, 비슷한 카드 추천
-- 모든 변경은 마지막 rollback으로 되돌려진다.

begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- 준비 -----------------------------------------------------------------------------
-- A: 리더(3장 0%), B: 회원(1장 20%), D: 회원(2장 50%), C: 그룹 밖
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'a@mod.dev', '{}'),
  ('b2222222-2222-2222-2222-222222222222', 'b@mod.dev', '{}'),
  ('c3333333-3333-3333-3333-333333333333', 'c@mod.dev', '{}'),
  ('d4444444-4444-4444-4444-444444444444', 'd@mod.dev', '{}');

insert into public.books (id, title, created_by)
values ('b00c0000-0000-0000-0000-000000000001', '테스트 도서', 'a1111111-1111-1111-1111-111111111111');
insert into public.book_chapters (book_id, number, title) values
  ('b00c0000-0000-0000-0000-000000000001', 1, '1장'),
  ('b00c0000-0000-0000-0000-000000000001', 2, '2장'),
  ('b00c0000-0000-0000-0000-000000000001', 3, '3장');

insert into public.groups (id, book_id, owner_id, name, invite_code)
values ('90000000-0000-0000-0000-000000000001', 'b00c0000-0000-0000-0000-000000000001',
        'a1111111-1111-1111-1111-111111111111', '관리 테스트 모임', 'invite-mod1');
insert into public.memberships (group_id, user_id) values
  ('90000000-0000-0000-0000-000000000001', 'b2222222-2222-2222-2222-222222222222'),
  ('90000000-0000-0000-0000-000000000001', 'd4444444-4444-4444-4444-444444444444');
update public.memberships set progress_chapter = 3, progress_pct = 0
  where user_id = 'a1111111-1111-1111-1111-111111111111';
update public.memberships set progress_chapter = 1, progress_pct = 20
  where user_id = 'b2222222-2222-2222-2222-222222222222';
update public.memberships set progress_chapter = 2, progress_pct = 50
  where user_id = 'd4444444-4444-4444-4444-444444444444';

-- D(리더 아님)가 2장에 카드 두 장, 1장에 한 장 등록 -----------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d4444444-4444-4444-4444-444444444444","role":"authenticated"}';

select public.create_quote('90000000-0000-0000-0000-000000000001', 2, 10,
  '당신이 죽은 뒤 장례를 치르지 못해, 내 삶이 장례식이 되었습니다.', 'D의 첫 감상');
select public.create_quote('90000000-0000-0000-0000-000000000001', 2, 40,
  '아무도 내 동생을 더이상 모독할 수 없도록', 'D의 둘째 감상');
select public.create_quote('90000000-0000-0000-0000-000000000001', 1, 5,
  '비가 올 것 같아', 'D의 셋째 감상');

-- 등록자 본인: 잠기기 전에는 자유롭게 고칠 수 있다(기존 규칙 유지)
select lives_ok(
  $$ update public.quotes set text = '비가 올 것 같아. 너는 소리 내어 중얼거린다.' where text = '비가 올 것 같아' $$,
  '등록자는 잠기지 않은 자기 카드를 자유롭게 고칠 수 있다'
);

-- 리더 A: 남의 카드 오타 수정 ---------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ update public.quotes set text = '아무도 내 동생을 더 이상 모독할 수 없도록' where text = '아무도 내 동생을 더이상 모독할 수 없도록' $$,
  '리더는 다른 회원 카드의 오타를 고칠 수 있다'
);
select throws_ok(
  $$ update public.quotes set text = '리더가 마음대로 완전히 다른 문장으로 바꿔 버린 인용문' where text = '아무도 내 동생을 더 이상 모독할 수 없도록' $$,
  'P0001', 'quote_locked',
  '리더는 잠기지 않은 카드라도 남의 인용문을 크게 바꿀 수 없다'
);
select throws_ok(
  $$ update public.quotes set chapter = 1 where text = '아무도 내 동생을 더 이상 모독할 수 없도록' $$,
  '42501', null,
  '리더도 카드의 위치는 바꿀 수 없다'
);

-- A가 D의 첫 카드에 감상을 달아 잠근다
insert into public.notes (group_id, quote_id, body)
select '90000000-0000-0000-0000-000000000001', q.id, 'A의 감상'
from public.quotes q where q.text like '당신이 죽은 뒤%';

-- 회원 B(리더도 등록자도 아님): 수정·삭제·내리기 불가 ------------------------------------
set local "request.jwt.claims" to '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}';

update public.quotes set text = '비가 올 것 같아!' where text like '비가 올 것 같아%';
delete from public.quotes where text like '비가 올 것 같아%';
select throws_ok(
  $$ select public.remove_quote((select id from public.quotes where text like '비가 올 것 같아%')) $$,
  'P0001', 'not_owner',
  '리더가 아닌 회원은 remove_quote를 쓸 수 없다'
);

reset role;
select is(
  (select text from public.quotes where chapter = 1 and group_id = '90000000-0000-0000-0000-000000000001'),
  '비가 올 것 같아. 너는 소리 내어 중얼거린다.',
  '등록자도 리더도 아닌 회원은 카드를 고치거나 지울 수 없다'
);

-- 등록자 D: 잠긴 카드는 직접 지울 수 없다(기존 규칙 유지) ---------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d4444444-4444-4444-4444-444444444444","role":"authenticated"}';

delete from public.quotes where text like '당신이 죽은 뒤%';
select throws_ok(
  $$ select public.remove_quote((select id from public.quotes where text like '당신이 죽은 뒤%')) $$,
  'P0001', 'not_owner',
  '등록자라도 리더가 아니면 remove_quote를 쓸 수 없다'
);

reset role;
select ok(
  exists (select 1 from public.quotes where text like '당신이 죽은 뒤%'),
  '다른 회원 감상이 달린 카드는 등록자가 지울 수 없다'
);

-- 인용 한도 사용량 -------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.quotes where group_id = '90000000-0000-0000-0000-000000000001'),
  1::bigint,
  '1장 20%까지 읽은 B에게는 카드가 한 장만 보인다'
);

-- 기준값: 권한 제한 없이 센 전체 글자 수
reset role;
select set_config(
  'test.total_chars',
  (select sum(char_length(text))::text from public.quotes
   where group_id = '90000000-0000-0000-0000-000000000001'),
  true
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}';
select cmp_ok(
  current_setting('test.total_chars')::int,
  '>',
  (select sum(char_length(text))::int from public.quotes
   where group_id = '90000000-0000-0000-0000-000000000001'),
  'B에게 보이는 카드의 글자 수는 그룹 전체보다 적다'
);
select results_eq(
  $$ select used, quote_limit from public.quote_usage('90000000-0000-0000-0000-000000000001') $$,
  $$ select current_setting('test.total_chars')::int, 10000 $$,
  'quote_usage는 아직 못 읽은 카드까지 합친 글자 수와 한도를 돌려준다'
);

set local "request.jwt.claims" to '{"sub":"c3333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ select * from public.quote_usage('90000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_member',
  '그룹 밖 회원은 인용 사용량을 볼 수 없다'
);

reset role;
select ok(
  not has_function_privilege('anon', 'public.quote_usage(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.remove_quote(uuid)', 'execute'),
  '비로그인 사용자는 새 함수를 실행할 수 없다'
);

-- 비슷한 카드 추천 -------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select ok(
  exists (
    select 1 from public.similar_quotes('90000000-0000-0000-0000-000000000001', 2, 90,
      '당신이죽은뒤 장례를치르지못해 내삶이 장례식이되었습니다')
    where text like '당신이 죽은 뒤%'
  ),
  '띄어쓰기가 달라도 같은 문장을 찾는다'
);
select ok(
  exists (
    select 1 from public.similar_quotes('90000000-0000-0000-0000-000000000001', 2, 90, '장례를 치르지 못해')
    where text like '당신이 죽은 뒤%'
  ),
  '문장의 일부만 입력해도 찾는다'
);
select ok(
  exists (
    select 1 from public.similar_quotes('90000000-0000-0000-0000-000000000001', 3, 0,
      '당신이 죽은 뒤 장례를 치르지 못해 내 삶이 장례식이 되었습니다')
    where text like '당신이 죽은 뒤%'
  ),
  '장을 다르게 골라도 문장이 거의 같으면 찾는다'
);
select ok(
  not exists (
    select 1 from public.similar_quotes('90000000-0000-0000-0000-000000000001', 3, 0, '전혀 상관없는 다른 이야기입니다')
  ),
  '다른 장의 다른 문장은 추천하지 않는다'
);

set local "request.jwt.claims" to '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}';
select ok(
  not exists (
    select 1 from public.similar_quotes('90000000-0000-0000-0000-000000000001', 2, 10,
      '당신이 죽은 뒤 장례를 치르지 못해 내 삶이 장례식이 되었습니다')
  ),
  '아직 읽지 않은 위치의 카드는 추천에도 나오지 않는다'
);

-- 리더 A: 카드 내리기 -----------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ select public.remove_quote((select id from public.quotes where text like '당신이 죽은 뒤%')) $$,
  '리더는 감상이 달린 카드도 내릴 수 있다'
);

reset role;
select is(
  (select count(*) from public.quotes where text like '당신이 죽은 뒤%')
    + (select count(*) from public.notes where body in ('D의 첫 감상', 'A의 감상')),
  0::bigint,
  '카드를 내리면 그 카드에 달린 감상도 함께 지워진다'
);

select * from finish();
rollback;
