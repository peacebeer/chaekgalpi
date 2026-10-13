import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConfirmAction } from "@/components/groups/confirm-action";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

import { deleteGroup, removeMember } from "./actions";

export const metadata: Metadata = { title: "그룹 설정 · 책갈피" };

export default function GroupSettingsPage({
  params,
}: PageProps<"/groups/[id]/settings">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">불러오는 중…</p>}
      >
        <Settings params={params} />
      </Suspense>
    </main>
  );
}

async function Settings({
  params,
}: Pick<PageProps<"/groups/[id]/settings">, "params">) {
  const { id } = await params;
  const groupId = uuidSchema.safeParse(id);
  if (!groupId.success) notFound();

  const user = await requireUser(`/groups/${groupId.data}/settings`);
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, capacity, start_date, target_date, is_public, owner_id")
    .eq("id", groupId.data)
    .maybeSingle();
  // 화면은 리더에게만 보여 준다. 실제 권한은 RLS가 한 번 더 막는다.
  if (!group || group.owner_id !== user.id) notFound();

  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, role, joined_at, profiles(nickname)")
    .eq("group_id", group.id)
    .order("joined_at");
  const memberList = members ?? [];

  return (
    <>
      <header className="flex flex-col gap-2">
        <Link
          href={`/groups/${group.id}`}
          className="text-muted-foreground text-sm underline"
        >
          ← {group.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">그룹 설정</h1>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">그룹 정보</h2>
        <GroupSettingsForm
          groupId={group.id}
          memberCount={memberList.length}
          initial={{
            name: group.name,
            capacity: group.capacity,
            startDate: group.start_date ?? "",
            targetDate: group.target_date ?? "",
            isPublic: group.is_public,
          }}
        />
        <p className="text-muted-foreground text-sm">
          책과 목차는 그룹을 만든 뒤에는 바꿀 수 없어요.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          회원 {memberList.length}/{group.capacity}명
        </h2>
        <ul className="bg-card divide-y rounded-xl border">
          {memberList.map((member) => {
            const nickname = member.profiles?.nickname ?? "독자";
            return (
              <li
                key={member.user_id}
                className="flex flex-wrap items-start justify-between gap-x-3 px-3 py-2 text-sm"
              >
                <span className="py-1">
                  {nickname}
                  {member.role === "owner" ? " (리더)" : ""}
                </span>
                {member.role !== "owner" && (
                  <ConfirmAction
                    action={removeMember}
                    fields={{ groupId: group.id, userId: member.user_id }}
                    label="내보내기"
                    question={`${nickname} 님을 그룹에서 내보낼까요? 이 회원이 쓴 감상은 그대로 남아요.`}
                    confirmLabel="내보내기"
                  />
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground text-sm">
          내보낸 회원도 초대 링크가 있으면 다시 들어올 수 있어요.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">그룹 삭제</h2>
        <p className="text-sm">
          그룹을 삭제하면 회원 기록과 모든 인용 카드·감상이 함께 지워지고 되돌릴
          수 없어요.
        </p>
        <div>
          <ConfirmAction
            action={deleteGroup}
            fields={{ groupId: group.id }}
            label="그룹 삭제"
            question={`정말 "${group.name}" 그룹을 삭제할까요? 되돌릴 수 없어요.`}
            confirmLabel="영구 삭제"
          />
        </div>
      </section>
    </>
  );
}
