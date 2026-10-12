import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { JoinForm } from "@/components/groups/join-form";
import { requireUser } from "@/lib/auth/session";
import { inviteCodeSchema } from "@/lib/validation/group";

export const metadata: Metadata = { title: "그룹 초대 · 책갈피" };

export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">그룹 초대</h1>
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">불러오는 중…</p>}
      >
        <Invitation params={params} />
      </Suspense>
    </main>
  );
}

async function Invitation({
  params,
}: Pick<PageProps<"/join/[code]">, "params">) {
  const { code } = await params;
  const parsed = inviteCodeSchema.safeParse(code);

  if (!parsed.success) {
    return (
      <>
        <p>초대 링크가 올바르지 않아요. 받은 링크를 다시 확인해 주세요.</p>
        <Link href="/groups" className="underline">
          그룹 목록으로
        </Link>
      </>
    );
  }

  // 로그인 뒤 이 초대 화면으로 돌아온다.
  await requireUser(`/join/${parsed.data}`);

  return (
    <>
      <p className="leading-7">
        함께 읽기 그룹에 초대받았어요. 입장하면 그룹의 책과 회원을 볼 수 있고,
        내가 읽은 위치까지의 감상이 열려요.
      </p>
      <JoinForm inviteCode={parsed.data} />
    </>
  );
}
