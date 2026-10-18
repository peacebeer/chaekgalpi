"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// 감상문 초안을 고쳐 쓰고 복사한다. 서버에 저장하지 않는다.
export function EssayEditor({ draft }: { draft: string }) {
  const [text, setText] = useState(draft);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 복사 권한이 없으면 입력 칸에서 직접 복사하면 된다.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label="감상문 초안"
        rows={18}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="bg-card leading-7"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          이 칸의 글은 저장되지 않아요. 다 쓰면 복사해 두세요.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setText(draft)}
            disabled={text === draft}
          >
            처음 초안으로
          </Button>
          <Button type="button" onClick={copy}>
            {copied ? "복사했어요" : "복사하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
