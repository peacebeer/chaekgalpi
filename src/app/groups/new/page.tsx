import type { Metadata } from "next";
import { Suspense } from "react";

import { NewGroupForm } from "@/components/groups/new-group-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "그룹 만들기 · 책갈피" };

export default function NewGroupPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">그룹 만들기</h1>
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">불러오는 중…</p>}
      >
        <SignedInForm />
      </Suspense>
    </main>
  );
}

async function SignedInForm() {
  await requireUser("/groups/new");
  return <NewGroupForm />;
}
