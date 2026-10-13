import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import {
  NotificationList,
  type NotificationItem,
} from "@/components/notification-list";
import { requireUser } from "@/lib/auth/session";
import {
  getNotifications,
  SEEN_COOKIE,
  type NotificationKind,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "알림 · 책갈피" };

export default function NotificationsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">알림</h1>
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">불러오는 중…</p>}
      >
        <Notifications />
      </Suspense>
    </main>
  );
}

const TITLES: Record<NotificationKind, (name: string) => string> = {
  quote_note: (name) => `${name} 님이 내 인용 카드에 감상을 남겼어요`,
  reply: (name) => `${name} 님이 내 글에 답글을 달았어요`,
  like: (name) => `${name} 님이 내 글을 좋아해요`,
};

// 서버와 브라우저의 시간대가 달라도 같은 글자가 나오도록 한국 시간으로 고정한다.
const WHEN = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

async function Notifications() {
  const user = await requireUser("/notifications");
  const supabase = await createClient();
  const seenAt = (await cookies()).get(SEEN_COOKIE)?.value ?? null;
  const notifications = await getNotifications(supabase, user.id);

  const actorIds = [
    ...new Set(notifications.flatMap((item) => item.actorId ?? [])),
  ];
  const groupIds = [...new Set(notifications.map((item) => item.groupId))];
  const [{ data: actors }, { data: groups }] = await Promise.all([
    supabase.from("profiles").select("id, nickname").in("id", actorIds),
    supabase.from("groups").select("id, name").in("id", groupIds),
  ]);
  const nickname = new Map(
    (actors ?? []).map((actor) => [actor.id, actor.nickname]),
  );
  const groupName = new Map(
    (groups ?? []).map((group) => [group.id, group.name]),
  );

  const items: NotificationItem[] = notifications.map((item) => ({
    id: item.id,
    at: item.at,
    when: WHEN.format(new Date(item.at)),
    href: item.href,
    title: TITLES[item.kind](
      (item.actorId && nickname.get(item.actorId)) || "나간 회원",
    ),
    groupName: groupName.get(item.groupId) ?? "그룹",
    target: item.target,
    excerpt: item.excerpt,
  }));

  return (
    <>
      <NotificationList
        items={items}
        seenAt={seenAt}
        cookieName={SEEN_COOKIE}
      />
      <p className="text-muted-foreground text-sm">
        최근 소식 30개까지 보여요. 새 소식 표시는 이 브라우저에서 마지막으로
        확인한 때를 기준으로 해요.
      </p>
    </>
  );
}
