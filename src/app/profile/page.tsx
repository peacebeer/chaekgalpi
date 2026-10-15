import type { Metadata } from "next";
import { Suspense } from "react";

import { ProfileForm } from "@/components/auth/profile-form";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "내 프로필 · 책갈피" };

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:px-8 sm:py-10">
      <div className="bg-card flex flex-col gap-6 rounded-xl border p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">내 프로필</h1>
        <Suspense
          fallback={
            <p className="text-muted-foreground text-sm">불러오는 중…</p>
          }
        >
          <ProfileSection />
        </Suspense>
      </div>
    </main>
  );
}

async function ProfileSection() {
  const user = await requireUser("/profile");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <>
      {user.email && (
        <p className="text-muted-foreground text-sm">
          로그인 계정: {user.email}
        </p>
      )}
      <ProfileForm nickname={profile?.nickname ?? ""} />
    </>
  );
}
