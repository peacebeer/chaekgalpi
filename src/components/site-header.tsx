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

// 초록 머리글 위에 놓이는 메뉴의 글자색과 눌림 표시
const ON_PRIMARY =
  "text-primary-foreground hover:bg-white/15 hover:text-primary-foreground";

export function SiteHeader() {
  return (
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight">
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
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: "text-foreground",
        })}
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
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: ON_PRIMARY,
        })}
      >
        그룹
      </Link>
      <Link
        href="/notifications"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: ON_PRIMARY,
        })}
        aria-label={unseen > 0 ? `알림, 새 소식 ${unseen}개` : "알림"}
      >
        알림
        {unseen > 0 && (
          <span className="text-primary rounded-md bg-white px-1.5 text-xs font-semibold tabular-nums">
            {unseen}
          </span>
        )}
      </Link>
      {user.isAnonymous && (
        <span className="text-primary rounded-md bg-white px-2 py-0.5 text-xs font-semibold">
          체험 중
        </span>
      )}
      <Link
        href="/profile"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: ON_PRIMARY,
        })}
      >
        {profile?.nickname ?? "내 프로필"}
      </Link>
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm" className={ON_PRIMARY}>
          로그아웃
        </Button>
      </form>
    </nav>
  );
}
