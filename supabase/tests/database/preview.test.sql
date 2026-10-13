-- 책갈피 테스트 (pgTAP): 책 표지 주소, 카카오 출처, 가입 전 그룹 미리 보기
-- 모든 변경은 마지막 rollback으로 되돌려진다.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- 준비: A 리더, B 그룹 밖 회원 ---------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-2222-1111-1111-111111111111', 'a@prev.dev', '{"nickname":"리더A"}'),
  ('b2222222-2222-2222-2222-222222222222', 'b@prev.dev', '{}');

insert into public.books (id, title, author, pages, created_by)
values ('b00c0000-0000-0000-0000-0000000000a1', '미리 보기 도서', '지은이', 200,
        'a1111111-2222-1111-1111-111111111111');
insert into public.book_chapters (book_id, number, title) values
  ('b00c0000-0000-0000-0000-0000000000a1', 2, '둘째 장'),
  ('b00c0000-0000-0000-0000-0000000000a1', 1, '첫 장');

insert into public.groups (id, book_id, owner_id, name, invite_code, is_public, start_date, target_date)
values
  ('90000000-0000-0000-0000-0000000000a1', 'b00c0000-0000-0000-0000-0000000000a1',
   'a1111111-2222-1111-1111-111111111111', '비공개 모임', 'invite-prv1', false, '2026-11-01', '2026-11-30'),
  ('90000000-0000-0000-0000-0000000000a2', 'b00c0000-0000-0000-0000-0000000000a1',
   'a1111111-2222-1111-1111-111111111111', '공개 모임', 'invite-pub1', true, null, null);

-- 책 표지와 출처 ---------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"a1111111-2222-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ insert into public.books (title, source, cover_url)
     values ('카카오에서 찾은 책', 'kakao', 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=x') $$,
  '카카오 출처와 https 표지 주소로 책을 등록할 수 있다'
);
select throws_ok(
  $$ insert into public.books (title, cover_url) values ('나쁜 표지', 'http://example.com/a.jpg') $$,
  '23514', null,
  'https가 아닌 표지 주소는 거부한다'
);
select throws_ok(
  $$ insert into public.books (title, source) values ('모르는 출처', 'unknown') $$,
  '23514', null,
  '정해지지 않은 출처는 거부한다'
);
select lives_ok(
  $$ update public.books set cover_url = 'https://search1.kakaocdn.net/b.jpg' where title = '미리 보기 도서' $$,
  '등록자는 자기 책의 표지 주소를 바꿀 수 있다'
);

-- 가입 전 미리 보기: 그룹 밖 회원 B ------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.groups where id = '90000000-0000-0000-0000-0000000000a1'),
  0::bigint,
  '비공개 그룹은 회원이 아니면 직접 조회할 수 없다(기존 규칙)'
);
select results_eq(
  $$ select name, leader_nickname, member_count, start_date, target_date, is_member, book_title, book_pages
     from public.group_preview(p_invite_code => 'invite-prv1') $$,
  $$ values ('비공개 모임', '리더A', 1, '2026-11-01'::date, '2026-11-30'::date, false, '미리 보기 도서', 200) $$,
  '초대 코드가 있으면 비공개 그룹의 이름·리더·기간·책을 미리 볼 수 있다'
);
select is(
  (select chapters from public.group_preview(p_invite_code => 'invite-prv1')),
  '[{"title": "첫 장", "number": 1}, {"title": "둘째 장", "number": 2}]'::jsonb,
  '미리 보기의 목차는 장 순서대로 온다'
);
select throws_ok(
  $$ select * from public.group_preview(p_group_id => '90000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'group_not_found',
  '비공개 그룹은 id만으로는 미리 볼 수 없다'
);
select is(
  (select name from public.group_preview(p_group_id => '90000000-0000-0000-0000-0000000000a2')),
  '공개 모임',
  '공개 그룹은 id로 미리 볼 수 있다'
);
select throws_ok(
  $$ select * from public.group_preview(p_invite_code => 'no-such-code') $$,
  'P0001', 'group_not_found',
  '없는 초대 코드는 group_not_found'
);

-- 회원 A에게는 is_member가 참 -----------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a1111111-2222-1111-1111-111111111111","role":"authenticated"}';
select ok(
  (select is_member from public.group_preview(p_invite_code => 'invite-prv1')),
  '이미 회원이면 is_member가 참이다'
);

reset role;
select ok(
  not has_function_privilege('anon', 'public.group_preview(text, uuid)', 'execute'),
  '비로그인 사용자는 group_preview를 실행할 수 없다'
);

select * from finish();
rollback;
