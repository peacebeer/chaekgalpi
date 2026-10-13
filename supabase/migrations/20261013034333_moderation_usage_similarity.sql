-- 책갈피 DB (4): 리더의 인용 카드 관리, 그룹 인용 한도 조회, 비슷한 카드 판정 개선

-- 1) 리더의 인용 카드 관리 -------------------------------------------------------
-- 등록자가 그룹을 나가면 카드를 고칠 사람이 없어지고, 권리자 요청이나 스포일러 같은 문제에
-- 대응할 방법도 필요하다. 리더는 (a) 남의 카드의 오타를 고치고 (b) 카드를 내릴 수 있다.

-- (a) 수정: 등록자 또는 리더. 무엇을 얼마나 바꿀 수 있는지는 아래 트리거가 정한다.
drop policy "quotes_update" on public.quotes;
create policy "quotes_update" on public.quotes for update to authenticated
  using (created_by = auth.uid() or public.is_owner(group_id))
  with check (created_by = auth.uid() or public.is_owner(group_id));

-- 등록자가 아닌 사람(리더)은 카드가 잠겼든 아니든 오타 수정(바뀐 구간 10자 이하)만 할 수 있다.
-- 등록자 본인의 규칙은 그대로다: 잠기기 전에는 자유롭게, 잠긴 뒤에는 오타 수정만.
create or replace function public.quotes_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int;
  v_others int;
  v_uid uuid := auth.uid();
begin
  if new.group_id <> old.group_id
     or new.chapter <> old.chapter
     or new.pct <> old.pct
     or new.created_by is distinct from old.created_by then
    raise exception 'quote_position_immutable';
  end if;

  if new.text is distinct from old.text then
    new.text := btrim(new.text);

    if (old.locked_at is not null
        or (v_uid is not null and old.created_by is distinct from v_uid))
       and public.changed_span(old.text, new.text) > 10 then
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

-- (b) 내리기: 리더만 부를 수 있는 함수로 따로 둔다. 직접 DELETE 규칙(등록자, 잠기기 전)은 그대로다.
-- 카드에 달린 감상과 답글도 함께 지워진다(notes.quote_id on delete cascade).
create function public.remove_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.quotes where id = p_quote_id;
  if v_group is null or not public.is_owner(v_group) then
    raise exception 'not_owner';
  end if;
  delete from public.quotes where id = p_quote_id;
end;
$$;

-- 2) 그룹 인용 한도 사용량 -------------------------------------------------------
-- 아직 못 읽은 위치의 카드까지 합친 글자 수와 한도. 본문은 돌려주지 않는다.
create function public.quote_usage(p_group_id uuid)
returns table (used int, quote_limit int)
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
  select
    coalesce((select sum(char_length(q.text)) from public.quotes q where q.group_id = p_group_id), 0)::int,
    g.quote_limit
  from public.groups g
  where g.id = p_group_id;
end;
$$;

revoke all on function public.remove_quote(uuid) from public, anon, authenticated;
revoke all on function public.quote_usage(uuid) from public, anon, authenticated;
grant execute on function public.remove_quote(uuid), public.quote_usage(uuid) to authenticated;

-- 3) 비슷한 카드 추천 개선 -------------------------------------------------------
-- - 띄어쓰기·문장부호 차이를 무시한다(지우고 비교).
-- - 입력 중인 일부만으로도 찾는다(word_similarity: 한쪽이 다른 쪽의 일부일 때 높게 나온다).
-- - 문장이 거의 같으면 다른 장의 카드도 찾는다(장을 잘못 고른 경우).
-- security invoker라 RLS가 그대로 적용되어 내가 볼 수 있는 카드만 나온다.
create or replace function public.similar_quotes(p_group_id uuid, p_chapter int, p_pct numeric, p_text text)
returns table (id uuid, text text, chapter int, pct numeric, score real)
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select regexp_replace(coalesce(p_text, ''), '[[:space:][:punct:]]+', '', 'g') as t
  ),
  scored as (
    select q.id, q.text, q.chapter, q.pct,
      case when char_length(i.t) = 0 then 0::real
      else greatest(
        extensions.similarity(k.t, i.t),
        extensions.word_similarity(i.t, k.t),
        extensions.word_similarity(k.t, i.t)
      ) end as score
    from public.quotes q
    cross join input i
    cross join lateral (
      select regexp_replace(q.text, '[[:space:][:punct:]]+', '', 'g') as t
    ) k
    where q.group_id = p_group_id
  )
  select s.id, s.text, s.chapter, s.pct, s.score
  from scored s
  where (s.chapter = p_chapter and (s.score >= 0.3 or abs(s.pct - p_pct) <= 5))
     or s.score >= 0.6
  order by s.score desc, abs(s.pct - p_pct)
  limit 5;
$$;
