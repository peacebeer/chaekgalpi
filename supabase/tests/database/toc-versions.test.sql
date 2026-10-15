-- 책갈피 테스트 (pgTAP): ISBN 하나에 목차 여러 벌(버전)
-- 모든 변경은 마지막 rollback으로 되돌려진다.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

-- 준비: A, B 두 회원 ----------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('e1000000-0000-0000-0000-00000000000a', 'a@toc.dev', '{"nickname":"A"}'),
  ('e1000000-0000-0000-0000-00000000000b', 'b@toc.dev', '{"nickname":"B"}');

-- 버전 1: A가 만든 회원 입력 목차, 시작 쪽 없음, 그룹 2개
insert into public.books (id, isbn, title, created_by) values
  ('e1000000-0000-0000-0000-0000000000b1', '9788936434120', '소년이 온다', 'e1000000-0000-0000-0000-00000000000a');
insert into public.book_chapters (book_id, number, title) values
  ('e1000000-0000-0000-0000-0000000000b1', 1, '어린 새'),
  ('e1000000-0000-0000-0000-0000000000b1', 2, '검은 숨');
insert into public.groups (book_id, owner_id, name) values
  ('e1000000-0000-0000-0000-0000000000b1', 'e1000000-0000-0000-0000-00000000000a', '그룹 1'),
  ('e1000000-0000-0000-0000-0000000000b1', 'e1000000-0000-0000-0000-00000000000a', '그룹 2');

-- 버전 2: 버전 1을 바탕으로, 시작 쪽과 전체 쪽수가 있는 목차, 그룹 1개
insert into public.books (id, isbn, title, pages, based_on, created_by) values
  ('e1000000-0000-0000-0000-0000000000b2', '9788936434120', '소년이 온다', 215,
   'e1000000-0000-0000-0000-0000000000b1', 'e1000000-0000-0000-0000-00000000000a');
insert into public.book_chapters (book_id, number, title, start_page) values
  ('e1000000-0000-0000-0000-0000000000b2', 1, '어린 새', 7),
  ('e1000000-0000-0000-0000-0000000000b2', 2, '검은 숨', 45);
insert into public.groups (book_id, owner_id, name) values
  ('e1000000-0000-0000-0000-0000000000b2', 'e1000000-0000-0000-0000-00000000000a', '그룹 3');

-- 버전 3: 도서관 제공 목차, 그룹 없음
insert into public.books (id, isbn, title, toc_source) values
  ('e1000000-0000-0000-0000-0000000000b3', '9788936434120', '소년이 온다', 'nlk');
insert into public.book_chapters (book_id, number, title) values
  ('e1000000-0000-0000-0000-0000000000b3', 1, '1장');

-- 목차 없이 남은 행(등록 중 실패)
insert into public.books (id, isbn, title) values
  ('e1000000-0000-0000-0000-0000000000b4', '9788936434120', '소년이 온다');

-- A가 같은 ISBN으로 목차 버전을 하나 더 만든다 -----------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"e1000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ insert into public.books (isbn, title, based_on, toc_source)
     values ('9788936434120', '소년이 온다', 'e1000000-0000-0000-0000-0000000000b1', 'member') $$,
  '로그인 사용자는 같은 ISBN으로 목차 버전을 하나 더 만들 수 있다'
);

-- 다른 회원 B가 버전 목록을 본다 ----------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"e1000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is(
  (select count(*) from public.groups where book_id in (
    'e1000000-0000-0000-0000-0000000000b1', 'e1000000-0000-0000-0000-0000000000b2')),
  0::bigint,
  'B는 A의 비공개 그룹을 직접 볼 수 없다'
);
select results_eq(
  $$ select book_id from public.toc_versions('9788936434120') $$,
  $$ values ('e1000000-0000-0000-0000-0000000000b3'::uuid),
            ('e1000000-0000-0000-0000-0000000000b1'::uuid),
            ('e1000000-0000-0000-0000-0000000000b2'::uuid) $$,
  '도서관 제공 → 쓰는 그룹이 많은 순서이고, 목차 없는 행은 빠진다'
);
select is(
  (select group_count from public.toc_versions('9788936434120') where book_id = 'e1000000-0000-0000-0000-0000000000b1'),
  2,
  '그룹 내용은 볼 수 없어도 쓰는 그룹 수는 센다'
);
select is(
  (select array[chapter_count::text, has_start_pages::text] from public.toc_versions('9788936434120')
   where book_id = 'e1000000-0000-0000-0000-0000000000b2'),
  array['2', 'true'],
  '장 수와 시작 쪽 유무를 알려 준다'
);
select is(
  (select chapters -> 1 ->> 'title' from public.toc_versions('9788936434120')
   where book_id = 'e1000000-0000-0000-0000-0000000000b2'),
  '검은 숨',
  '목차를 장 순서대로 돌려준다'
);
select is(
  (select count(*) from public.toc_versions('9780000000000')),
  0::bigint,
  '등록되지 않은 ISBN은 빈 목록이다'
);

-- 그룹 수가 같으면 시작 쪽이 있는 버전이 앞선다
-- B가 버전 2로 그룹을 하나 만든다(리더는 자동으로 B)
insert into public.groups (book_id, name) values
  ('e1000000-0000-0000-0000-0000000000b2', '그룹 4');
select is(
  (select array_agg(book_id order by ordinality)
   from public.toc_versions('9788936434120') with ordinality),
  array['e1000000-0000-0000-0000-0000000000b3', 'e1000000-0000-0000-0000-0000000000b2',
        'e1000000-0000-0000-0000-0000000000b1']::uuid[],
  '그룹 수가 같으면 시작 쪽과 전체 쪽수가 있는 버전이 앞선다'
);

select throws_ok(
  $$ insert into public.books (isbn, title, toc_source) values ('9788936434120', '소년이 온다', 'other') $$,
  '23514', null,
  '목차 출처는 nlk, member만 받는다'
);

-- 로그인하지 않으면 아무것도 돌려주지 않는다
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.toc_versions('9788936434120') $$,
  '42501', null,
  '로그인하지 않은 사용자는 목록을 부를 수 없다'
);

select * from finish();
rollback;
