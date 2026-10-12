import type { Metadata } from "next";
import { Suspense } from "react";

import { ProfileForm } from "@/components/auth/profile-form";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "내 프로필 · 책갈피" };

export default function ProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">내 프로필</h1>
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">불러오는 중…</p>}
      >
        <ProfileSection />
      </Suspense>
    </main>
  );
}

async function ProfileSection() {
  const user = await requireUser("/profile");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, region")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <>
      {user.email && (
        <p className="text-muted-foreground text-sm">
          로그인 계정: {user.email}
        </p>
      )}
      <ProfileForm
        nickname={profile?.nickname ?? ""}
        region={profile?.region ?? ""}
      />
    </>
  );
}
