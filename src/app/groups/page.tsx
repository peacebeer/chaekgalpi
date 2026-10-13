import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "그룹 · 책갈피" };

export default function GroupsPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">그룹</h1>
        <Link href="/groups/new" className={buttonVariants()}>
          그룹 만들기
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">불러오는 중…</p>}
      >
        <GroupLists />
      </Suspense>
    </main>
  );
}

type GroupCard = {
  id: string;
  name: string;
  capacity: number;
  books: { title: string; author: string | null };
  // 내 그룹 목록에서만 채운다.
  isLeader?: boolean;
};

function GroupList({ groups, empty }: { groups: GroupCard[]; empty: string }) {
  if (groups.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }

  return (
    <ul className="divide-y rounded-lg border">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/groups/${group.id}`}
            className="hover:bg-muted flex flex-col gap-0.5 px-3 py-3"
          >
            <span className="flex items-center gap-2 font-medium">
              {group.name}
              {group.isLeader && (
                <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-xs font-medium">
                  리더
                </span>
              )}
            </span>
            <span className="text-muted-foreground text-sm">
              {[
                group.books.title,
                group.books.author,
                `정원 ${group.capacity}명`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function GroupLists() {
  const user = await requireUser("/groups");
  const supabase = await createClient();
  const columns = "id, name, capacity, books(title, author)";

  const [{ data: mine }, { data: open }] = await Promise.all([
    supabase
      .from("memberships")
      .select(`role, joined_at, groups(${columns})`)
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),
    supabase
      .from("groups")
      .select(columns)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const myGroups = (mine ?? []).map((membership) => ({
    ...membership.groups,
    isLeader: membership.role === "owner",
  }));
  const myIds = new Set(myGroups.map((group) => group.id));
  const publicGroups = (open ?? []).filter((group) => !myIds.has(group.id));

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">내 그룹</h2>
        <GroupList
          groups={myGroups}
          empty="아직 들어간 그룹이 없어요. 그룹을 만들거나 초대 링크로 들어와 보세요."
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">공개 모집 중인 그룹</h2>
        <GroupList
          groups={publicGroups}
          empty="지금 공개 모집 중인 다른 그룹이 없어요."
        />
      </section>
    </>
  );
}
