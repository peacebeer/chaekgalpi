-- ISBN 하나에 목차 여러 벌(버전)을 둔다.
-- 지금까지는 같은 ISBN이면 처음 등록한 사람의 목차만 쓸 수 있었다. 이제 같은 ISBN의 책 행을
-- 목차 버전마다 하나씩 두고, 그룹을 만들 때 쓸 버전을 고르거나 고쳐서 새 버전을 만든다.
-- 이미 그룹이 쓰는 목차는 바꾸지 않는다(글 위치가 어긋나므로). 고치면 항상 새 버전이 된다.

alter table public.books drop constraint books_isbn_key;
create index books_isbn_idx on public.books (isbn) where isbn is not null;

alter table public.books
  -- 어느 버전을 바탕으로 고쳐 만들었는지
  add column based_on uuid references public.books (id) on delete set null,
  -- 목차 출처: 국립중앙도서관 자료를 그대로 쓴 것('nlk') 또는 회원이 입력·수정한 것('member')
  add column toc_source text not null default 'member' check (toc_source in ('nlk', 'member'));

grant insert (based_on, toc_source) on public.books to authenticated;

-- 같은 ISBN의 목차 버전 목록 -------------------------------------------------------------
-- 정렬: 도서관 제공 → 쓰는 그룹이 많은 것 → 모든 장의 시작 쪽과 전체 쪽수가 있는 것 → 먼저 만든 것
-- 그룹 수는 회원이 아니어도 셀 수 있어야 해서 security definer로 센다(그룹 내용은 돌려주지 않는다).
-- 목차가 없는 행(등록 중 실패 등)과 체험 그룹은 빼고 센다.
create function public.toc_versions(p_isbn text)
returns table (
  book_id uuid,
  title text,
  author text,
  translator text,
  publisher text,
  pages int,
  cover_url text,
  toc_source text,
  chapter_count int,
  has_start_pages boolean,
  group_count int,
  chapters jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.title,
    b.author,
    b.translator,
    b.publisher,
    b.pages,
    b.cover_url,
    b.toc_source,
    c.chapter_count::int,
    (b.pages is not null and c.missing_pages = 0),
    g.group_count::int,
    c.chapters,
    b.created_at
  from public.books b
  cross join lateral (
    select
      count(*) as chapter_count,
      count(*) filter (where bc.start_page is null) as missing_pages,
      jsonb_agg(
        jsonb_build_object('number', bc.number, 'title', bc.title, 'start_page', bc.start_page)
        order by bc.number
      ) as chapters
    from public.book_chapters bc
    where bc.book_id = b.id
  ) c
  cross join lateral (
    select count(*) as group_count
    from public.groups gr
    where gr.book_id = b.id and not gr.is_demo
  ) g
  where auth.uid() is not null
    and b.isbn = p_isbn
    and c.chapter_count > 0
  order by
    (b.toc_source = 'nlk') desc,
    g.group_count desc,
    (b.pages is not null and c.missing_pages = 0) desc,
    b.created_at asc;
$$;

revoke all on function public.toc_versions(text) from public, anon, authenticated;
grant execute on function public.toc_versions(text) to authenticated;
