"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ToolPanelsProps = {
  panels: { id: string; label: string; content: ReactNode }[];
  // 접혀 있을 때 버튼 옆에 보여 줄 안내
  hint?: string;
};

// 보조 기능(내 진도 기록, 글 남기기)을 버튼으로 접어 두고, 누른 것 하나만 펼친다.
// 접혀 있어도 내용은 그대로 두어 입력하던 글이 지워지지 않게 한다.
export function ToolPanels({ panels, hint }: ToolPanelsProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {panels.map((panel) => (
          <Button
            key={panel.id}
            type="button"
            variant={openId === panel.id ? "default" : "outline"}
            aria-expanded={openId === panel.id}
            aria-controls={`tool-${panel.id}`}
            onClick={() => setOpenId(openId === panel.id ? null : panel.id)}
          >
            {panel.label}
          </Button>
        ))}
        {hint && openId === null && (
          <span className="text-muted-foreground text-sm">{hint}</span>
        )}
      </div>
      {panels.map((panel) => (
        <div
          key={panel.id}
          id={`tool-${panel.id}`}
          hidden={openId !== panel.id}
          className="border-t pt-4"
        >
          {panel.content}
        </div>
      ))}
    </div>
  );
}
