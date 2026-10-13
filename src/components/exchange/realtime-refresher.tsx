"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

// 여러 변경이 한꺼번에 와도 한 번만 다시 그린다.
const REFRESH_DELAY_MS = 400;

type Status = "connecting" | "live" | "offline";

// 그룹의 인용 카드·감상·좋아요·진도가 바뀌면 화면을 다시 불러온다.
// 변경 내용 자체는 쓰지 않고 "바뀌었다"는 신호로만 쓴다. 다시 불러올 때 서버가 RLS를 거쳐
// 내가 볼 수 있는 것만 주므로, 아직 읽지 않은 위치의 글이 실시간으로 새어 나오지 않는다.
// (Supabase Realtime도 RLS를 따라, 볼 수 없는 행의 추가·수정 신호는 애초에 오지 않는다.)
export function RealtimeRefresher({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
    };

    const inGroup = { schema: "public", filter: `group_id=eq.${groupId}` };
    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", table: "quotes", ...inGroup },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", table: "notes", ...inGroup },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", table: "memberships", ...inGroup },
        refresh,
      )
      // 좋아요에는 group_id가 없다. RLS 때문에 내가 볼 수 있는 글의 좋아요만 온다.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions" },
        refresh,
      )
      // 삭제 신호에는 지워진 행의 id만 담겨 group_id로 거를 수 없다. 따로 받아서 다시 불러온다.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "quotes" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notes" },
        refresh,
      )
      .subscribe((state) => {
        setStatus(state === "SUBSCRIBED" ? "live" : "offline");
      });

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [groupId, router]);

  return (
    <p role="status" className="text-muted-foreground text-xs">
      {status === "live"
        ? "● 실시간 반영 중 · 다른 회원의 글이 새로고침 없이 나타나요."
        : status === "connecting"
          ? "실시간 연결 중…"
          : "실시간 연결이 끊겼어요. 새로고침하면 최신 글을 볼 수 있어요."}
    </p>
  );
}
