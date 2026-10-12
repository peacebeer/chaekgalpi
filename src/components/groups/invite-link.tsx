"use client";

import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const subscribe = () => () => {};

export function InviteLink({ code }: { code: string }) {
  // 사이트 주소는 브라우저에서만 알 수 있다(로컬·배포 주소가 다르다).
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const link = `${origin}/join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 복사 권한이 없으면 입력 칸에서 직접 복사하면 된다.
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        aria-label="초대 링크"
        readOnly
        value={link}
        onFocus={(event) => event.target.select()}
      />
      <Button type="button" variant="outline" onClick={copy}>
        {copied ? "복사했어요" : "복사"}
      </Button>
    </div>
  );
}
