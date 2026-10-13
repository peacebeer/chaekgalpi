import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConfirmAction } from "@/components/groups/confirm-action";
import { InviteLink } from "@/components/groups/invite-link";
import { JoinForm } from "@/components/groups/join-form";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

import { removeMember } from "./settings/actions";

export const metadata: Metadata = { title: "그룹 · 책갈피" };

export default function GroupPage({ params }: PageProps<"/groups/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-10">
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">불러오는 중…</p>}
      >
        <GroupDetail params={params} />
      </Suspense>
    </main>
  );
}

async function GroupDetail({
  params,
}: Pick<PageProps<"/groups/[id]">, "params">) {
  const { id } = await params;
  const groupId = uuidSchema.safeParse(id);
  if (!groupId.success) notFound();

  const user = await requireUser(`/groups/${groupId.data}`);
  const supabase = await createClient();

  // RLS: 공개 그룹이거나 내가 회원인 그룹만 조회된다.
  const { data: group } = await supabase
    .from("groups")
    .select(
      "id, name, capacity, start_date, target_date, is_public, invite_code, owner_id, books(title, author, translator, publisher, book_chapters(number, title, start_page))",
    )
    .eq("id", groupId.data)
    .maybeSingle();
  if (!group) notFound();

  // RLS: 회원이 아니면 빈 목록이 온다.
  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, role, joined_at, profiles(nickname)")
    .eq("group_id", group.id)
    .order("joined_at");

  const memberList = members ?? [];
  const isMember = memberList.some((member) => member.user_id === user.id);
  const isOwner = group.owner_id === user.id;
  const book = group.books;
  const chapters = [...book.book_chapters].sort((a, b) => a.number - b.number);
  const period = [group.start_date, group.target_date].some(Boolean)
    ? `${group.start_date ?? "시작일 미정"} ~ ${group.target_date ?? "완독일 미정"}`
    : null;

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          {group.is_public ? "공개 그룹" : "초대 전용 그룹"}
          {period ? ` · ${period}` : ""}
        </p>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {group.name}
          </h1>
          {isOwner && (
            <Link
              href={`/groups/${group.id}/settings`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              그룹 설정
            </Link>
          )}
        </div>
        <p>
          <span className="font-medium">{book.title}</span>
          <span className="text-muted-foreground">
            {[
              book.author,
              book.translator && `${book.translator} 옮김`,
              book.publisher,
            ]
              .filter(Boolean)
              .map((text) => ` · ${text}`)
              .join("")}
          </span>
        </p>
      </header>

      {!isMember && (
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm">
            공개 그룹이에요. 정원은 {group.capacity}명이고, 입장하면 회원과
            감상을 볼 수 있어요.
          </p>
          <JoinForm groupId={group.id} />
        </section>
      )}

      {isMember && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              회원 {memberList.length}/{group.capacity}명
            </h2>
            <ul className="flex flex-wrap gap-2">
              {memberList.map((member) => (
                <li
                  key={member.user_id}
                  className="bg-muted rounded-full px-3 py-1 text-sm"
                >
                  {member.profiles?.nickname ?? "독자"}
                  {member.role === "owner" ? " (리더)" : ""}
                  {member.user_id === user.id ? " · 나" : ""}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">초대 링크</h2>
            <InviteLink code={group.invite_code} />
            <p className="text-muted-foreground text-sm">
              이 링크를 받은 사람은 로그인한 뒤 그룹에 들어올 수 있어요.
            </p>
          </section>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">목차</h2>
        <ol className="divide-y rounded-lg border">
          {chapters.map((chapter) => (
            <li
              key={chapter.number}
              className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
            >
              <span>
                <span className="text-muted-foreground mr-2 tabular-nums">
                  {chapter.number}
                </span>
                {chapter.title}
              </span>
              {chapter.start_page && (
                <span className="text-muted-foreground tabular-nums">
                  {chapter.start_page}쪽
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground text-sm">
          이 목차가 그룹의 위치 기준이에요. 다른 판본을 읽는다면 가장 가까운
          장으로 맞춰 주세요.
        </p>
      </section>

      {isMember && !isOwner && (
        <section className="flex flex-col gap-2 border-t pt-6">
          <div>
            <ConfirmAction
              action={removeMember}
              fields={{ groupId: group.id, userId: user.id }}
              label="그룹 나가기"
              question="이 그룹에서 나갈까요? 내가 쓴 감상은 그룹에 남고, 진도 기록은 지워져요."
              confirmLabel="나가기"
            />
          </div>
        </section>
      )}
    </>
  );
}
