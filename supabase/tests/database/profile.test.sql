-- 책갈피 테스트 (pgTAP): 프로필에는 닉네임만 남고 지역 정보는 받지 않는다.
-- 모든 변경은 마지막 rollback으로 되돌려진다.

begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select hasnt_column('public', 'profiles', 'region', '프로필에 지역 열이 없다');
select has_column('public', 'profiles', 'nickname', '닉네임 열은 남아 있다');
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'nickname', 'UPDATE'),
  '로그인 사용자는 닉네임을 고칠 수 있다'
);

select * from finish();
rollback;
