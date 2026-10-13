"use client";

import { useState, type ReactNode } from "react";

type CollapsibleNavProps = {
  title: string;
  // 접혀 있을 때 제목 옆에 보여 줄 요약(예: "5개 장")
  summary: string;
  className?: string;
  children: ReactNode;
};

// 좁은 화면에서는 접어 두고 누르면 펼친다. 넓은 화면(lg 이상)에서는 항상 펼쳐 둔다.
export function CollapsibleNav({
  title,
  summary,
  className = "",
  children,
}: CollapsibleNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav aria-label={title} className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="collapsible-nav-body"
        onClick={() => setOpen(!open)}
        className="hover:bg-accent flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm font-semibold lg:hidden"
      >
        <span className="text-muted-foreground">
          {title} · {summary}
        </span>
        <span>{open ? "접기" : "펼치기"}</span>
      </button>
      <h2 className="text-muted-foreground hidden px-2 py-1.5 text-sm font-semibold lg:block">
        {title}
      </h2>
      <div
        id="collapsible-nav-body"
        className={`flex-col gap-1 lg:flex ${open ? "flex" : "hidden"}`}
      >
        {children}
      </div>
    </nav>
  );
}
