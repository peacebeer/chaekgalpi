import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  chaptersFromJson,
  GroupPreview,
} from "@/components/groups/group-preview";
import { JoinForm } from "@/components/groups/join-form";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { inviteCodeSchema } from "@/lib/validation/group";

export const metadata: Metadata = { title: "그룹 초대 · 책갈피" };

export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">그룹 초대</h1>
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">불러오는 중…</p>}
      >
        <Invitation params={params} />
      </Suspense>
    </main>
  );
}

function NotFound() {
  return (
    <>
      <p>초대 링크가 올바르지 않아요. 받은 링크를 다시 확인해 주세요.</p>
      <Link href="/groups" className="underline">
        그룹 목록으로
      </Link>
    </>
  );
}

async function Invitation({
  params,
}: Pick<PageProps<"/join/[code]">, "params">) {
  const { code } = await params;
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) return <NotFound />;

  // 로그인 뒤 이 초대 화면으로 돌아온다.
  await requireUser(`/join/${parsed.data}`);

  // 비공개 그룹은 회원이 아니면 직접 조회할 수 없어, 초대 코드로 소개만 받아 온다.
  const supabase = await createClient();
  const { data } = await supabase.rpc("group_preview", {
    p_invite_code: parsed.data,
  });
  const preview = data?.[0];
  if (!preview) return <NotFound />;
  if (preview.is_member) redirect(`/groups/${preview.id}`);

  return (
    <GroupPreview
      data={{
        name: preview.name,
        capacity: preview.capacity,
        memberCount: preview.member_count,
        startDate: preview.start_date,
        targetDate: preview.target_date,
        isPublic: preview.is_public,
        leaderNickname: preview.leader_nickname,
        book: {
          title: preview.book_title,
          author: preview.book_author,
          translator: preview.book_translator,
          publisher: preview.book_publisher,
          pages: preview.book_pages,
          coverUrl: preview.book_cover_url,
        },
        chapters: chaptersFromJson(preview.chapters),
      }}
    >
      <JoinForm inviteCode={parsed.data} />
    </GroupPreview>
  );
}
