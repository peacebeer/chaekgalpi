-- 책갈피 DB (3/3): 앱에서 호출하는 함수(RPC), 행 단위 보안(RLS), 권한, 실시간
-- 오류는 영어 키(예: quote_limit_exceeded)로 던지고, 화면 문구는 앱에서 한국어로 바꾼다.

-- RPC ---------------------------------------------------------------------------

-- 초대 코드 또는 공개 그룹 id로 입장. 이미 회원이면 그대로 그룹 id를 돌려준다.
create function public.join_group(p_invite_code text default null, p_group_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups%rowtype;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_invite_code is not null then
    select * into v_group from public.groups where invite_code = p_invite_code for update;
  else
    select * into v_group from public.groups where id = p_group_id and is_public for update;
  end if;
  if not found then
    raise exception 'group_not_found';
  end if;

  if exists (select 1 from public.memberships where group_id = v_group.id and user_id = v_uid) then
    return v_group.id;
  end if;

  select count(*) into v_count from public.memberships where group_id = v_group.id;
  if v_count >= v_group.capacity then
    raise exception 'group_full';
  end if;

  insert into public.memberships (group_id, user_id, role) values (v_group.id, v_uid, 'member');
  return v_group.id;
end;
$$;

-- 인용 카드 등록. 카드와 첫 감상을 한 번에 저장하고, 그룹 인용 합계 한도를 확인한다.
create function public.create_quote(
  p_group_id uuid,
  p_chapter int,
  p_pct numeric,
  p_text text,
  p_body text,
  p_kind text default 'impression'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_text text := btrim(coalesce(p_text, ''));
  v_limit int;
  v_used int;
  v_max_chapter int;
  v_quote_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_member(p_group_id) then
    raise exception 'not_member';
  end if;
  if char_length(v_text) = 0 then
    raise exception 'quote_empty';
  end if;
  if char_length(v_text) > 300 then
    raise exception 'quote_too_long';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'body_required';
  end if;
  if p_chapter is null or p_chapter < 1 or p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'position_invalid';
  end if;

  select max(bc.number) into v_max_chapter
  from public.book_chapters bc join public.groups g on g.book_id = bc.book_id
  where g.id = p_group_id;
  if v_max_chapter is not null and p_chapter > v_max_chapter then
    raise exception 'chapter_not_found';
  end if;

  if not public.can_see(p_group_id, p_chapter, p_pct) then
    raise exception 'position_ahead_of_progress';
  end if;

  -- 같은 그룹에서 동시에 등록해도 한도를 넘지 않도록 그룹 행을 잠근다.
  select quote_limit into v_limit from public.groups where id = p_group_id for update;
  select coalesce(sum(char_length(text)), 0) into v_used from public.quotes where group_id = p_group_id;
  if v_used + char_length(v_text) > v_limit then
    raise exception 'quote_limit_exceeded';
  end if;

  insert into public.quotes (group_id, chapter, pct, text, created_by)
  values (p_group_id, p_chapter, p_pct, v_text, v_uid)
  returning id into v_quote_id;

  insert into public.notes (group_id, author_id, quote_id, kind, body)
  values (p_group_id, v_uid, v_quote_id, p_kind, btrim(p_body));

  return v_quote_id;
end;
$$;

-- 인용 입력 중 비슷한 기존 카드 추천: 같은 장에서 문장이 비슷하거나 위치가 가까운(±5%) 카드.
-- security invoker라 RLS가 그대로 적용되어 내가 볼 수 있는 카드만 나온다.
create function public.similar_quotes(p_group_id uuid, p_chapter int, p_pct numeric, p_text text)
returns table (id uuid, text text, chapter int, pct numeric, score real)
language sql
stable
security invoker
set search_path = ''
as $$
  select q.id, q.text, q.chapter, q.pct, extensions.similarity(q.text, coalesce(p_text, '')) as score
  from public.quotes q
  where q.group_id = p_group_id
    and q.chapter = p_chapter
    and (extensions.similarity(q.text, coalesce(p_text, '')) >= 0.3 or abs(q.pct - p_pct) <= 5)
  order by score desc, abs(q.pct - p_pct)
  limit 5;
$$;

-- 흐림 처리용: 아직 볼 수 없는 카드·감상의 장별 개수만 돌려준다(본문은 절대 포함하지 않음).
-- chapter가 NULL인 행은 "책 전체" 노트.
create function public.locked_counts(p_group_id uuid)
returns table (chapter int, quotes bigint, notes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_member(p_group_id) then
    raise exception 'not_member';
  end if;

  return query
  with hidden as (
    select q.chapter, 1 as is_quote
    from public.quotes q
    where q.group_id = p_group_id and not public.can_see(q.group_id, q.chapter, q.pct)
    union all
    select n.chapter, 0 as is_quote
    from public.notes n
    where n.group_id = p_group_id and n.hidden_at is null
      and not public.can_see(n.group_id, n.chapter, n.pct)
  )
  select h.chapter, sum(h.is_quote)::bigint, sum(1 - h.is_quote)::bigint
  from hidden h
  group by h.chapter
  order by h.chapter nulls last;
end;
$$;

-- 쪽수 → (장, %) 환산. 대표 도서 모든 장에 시작 쪽이 있어야 한다.
-- 마지막 장의 끝을 알 수 없으면(books.pages 없음) pct는 NULL로 돌려주고, 화면은 슬라이더로 받는다.
create function public.page_to_position(p_book_id uuid, p_page int)
returns table (chapter int, pct numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_pages int;
  v_start int;
  v_end int;
  v_chapter int;
begin
  if p_page is null or p_page < 1 then
    raise exception 'page_invalid';
  end if;
  if not exists (select 1 from public.book_chapters where book_id = p_book_id)
     or exists (select 1 from public.book_chapters where book_id = p_book_id and start_page is null) then
    raise exception 'page_mapping_unavailable';
  end if;

  select b.pages into v_pages from public.books b where b.id = p_book_id;

  select c.number, c.start_page, c.next_start
    into v_chapter, v_start, v_end
  from (
    select bc.number, bc.start_page,
           lead(bc.start_page) over (order by bc.number) as next_start
    from public.book_chapters bc
    where bc.book_id = p_book_id
  ) c
  where c.start_page <= p_page
  order by c.number desc
  limit 1;

  if v_chapter is null then
    -- 첫 장 시작 쪽보다 앞(머리말 등)
    select min(bc.number) into v_chapter from public.book_chapters bc where bc.book_id = p_book_id;
    return query select v_chapter, 0::numeric;
    return;
  end if;

  v_end := coalesce(v_end, v_pages + 1);
  if v_end is null then
    return query select v_chapter, null::numeric;
  elsif v_end <= v_start then
    return query select v_chapter, 0::numeric;
  else
    return query select v_chapter,
      least(100, greatest(0, round(100.0 * (p_page - v_start) / (v_end - v_start), 2)))::numeric;
  end if;
end;
$$;

-- 그룹 리더가 감상을 숨기거나 다시 보이게 한다.
create function public.hide_note(p_note_id uuid, p_hidden boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.notes where id = p_note_id;
  if v_group is null or not public.is_owner(v_group) then
    raise exception 'not_owner';
  end if;
  update public.notes
  set hidden_at = case when p_hidden then now() else null end
  where id = p_note_id;
end;
$$;

-- RLS ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.book_chapters enable row level security;
alter table public.groups enable row level security;
alter table public.memberships enable row level security;
alter table public.quotes enable row level security;
alter table public.notes enable row level security;
alter table public.reactions enable row level security;

-- profiles: 본인과 같은 그룹 회원만 조회
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group(id));
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- books, book_chapters: 로그인한 누구나 조회·등록, 수정은 등록자
create policy "books_select" on public.books for select to authenticated using (true);
create policy "books_insert" on public.books for insert to authenticated
  with check (created_by = auth.uid());
create policy "books_update" on public.books for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "book_chapters_select" on public.book_chapters for select to authenticated using (true);
create policy "book_chapters_insert" on public.book_chapters for insert to authenticated
  with check (exists (select 1 from public.books b where b.id = book_id and b.created_by = auth.uid()));
create policy "book_chapters_update" on public.book_chapters for update to authenticated
  using (exists (select 1 from public.books b where b.id = book_id and b.created_by = auth.uid()));
create policy "book_chapters_delete" on public.book_chapters for delete to authenticated
  using (
    exists (select 1 from public.books b where b.id = book_id and b.created_by = auth.uid())
    and not public.chapter_in_use(book_id, number)
  );

-- groups: 공개 그룹 또는 내 그룹만 조회, 리더만 수정·삭제
create policy "groups_select" on public.groups for select to authenticated
  using (is_public or public.is_member(id));
create policy "groups_insert" on public.groups for insert to authenticated
  with check (owner_id = auth.uid());
create policy "groups_update" on public.groups for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
create policy "groups_delete" on public.groups for delete to authenticated
  using (public.is_owner(id));

-- memberships: 같은 그룹 회원만 조회, 입장은 join_group()으로만, 본인 진도만 수정
create policy "memberships_select" on public.memberships for select to authenticated
  using (public.is_member(group_id));
create policy "memberships_update" on public.memberships for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "memberships_delete" on public.memberships for delete to authenticated
  using (role = 'member' and (user_id = auth.uid() or public.is_owner(group_id)));

-- quotes: 진도 잠금 통과한 카드만 조회, 등록은 create_quote()로만, 잠기기 전에만 삭제
create policy "quotes_select" on public.quotes for select to authenticated
  using (public.can_see(group_id, chapter, pct));
create policy "quotes_update" on public.quotes for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "quotes_delete" on public.quotes for delete to authenticated
  using (created_by = auth.uid() and locked_at is null);

-- notes: 진도 잠금 통과 + (숨김 아님 또는 작성자·리더), 내 진도 이하 위치에만 작성
create policy "notes_select" on public.notes for select to authenticated
  using (
    public.can_see(group_id, chapter, pct)
    and (hidden_at is null or author_id = auth.uid() or public.is_owner(group_id))
  );
create policy "notes_insert" on public.notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_member(group_id)
    and public.can_see(group_id, chapter, pct)
  );
create policy "notes_update" on public.notes for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "notes_delete" on public.notes for delete to authenticated
  using (author_id = auth.uid());

-- reactions: 볼 수 있는 노트에만 좋아요, 본인 것만 취소
create policy "reactions_select" on public.reactions for select to authenticated
  using (exists (select 1 from public.notes n where n.id = note_id));
create policy "reactions_insert" on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.notes n where n.id = note_id));
create policy "reactions_delete" on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- 권한 --------------------------------------------------------------------------
-- 비로그인(anon)은 아무 테이블에도 접근할 수 없다.
-- 로그인 사용자는 바꿔도 되는 컬럼만 쓸 수 있다(위치·소유자·잠금 같은 값은 함수와 트리거만 변경).
revoke all on all tables in schema public from anon, authenticated;

grant select on all tables in schema public to authenticated;

grant update (nickname, region) on public.profiles to authenticated;

grant insert (isbn, title, author, translator, publisher, pages, source) on public.books to authenticated;
grant update (isbn, title, author, translator, publisher, pages) on public.books to authenticated;

grant insert, delete on public.book_chapters to authenticated;
grant update (title, start_page) on public.book_chapters to authenticated;

grant insert (book_id, name, capacity, start_date, target_date, is_public) on public.groups to authenticated;
grant update (name, capacity, start_date, target_date, is_public) on public.groups to authenticated;
grant delete on public.groups to authenticated;

grant update (progress_chapter, progress_pct, finished_at) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;

grant update (text) on public.quotes to authenticated;
grant delete on public.quotes to authenticated;

grant insert (group_id, chapter, pct, kind, body, quote_id, parent_id) on public.notes to authenticated;
grant update (body, kind) on public.notes to authenticated;
grant delete on public.notes to authenticated;

grant insert (note_id) on public.reactions to authenticated;
grant delete on public.reactions to authenticated;

-- 함수는 기본적으로 막고, 앱이 부르는 RPC와 정책 도우미만 연다.
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.join_group(text, uuid),
  public.create_quote(uuid, int, numeric, text, text, text),
  public.similar_quotes(uuid, int, numeric, text),
  public.locked_counts(uuid),
  public.page_to_position(uuid, int),
  public.hide_note(uuid, boolean),
  public.is_member(uuid),
  public.is_owner(uuid),
  public.can_see(uuid, int, numeric),
  public.shares_group(uuid),
  public.chapter_in_use(uuid, int)
to authenticated;

-- 실시간 반영 대상 (Supabase Realtime도 위 RLS를 따른다) ----------------------------
alter publication supabase_realtime add table public.quotes, public.notes, public.reactions, public.memberships;
