import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";

import { logout } from "@/app/(auth)/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import {
  countUnseen,
  getNotifications,
  SEEN_COOKIE,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          책갈피
        </Link>
        {/* 로그인 상태는 쿠키를 읽어야 알 수 있으므로 이 부분만 나중에 채워진다 */}
        <Suspense fallback={<div className="h-8 w-20" />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/login"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        로그인
      </Link>
    );
  }

  const supabase = await createClient();
  const [{ data: profile }, notifications, cookieStore] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .maybeSingle(),
    getNotifications(supabase, user.id),
    cookies(),
  ]);
  const unseen = countUnseen(
    notifications,
    cookieStore.get(SEEN_COOKIE)?.value ?? null,
  );

  return (
    <nav className="flex items-center gap-1">
      <Link
        href="/groups"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        그룹
      </Link>
      <Link
        href="/notifications"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        aria-label={unseen > 0 ? `알림, 새 소식 ${unseen}개` : "알림"}
      >
        알림
        {unseen > 0 && (
          <span className="bg-foreground text-background rounded-full px-1.5 text-xs font-medium tabular-nums">
            {unseen}
          </span>
        )}
      </Link>
      <Link
        href="/profile"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        {profile?.nickname ?? "내 프로필"}
      </Link>
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm">
          로그아웃
        </Button>
      </form>
    </nav>
  );
}
