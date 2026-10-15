-- 책갈피 테스트 (pgTAP): 체험 모드(익명 사용자의 체험 그룹)
-- 모든 변경은 마지막 rollback으로 되돌려진다.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- 준비: 익명 방문자 V, 일반 회원 M과 M의 그룹 ---------------------------------------------
insert into auth.users (id, is_anonymous, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-00000000000a', true, '{"nickname":"체험 독자"}');
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-00000000000b', 'm@demo.dev', '{"nickname":"일반"}');

insert into public.books (id, title, created_by)
values ('d0000000-0000-0000-0000-0000000000b1', '일반 책', 'd0000000-0000-0000-0000-00000000000b');
insert into public.book_chapters (book_id, number, title)
values ('d0000000-0000-0000-0000-0000000000b1', 1, '첫 장');
insert into public.groups (id, book_id, owner_id, name, invite_code, is_public)
values ('d0000000-0000-0000-0000-0000000000c1', 'd0000000-0000-0000-0000-0000000000b1',
        'd0000000-0000-0000-0000-00000000000b', '일반 그룹', 'demo-inv-01', true);

select is(
  (select nickname from public.profiles where id = '00000000-0000-4000-8000-00000000d001'),
  '서연',
  '예시 회원 프로필이 있다'
);

-- 익명 방문자 ---------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d0000000-0000-0000-0000-00000000000a","role":"authenticated","is_anonymous":true}';

select throws_ok(
  $$ insert into public.books (title) values ('익명이 만든 책') $$,
  '42501', null,
  '익명 사용자는 책을 등록할 수 없다'
);
select throws_ok(
  $$ insert into public.groups (book_id, name) values ('d0000000-0000-0000-0000-0000000000b1', '익명 그룹') $$,
  '42501', null,
  '익명 사용자는 그룹을 직접 만들 수 없다'
);
select throws_ok(
  $$ select public.join_group('demo-inv-01') $$,
  'P0001', 'anonymous_not_allowed',
  '익명 사용자는 다른 그룹에 들어갈 수 없다'
);

select lives_ok(
  $$ select set_config('test.demo', public.start_demo()::text, true) $$,
  '익명 사용자는 체험 그룹을 만들 수 있다'
);
select is(
  (select count(*) from public.memberships where group_id = current_setting('test.demo')::uuid),
  3::bigint,
  '체험 그룹은 방문자 + 예시 회원 2명'
);
select is(
  (select owner_id from public.groups where id = current_setting('test.demo')::uuid),
  'd0000000-0000-0000-0000-00000000000a'::uuid,
  '방문자가 체험 그룹의 리더다'
);
select is(
  (select is_demo and not is_public from public.groups where id = current_setting('test.demo')::uuid),
  true,
  '체험 그룹은 비공개 체험 그룹으로 표시된다'
);

-- 진도 1장 60%: 1장 20%·45%는 보이고, 1장 80%·2장 이후·책 전체 글은 잠겨 있다.
select is(
  (select count(*) from public.quotes where group_id = current_setting('test.demo')::uuid),
  1::bigint,
  '진도 안의 인용 카드만 보인다'
);
select is(
  (select count(*) from public.notes where group_id = current_setting('test.demo')::uuid),
  4::bigint,
  '진도 안의 감상·답글·질문만 보인다'
);
select ok(
  (select quotes = 1 and notes = 1 from public.locked_counts(current_setting('test.demo')::uuid) where chapter = 2),
  '2장에 잠긴 카드 1개, 감상 1개가 있다'
);

update public.memberships set progress_chapter = 2, progress_pct = 50
where group_id = current_setting('test.demo')::uuid and user_id = auth.uid();
select is(
  (select count(*) from public.quotes where group_id = current_setting('test.demo')::uuid),
  2::bigint,
  '진도를 2장 50%로 올리면 2장 카드가 열린다'
);

select lives_ok(
  $$ select public.create_quote(current_setting('test.demo')::uuid, 2, 40, '방문자가 옮긴 문장', '방문자의 감상', 'impression') $$,
  '방문자는 체험 그룹에 인용 카드를 쓸 수 있다'
);

select lives_ok(
  $$ select set_config('test.demo2', public.start_demo()::text, true) $$,
  '체험을 다시 시작할 수 있다'
);
select is(
  (select count(*) from public.groups where owner_id = auth.uid() and is_demo),
  1::bigint,
  '다시 시작하면 이전 체험 그룹은 지워진다'
);

-- 정원이 남아 있어도 막히는지 보려고 리더(방문자)가 정원을 늘린다.
update public.groups set capacity = 8 where id = current_setting('test.demo2')::uuid;
select 1 from (
  select set_config('test.inv', (select invite_code from public.groups where id = current_setting('test.demo2')::uuid), true)
) s;

-- 일반 회원 ------------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"d0000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select throws_ok(
  $$ select public.start_demo() $$,
  'P0001', 'demo_anonymous_only',
  '가입한 회원은 체험 그룹을 만들지 않는다'
);
select throws_ok(
  $$ select public.join_group(current_setting('test.inv')) $$,
  'P0001', 'demo_group_closed',
  '체험 그룹에는 초대 코드로도 들어갈 수 없다'
);

select * from finish();
rollback;
