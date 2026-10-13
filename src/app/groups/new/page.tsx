import type { Metadata } from "next";
import { Suspense } from "react";

import { NewGroupForm } from "@/components/groups/new-group-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "그룹 만들기 · 책갈피" };

export default function NewGroupPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
      <div className="bg-card flex flex-col gap-6 rounded-xl border p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">그룹 만들기</h1>
        <Suspense
          fallback={
            <p className="text-muted-foreground text-sm">불러오는 중…</p>
          }
        >
          <SignedInForm />
        </Suspense>
      </div>
    </main>
  );
}

async function SignedInForm() {
  await requireUser("/groups/new");
  return <NewGroupForm />;
}
