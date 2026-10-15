-- 체험 모드: 가입 없이(Supabase 익명 로그인) 예시 글이 채워진 체험 그룹을 써 본다.
-- - 체험 그룹은 groups.is_demo = true. 방문자 1명 + 예시 회원 2명(로그인할 수 없는 계정)으로 이루어진다.
-- - 익명 사용자는 체험 그룹 밖에서는 그룹·책을 만들거나 다른 그룹에 들어갈 수 없다.
-- - 체험 그룹에는 방문자와 예시 회원 말고는 들어올 수 없다.

alter table public.groups add column is_demo boolean not null default false;

-- 익명 로그인 사용자인지 ------------------------------------------------------------
create function public.is_anonymous_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.is_anonymous from auth.users u where u.id = p_user_id), false);
$$;
revoke all on function public.is_anonymous_user(uuid) from public, anon, authenticated;
-- RLS 정책(아래 restrictive 정책)이 로그인 사용자 권한으로 부르므로 실행 권한이 필요하다.
grant execute on function public.is_anonymous_user(uuid) to authenticated;

-- 예시 회원 2명: 비밀번호·이메일이 없어 로그인할 수 없다. 프로필은 가입 트리거가 만든다.
insert into auth.users (id, instance_id, aud, role, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   '{"nickname": "서연"}', '{}', now(), now()),
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   '{"nickname": "도윤"}', '{}', now(), now())
on conflict (id) do nothing;

-- 체험용 책: 실제 책이 아닌, 이 서비스를 위해 지어낸 책이다(인용문도 모두 지어낸 문장).
insert into public.books (id, title, author, publisher, pages, source, created_by)
values ('00000000-0000-4000-8000-00000000b001', '작은 서점의 사계절 (체험용)', '책갈피', '책갈피', 160, 'manual', null)
on conflict (id) do nothing;

insert into public.book_chapters (book_id, number, title, start_page)
values
  ('00000000-0000-4000-8000-00000000b001', 1, '봄, 문을 여는 손', 7),
  ('00000000-0000-4000-8000-00000000b001', 2, '여름, 비 오는 오후', 41),
  ('00000000-0000-4000-8000-00000000b001', 3, '가을, 오래된 단골', 83),
  ('00000000-0000-4000-8000-00000000b001', 4, '겨울, 마지막 영업일', 120)
on conflict do nothing;

-- 익명 사용자는 책과 그룹을 직접 만들 수 없다(체험 그룹은 start_demo가 만든다).
create policy "books_insert_not_anonymous" on public.books as restrictive
  for insert to authenticated with check (not public.is_anonymous_user(auth.uid()));
create policy "groups_insert_not_anonymous" on public.groups as restrictive
  for insert to authenticated with check (not public.is_anonymous_user(auth.uid()));

-- 회원 추가 검사: 익명 사용자는 체험 그룹에만, 체험 그룹에는 리더와 예시 회원만 -------------
create function public.memberships_check_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_demo boolean;
begin
  select g.is_demo into v_demo from public.groups g where g.id = new.group_id;
  if v_demo then
    if new.role <> 'owner' and new.user_id not in (
      '00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d002'
    ) then
      raise exception 'demo_group_closed';
    end if;
  elsif public.is_anonymous_user(new.user_id) then
    raise exception 'anonymous_not_allowed';
  end if;
  return new;
end;
$$;

create trigger memberships_check_demo
  before insert on public.memberships
  for each row execute function public.memberships_check_demo();

