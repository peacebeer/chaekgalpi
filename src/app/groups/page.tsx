import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BookCover } from "@/components/groups/book-cover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { periodLabel } from "@/lib/books/schedule";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "그룹 · 책갈피" };

// 공개 그룹은 이만큼씩 보여 주고 "더 보기"로 늘린다.
const PAGE_SIZE = 20;
const MAX_SHOWN = 200;

export default function GroupsPage({ searchParams }: PageProps<"/groups">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">그룹</h1>
        <Link href="/groups/new" className={buttonVariants()}>
          그룹 만들기
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">불러오는 중…</p>}
      >
        <GroupLists searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

type GroupCard = {
  id: string;
  name: string;
  capacity: number;
  start_date: string | null;
  target_date: string | null;
  books: { title: string; author: string | null; cover_url: string | null };
  // 내 그룹 목록에서만 채운다.
  isLeader?: boolean;
};

function GroupList({ groups, empty }: { groups: GroupCard[]; empty: string }) {
  if (groups.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/groups/${group.id}`}
            className="bg-card hover:border-primary flex h-full items-start gap-3 rounded-xl border p-4"
          >
            <BookCover
              url={group.books.cover_url}
              title={group.books.title}
              size="md"
            />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {group.name}
                {group.isLeader && (
                  <span className="bg-primary text-primary-foreground rounded-md px-1.5 py-0.5 text-xs font-medium">
                    리더
                  </span>
                )}
              </span>
              <span className="text-sm">
                {[group.books.title, group.books.author]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="text-muted-foreground text-sm">
                {[
                  `정원 ${group.capacity}명`,
                  periodLabel(group.start_date, group.target_date),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// 검색어에서 PostgREST 필터 문법에 쓰이는 글자를 뺀다.
function cleanQuery(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/[%_,()\\*]/g, " ")
        .trim()
        .slice(0, 50)
    : "";
}

async function GroupLists({
  searchParams,
}: Pick<PageProps<"/groups">, "searchParams">) {
  const params = await searchParams;
  const q = cleanQuery(params.q);
  const shown = Math.min(
    Math.max(Number(params.show) || PAGE_SIZE, PAGE_SIZE),
    MAX_SHOWN,
  );

  const user = await requireUser("/groups");
  const supabase = await createClient();
  const columns =
    "id, name, capacity, start_date, target_date, created_at, books!inner(title, author, cover_url)";

  // 공개 그룹: 모임 이름 또는 책 제목에 검색어가 들어간 것. 하나 더 가져와 다음이 있는지 본다.
  const publicQuery = () =>
    supabase
      .from("groups")
      .select(columns)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(shown + 1);

  const [{ data: mine }, byName, byBook] = await Promise.all([
    supabase
      .from("memberships")
      .select(`role, joined_at, groups(${columns})`)
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),
    q ? publicQuery().ilike("name", `%${q}%`) : publicQuery(),
    q ? publicQuery().ilike("books.title", `%${q}%`) : null,
  ]);

  const matches = (group: GroupCard) =>
    !q ||
    group.name.toLowerCase().includes(q.toLowerCase()) ||
    group.books.title.toLowerCase().includes(q.toLowerCase());

  const myGroups = (mine ?? [])
    .map((membership) => ({
      ...membership.groups,
      isLeader: membership.role === "owner",
    }))
    .filter(matches);
  const myIds = new Set(myGroups.map((group) => group.id));

  const merged = new Map<string, GroupCard & { created_at: string }>();
  for (const group of [...(byName.data ?? []), ...(byBook?.data ?? [])]) {
    if (!myIds.has(group.id)) merged.set(group.id, group);
  }
  const publicAll = [...merged.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const publicGroups = publicAll.slice(0, shown);
  const hasMore =
    publicAll.length > shown ||
    (byName.data?.length ?? 0) > shown ||
    (byBook?.data?.length ?? 0) > shown;
  const moreHref = `/groups?${new URLSearchParams({
    ...(q ? { q } : {}),
    show: String(shown + PAGE_SIZE),
  })}`;

  return (
    <>
      <form action="/groups" className="flex gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          aria-label="그룹 검색"
          placeholder="모임 이름이나 책 제목으로 찾기"
        />
        <Button type="submit" variant="outline">
          검색
        </Button>
        {q && (
          <Link href="/groups" className={buttonVariants({ variant: "ghost" })}>
            지우기
          </Link>
        )}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">내 그룹</h2>
        <GroupList
          groups={myGroups}
          empty={
            q
              ? `내 그룹 중에 "${q}"에 맞는 그룹이 없어요.`
              : "아직 들어간 그룹이 없어요. 그룹을 만들거나 초대 링크로 들어와 보세요."
          }
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">공개 모집 중인 그룹</h2>
        <GroupList
          groups={publicGroups}
          empty={
            q
              ? `"${q}"에 맞는 공개 그룹이 없어요.`
              : "지금 공개 모집 중인 다른 그룹이 없어요."
          }
        />
        {hasMore && shown < MAX_SHOWN && (
          <div>
            <Link
              href={moreHref}
              scroll={false}
              className={buttonVariants({ variant: "outline" })}
            >
              더 보기
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
