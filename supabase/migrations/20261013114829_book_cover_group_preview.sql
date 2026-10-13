-- 책갈피 DB (5): 책 표지, 카카오 책 검색 출처, 가입 전 그룹 미리 보기

-- 1) 책 표지 주소 -----------------------------------------------------------------
-- 이미지 파일은 저장하지 않고 검색 서비스가 준 https 주소만 적어 둔다.
alter table public.books
  add column cover_url text
  check (cover_url is null or (char_length(cover_url) <= 500 and cover_url ~ '^https://'));

grant insert (cover_url), update (cover_url) on public.books to authenticated;

-- 2) 책 정보 출처에 카카오 책 검색 추가 ----------------------------------------------
alter table public.books drop constraint books_source_check;
alter table public.books
  add constraint books_source_check check (source in ('nlk', 'kakao', 'manual'));

-- 3) 가입 전 그룹 미리 보기 ---------------------------------------------------------
-- 초대 코드를 가진 사람(비공개·공개 모두)이나 공개 그룹을 보는 사람에게, 입장 전에
-- 그룹 이름·리더·읽는 기간·책·목차를 알려 준다. 회원 목록과 감상은 돌려주지 않는다.
-- 비공개 그룹은 초대 코드로만 볼 수 있다(코드를 가진 사람은 어차피 입장할 수 있다).
create function public.group_preview(p_invite_code text default null, p_group_id uuid default null)
returns table (
  id uuid,
  name text,
  capacity int,
  member_count int,
  start_date date,
  target_date date,
  is_public boolean,
  is_member boolean,
  leader_nickname text,
  book_title text,
  book_author text,
  book_translator text,
  book_publisher text,
  book_pages int,
  book_cover_url text,
  chapters jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_invite_code is not null then
    select g.* into v_group from public.groups g where g.invite_code = p_invite_code;
  else
    select g.* into v_group from public.groups g where g.id = p_group_id and g.is_public;
  end if;
  if not found then
    raise exception 'group_not_found';
  end if;

  return query
  select
    v_group.id,
    v_group.name,
    v_group.capacity,
    (select count(*)::int from public.memberships m where m.group_id = v_group.id),
    v_group.start_date,
    v_group.target_date,
    v_group.is_public,
    exists (select 1 from public.memberships m where m.group_id = v_group.id and m.user_id = v_uid),
    (select p.nickname from public.profiles p where p.id = v_group.owner_id),
    b.title,
    b.author,
    b.translator,
    b.publisher,
    b.pages,
    b.cover_url,
    coalesce(
      (select jsonb_agg(jsonb_build_object('number', c.number, 'title', c.title) order by c.number)
       from public.book_chapters c where c.book_id = b.id),
      '[]'::jsonb
    )
  from public.books b
  where b.id = v_group.book_id;
end;
$$;

revoke all on function public.group_preview(text, uuid) from public, anon, authenticated;
grant execute on function public.group_preview(text, uuid) to authenticated;