-- 체험 그룹 만들기 --------------------------------------------------------------------
-- 방문자(익명 사용자)를 리더로 한 새 체험 그룹을 만들고 예시 글을 채운다.
-- 방문자의 진도는 1장 60%로 두어, 뒤쪽 글이 잠겨 있다가 진도를 올리면 열리는 것을 볼 수 있다.
create function public.start_demo()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_book uuid := '00000000-0000-4000-8000-00000000b001';
  v_a uuid := '00000000-0000-4000-8000-00000000d001';
  v_b uuid := '00000000-0000-4000-8000-00000000d002';
  v_group uuid;
  v_quote uuid;
  v_note uuid;
  v_reply uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_anonymous_user(v_uid) then
    raise exception 'demo_anonymous_only';
  end if;

  -- 내 이전 체험 그룹과, 하루 넘게 지난 체험 그룹은 지운다.
  delete from public.groups
  where is_demo and (owner_id = v_uid or created_at < now() - interval '1 day');

  insert into public.groups (book_id, owner_id, name, capacity, start_date, target_date, is_public, is_demo)
  values (v_book, v_uid, '체험 그룹: 작은 서점의 사계절', 3,
          current_date - 7, current_date + 21, false, true)
  returning id into v_group;

  update public.memberships set progress_chapter = 1, progress_pct = 60
  where group_id = v_group and user_id = v_uid;

  insert into public.memberships (group_id, user_id, role, progress_chapter, progress_pct, finished_at, joined_at)
  values
    (v_group, v_a, 'member', 4, 100, now() - interval '1 day', now() - interval '7 days'),
    (v_group, v_b, 'member', 3, 30, null, now() - interval '6 days');

  -- 1장 20%: 서연의 인용 카드 + 감상, 도윤의 감상(카드가 잠긴다), 서연의 답글, 좋아요
  insert into public.quotes (group_id, chapter, pct, text, created_by, created_at)
  values (v_group, 1, 20, '문을 열기 전 십 분, 나는 매일 같은 자리에서 책등을 쓸어 본다. 먼지보다 먼저 손에 닿는 건 어제 팔리지 않은 이야기들이다.', v_a, now() - interval '6 days')
  returning id into v_quote;
  insert into public.notes (group_id, author_id, quote_id, kind, body, created_at)
  values (v_group, v_a, v_quote, 'impression', '팔리지 않은 책을 실패가 아니라 "이야기"라고 부르는 시선이 좋았어요. 첫 장부터 주인공이 어떤 사람인지 보여요.', now() - interval '6 days');
  insert into public.notes (group_id, author_id, quote_id, kind, body, created_at)
  values (v_group, v_b, v_quote, 'impression', '저는 "매일 같은 자리"에 밑줄을 쳤어요. 반복이 지루함이 아니라 의식처럼 느껴졌어요.', now() - interval '5 days')
  returning id into v_note;
  insert into public.notes (group_id, author_id, parent_id, kind, body, created_at)
  values (v_group, v_a, v_note, 'impression', '맞아요. 2장에서 그 의식이 깨지는 장면이 나오는데, 거기까지 읽으면 이 문장이 다시 생각날 거예요.', now() - interval '5 days')
  returning id into v_reply;
  insert into public.reactions (note_id, user_id) values (v_note, v_a), (v_reply, v_b);

  -- 1장 45%: 도윤의 질문
  insert into public.notes (group_id, author_id, chapter, pct, kind, body, created_at)
  values (v_group, v_b, 1, 45, 'question', '서점 이름이 왜 끝까지 안 나오는지 궁금하지 않으세요? 일부러 숨긴 것 같아요.', now() - interval '4 days');

  -- 1장 80%: 방문자 진도(60%)보다 뒤라 처음엔 잠겨 있다.
  insert into public.notes (group_id, author_id, chapter, pct, kind, body, created_at)
  values (v_group, v_a, 1, 80, 'memo', '1장 마지막 손님 장면에서 분위기가 확 바뀌어요. 여기서부터 속도가 붙어요.', now() - interval '4 days');

  -- 2장 30%: 도윤의 인용 카드
  insert into public.quotes (group_id, chapter, pct, text, created_by, created_at)
  values (v_group, 2, 30, '비가 오면 사람들은 책을 사러 오지 않고 비를 피하러 온다. 그래도 나는 그들이 서가 앞에서 머뭇거리는 그 몇 분을 좋아했다.', v_b, now() - interval '3 days')
  returning id into v_quote;
  insert into public.notes (group_id, author_id, quote_id, kind, body, created_at)
  values (v_group, v_b, v_quote, 'impression', '목적 없이 들어온 사람에게도 자리를 내주는 공간이라는 게 서점의 본질 같아요.', now() - interval '3 days');

  -- 3장 10%: 서연의 인용 카드
  insert into public.quotes (group_id, chapter, pct, text, created_by, created_at)
  values (v_group, 3, 10, '그는 십 년 동안 한 번도 같은 책을 두 번 사지 않았다. 대신 같은 책을 누구에게 선물했는지는 전부 기억했다.', v_a, now() - interval '2 days')
  returning id into v_quote;
  insert into public.notes (group_id, author_id, quote_id, kind, body, created_at)
  values (v_group, v_a, v_quote, 'impression', '책을 고르는 일이 결국 사람을 기억하는 일이라는 게 이 장의 핵심 같아요.', now() - interval '2 days');

  -- 책 전체: 완독한 회원에게만 보이는 정리
  insert into public.notes (group_id, author_id, chapter, pct, kind, body, created_at)
  values (v_group, v_a, null, null, 'summary', '다 읽고 나니 사계절이 서점의 시간이자 주인공의 마음이었네요. 마지막 영업일 장면은 각자 읽고 이야기해요.', now() - interval '1 day');

  return v_group;
end;
$$;

revoke all on function public.start_demo() from public, anon, authenticated;
grant execute on function public.start_demo() to authenticated;
