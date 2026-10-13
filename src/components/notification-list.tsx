"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type NotificationItem = {
  id: string;
  at: string;
  // 서버에서 한국 시간으로 만든 표시용 문자열
  when: string;
  href: string;
  title: string;
  groupName: string;
  target: string;
  excerpt: string | null;
};

type NotificationListProps = {
  items: NotificationItem[];
  // 이 화면을 열기 전 마지막으로 확인한 시각
  seenAt: string | null;
  cookieName: string;
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function NotificationList({
  items,
  seenAt,
  cookieName,
}: NotificationListProps) {
  const router = useRouter();
  // 확인 시각을 갱신한 뒤에도, 이 화면에 머무는 동안은 처음 기준으로 새 소식을 표시한다.
  const [initialSeenAt] = useState(seenAt);
  const seen = initialSeenAt ? Date.parse(initialSeenAt) : Number.NaN;

  useEffect(() => {
    document.cookie = `${cookieName}=${encodeURIComponent(new Date().toISOString())}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    // 머리글의 새 소식 개수를 다시 계산한다.
    router.refresh();
  }, [cookieName, router]);

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        아직 소식이 없어요. 내 인용 카드에 감상이 달리거나, 내 글에 답글이나
        좋아요가 생기면 여기에 모여요.
      </p>
    );
  }

  return (
    <ul className="bg-card divide-y overflow-hidden rounded-xl border">
      {items.map((item) => {
        const isNew = Number.isNaN(seen) || Date.parse(item.at) > seen;
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className="hover:bg-accent flex flex-col gap-1 px-3 py-3"
            >
              <span className="flex items-center gap-2 text-sm">
                {isNew && (
                  <span className="bg-primary text-primary-foreground rounded-md px-1.5 py-0.5 text-xs font-medium">
                    새 소식
                  </span>
                )}
                <span className={isNew ? "font-medium" : undefined}>
                  {item.title}
                </span>
              </span>
              {item.excerpt && <span className="text-sm">{item.excerpt}</span>}
              <span className="text-muted-foreground text-sm">
                내 글: “{item.target}”
              </span>
              <span className="text-muted-foreground text-xs">
                {item.groupName} · {item.when}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
