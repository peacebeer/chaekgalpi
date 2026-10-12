-- 책갈피 DB 스키마 (1/3): 테이블과 기본 제약
-- 위치는 항상 그룹 대표 도서의 목차 기준 (장 번호, 장 안 진도 %) 쌍으로 저장한다.

create extension if not exists pg_trgm with schema extensions;

-- 회원 프로필 (로그인 사용자 1명당 1행, 가입 시 트리거로 생성)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 30),
  region text check (char_length(region) <= 30),
  created_at timestamptz not null default now()
);

-- 대표 도서 (같은 ISBN이면 여러 그룹이 재사용)
create table public.books (
  id uuid primary key default gen_random_uuid(),
  isbn text unique check (isbn ~ '^[0-9X]{10}([0-9]{3})?$'),
  title text not null check (char_length(title) between 1 and 200),
  author text check (char_length(author) <= 200),
  translator text check (char_length(translator) <= 200),
  publisher text check (char_length(publisher) <= 100),
  pages int check (pages > 0),
  source text not null default 'manual' check (source in ('nlk', 'manual')),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 대표 도서 목차. start_page는 쪽수 → 위치 환산용(선택)
create table public.book_chapters (
  book_id uuid not null references public.books (id) on delete cascade,
  number int not null check (number >= 1),
  title text not null check (char_length(title) between 1 and 200),
  start_page int check (start_page > 0),
  primary key (book_id, number)
);

-- 그룹. owner_id가 그룹 리더
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete restrict,
  owner_id uuid default auth.uid() references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 50),
  capacity int not null default 8 check (capacity between 3 and 8),
  start_date date,
  target_date date check (target_date is null or start_date is null or target_date >= start_date),
  is_public boolean not null default false,
  invite_code text not null unique default substr(md5(gen_random_uuid()::text), 1, 10),
  quote_limit int not null default 10000 check (quote_limit between 1 and 10000),
  created_at timestamptz not null default now()
);

-- 그룹 회원과 진도
create table public.memberships (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  progress_chapter int not null default 1 check (progress_chapter >= 1),
  progress_pct numeric(5, 2) not null default 0 check (progress_pct between 0 and 100),
  finished_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- 인용 카드 (그룹 안에서 같은 문장은 카드 하나로)
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  chapter int not null check (chapter >= 1),
  pct numeric(5, 2) not null default 0 check (pct between 0 and 100),
  text text not null check (char_length(text) between 1 and 300),
  created_by uuid references public.profiles (id) on delete set null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_group_pos_idx on public.quotes (group_id, chapter, pct);
create index quotes_text_trgm_idx on public.quotes using gin (text extensions.gin_trgm_ops);

-- 감상·메모·질문·정리 노트. chapter가 비어 있으면 "책 전체"(완독자에게만 공개)
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  chapter int check (chapter >= 1),
  pct numeric(5, 2) check (pct between 0 and 100),
  kind text not null default 'impression' check (kind in ('impression', 'memo', 'question', 'summary')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  quote_id uuid references public.quotes (id) on delete cascade,
  parent_id uuid references public.notes (id) on delete cascade,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((chapter is null) = (pct is null))
);
create index notes_group_pos_idx on public.notes (group_id, chapter, pct);
create index notes_quote_idx on public.notes (quote_id);
create index notes_parent_idx on public.notes (parent_id);

-- 좋아요 (한 사람이 한 노트에 한 번만)
create table public.reactions (
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);
create index reactions_user_idx on public.reactions (user_id);
