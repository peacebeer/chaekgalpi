-- 책갈피 DB (2/3): 도우미 함수와 트리거
-- 모든 security definer 함수는 search_path를 비워 두고 스키마를 명시한다.

-- 가입 시 프로필 자동 생성 ---------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text;
begin
  v_nickname := left(btrim(coalesce(
    nullif(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    '독자'
  )), 30);
  if v_nickname = '' then
    v_nickname := '독자';
  end if;
  insert into public.profiles (id, nickname) values (new.id, v_nickname);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS 정책에서 쓰는 도우미 -----------------------------------------------------
-- 정책 안에서 memberships를 다시 조회하면 재귀가 생기므로 security definer로 우회한다.

create function public.is_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = p_group_id and m.user_id = auth.uid()
  );
$$;

create function public.is_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = p_group_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- 진도 잠금 판정: 그룹 회원이고, (장, %) 위치가 내 진도 이하이거나 내가 완독했으면 볼 수 있다.
-- 위치가 없는(chapter IS NULL) 노트는 "책 전체"로 취급해 완독자에게만 보인다.
create function public.can_see(p_group_id uuid, p_chapter int, p_pct numeric)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
      and (
        m.finished_at is not null
        or (p_chapter is not null
            and (p_chapter, coalesce(p_pct, 0)) <= (m.progress_chapter, m.progress_pct))
      )
  );
$$;

-- 같은 그룹 회원끼리만 서로의 프로필을 볼 수 있다.
create function public.shares_group(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;

-- 이 장을 가리키는 카드·노트가 있으면 목차에서 지울 수 없다.
create function public.chapter_in_use(p_book_id uuid, p_number int)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quotes q join public.groups g on g.id = q.group_id
    where g.book_id = p_book_id and q.chapter = p_number
  ) or exists (
    select 1 from public.notes n join public.groups g on g.id = n.group_id
    where g.book_id = p_book_id and n.chapter = p_number
  );
$$;

-- 두 문자열에서 실제로 바뀐 구간의 길이(앞뒤 공통 부분을 뺀 나머지).
-- 잠긴 인용 카드의 "오타 수정"을 판정하는 데 쓴다.
create function public.changed_span(p_old text, p_new text)
returns int
language plpgsql
immutable
set search_path = ''
as $$
declare
  la int := char_length(p_old);
  lb int := char_length(p_new);
  pre int := 0;
  suf int := 0;
begin
  while pre < least(la, lb) and substr(p_old, pre + 1, 1) = substr(p_new, pre + 1, 1) loop
    pre := pre + 1;
  end loop;
  while suf < least(la, lb) - pre
        and substr(p_old, la - suf, 1) = substr(p_new, lb - suf, 1) loop
    suf := suf + 1;
  end loop;
  return greatest(la - pre - suf, lb - pre - suf);
end;
$$;

-- 공통: updated_at 갱신 ----------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 그룹을 만들면 만든 사람을 리더(owner)로 자동 가입 -----------------------------
create function public.groups_add_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null then
    insert into public.memberships (group_id, user_id, role)
    values (new.id, new.owner_id, 'owner');
  end if;
  return new;
end;
$$;

create trigger groups_add_owner
  after insert on public.groups
  for each row execute function public.groups_add_owner();

-- 진도는 대표 도서 목차 범위 안이어야 한다 ---------------------------------------
create function public.memberships_check_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
begin
  select max(bc.number) into v_max
  from public.book_chapters bc
  join public.groups g on g.book_id = bc.book_id
  where g.id = new.group_id;

  if v_max is not null and new.progress_chapter > v_max then
    raise exception 'progress_out_of_range';
  end if;
  return new;
end;
$$;

create trigger memberships_check_progress
  before insert or update of progress_chapter on public.memberships
  for each row execute function public.memberships_check_progress();

-- 노트 위치 채우기: 인용 카드에 단 감상은 카드 위치를, 답글은 원글 위치를 따른다 ----
create function public.notes_fill_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.notes%rowtype;
  v_quote public.quotes%rowtype;
begin
  new.hidden_at := null;

  if new.parent_id is not null then
    select * into v_parent from public.notes where id = new.parent_id;
    if not found or v_parent.group_id <> new.group_id then
      raise exception 'note_parent_invalid';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'reply_depth_exceeded';
    end if;
    new.chapter := v_parent.chapter;
    new.pct := v_parent.pct;
    new.quote_id := v_parent.quote_id;
  elsif new.quote_id is not null then
    select * into v_quote from public.quotes where id = new.quote_id;
    if not found or v_quote.group_id <> new.group_id then
      raise exception 'note_quote_invalid';
    end if;
    new.chapter := v_quote.chapter;
    new.pct := v_quote.pct;
  end if;

  return new;
end;
$$;

create trigger notes_fill_position
  before insert on public.notes
  for each row execute function public.notes_fill_position();

-- 다른 회원이 감상을 달면 인용 카드를 잠근다 --------------------------------------
create function public.notes_lock_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.quote_id is not null then
    update public.quotes
    set locked_at = now()
    where id = new.quote_id
      and locked_at is null
      and created_by is distinct from new.author_id;
  end if;
  return new;
end;
$$;

create trigger notes_lock_quote
  after insert on public.notes
  for each row execute function public.notes_lock_quote();

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- 인용 카드 수정 규칙 ------------------------------------------------------------
-- 위치·그룹·등록자는 바꿀 수 없고, 잠긴 카드는 바뀐 구간이 10자 이하일 때만(오타 수정) 허용.
-- 수정으로 그룹 인용 합계 한도를 넘을 수 없다.
create function public.quotes_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int;
  v_others int;
begin
  if new.group_id <> old.group_id
     or new.chapter <> old.chapter
     or new.pct <> old.pct
     or new.created_by is distinct from old.created_by then
    raise exception 'quote_position_immutable';
  end if;

  if new.text is distinct from old.text then
    new.text := btrim(new.text);

    if old.locked_at is not null and public.changed_span(old.text, new.text) > 10 then
      raise exception 'quote_locked';
    end if;

    select g.quote_limit into v_limit from public.groups g where g.id = new.group_id;
    select coalesce(sum(char_length(q.text)), 0) into v_others
    from public.quotes q
    where q.group_id = new.group_id and q.id <> new.id;
    if v_others + char_length(new.text) > v_limit then
      raise exception 'quote_limit_exceeded';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger quotes_guard_update
  before update on public.quotes
  for each row execute function public.quotes_guard_update();
