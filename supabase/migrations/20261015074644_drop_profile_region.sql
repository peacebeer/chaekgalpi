-- 회원 지역 정보를 받지 않기로 했다(2026-10-15). 저장된 값도 함께 지운다.
-- 열을 지우면 이 열에 준 update 권한도 함께 사라진다.
alter table public.profiles drop column region;
