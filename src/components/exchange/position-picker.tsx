"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { positionLabel } from "@/lib/books/progress";
import {
  maxPageFor,
  pageToPosition,
  positionToPage,
  type PageMap,
} from "@/lib/books/pages";

export type PickerProgress = {
  chapter: number;
  pct: number;
  finished: boolean;
};

type PositionPickerProps = {
  chapters: { number: number; title: string }[];
  wholeBook: boolean;
  // 내 진도. 이보다 뒤 위치에는 쓸 수 없다(최종 판정은 DB가 한다).
  progress: PickerProgress;
  value: { chapter: number; pct: number };
  onChange: (value: { chapter: number; pct: number }) => void;
  // 모든 장의 시작 쪽과 전체 쪽수를 알면 쪽수로 받는다. 없으면 장 + %로 받는다.
  pageMap?: PageMap | null;
};

// 그 장에서 고를 수 있는 가장 뒤 위치
export function maxPctFor(chapter: number, progress: PickerProgress): number {
  if (progress.finished || chapter < progress.chapter) return 100;
  return Math.floor(progress.pct);
}

// 처음 고를 위치: 내 진도 위치(쪽수로 받으면 진도 안의 가장 뒤 쪽)
export function initialPosition(
  progress: PickerProgress,
  pageMap: PageMap | null = null,
): { chapter: number; pct: number } {
  if (pageMap) {
    return pageToPosition(pageMap, maxPageFor(pageMap, progress))!;
  }
  return {
    chapter: progress.chapter,
    pct: maxPctFor(progress.chapter, progress),
  };
}

// 글을 붙일 위치(장 + 장 안 %)를 고른다. 폼에는 chapter, pct 값으로 실린다.
export function PositionPicker({
  pageMap = null,
  ...props
}: PositionPickerProps) {
  return pageMap ? (
    <PagePicker {...props} pageMap={pageMap} />
  ) : (
    <PercentPicker {...props} />
  );
}

// 쪽수로 위치를 받는다. 쪽수는 서버에서 다시 (장, %)로 검사된다.
function PagePicker({
  wholeBook,
  progress,
  value,
  onChange,
  pageMap,
}: Omit<PositionPickerProps, "chapters"> & { pageMap: PageMap }) {
  const maxPage = maxPageFor(pageMap, progress);
  const [page, setPage] = useState(String(positionToPage(pageMap, value)));
  const number = Number(page);
  const valid =
    page.trim() !== "" &&
    Number.isInteger(number) &&
    number >= 1 &&
    number <= maxPage;

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name="chapter" value={value.chapter} />
      <input type="hidden" name="pct" value={value.pct} />
      <Label htmlFor="note-page">쪽수</Label>
      <div className="flex items-center gap-2">
        <Input
          id="note-page"
          type="number"
          inputMode="numeric"
          min={1}
          max={maxPage}
          className="w-28"
          value={page}
          aria-invalid={valid ? undefined : true}
          onChange={(event) => {
            const next = event.target.value;
            setPage(next);
            const position =
              Number(next) <= maxPage
                ? pageToPosition(pageMap, Number(next))
                : null;
            if (position) onChange(position);
          }}
        />
        <span className="text-muted-foreground text-sm">
          쪽 {valid && `· ${positionLabel(value, wholeBook)}`}
        </span>
      </div>
      <p
        className={
          valid ? "text-muted-foreground text-sm" : "text-destructive text-sm"
        }
      >
        {valid
          ? "내 진도까지만 고를 수 있어요. 이 위치까지 읽은 회원에게만 보여요."
          : `1~${maxPage}쪽 사이로 적어 주세요. 내 진도(${maxPage}쪽)보다 뒤는 고를 수 없어요.`}
      </p>
    </div>
  );
}

function PercentPicker({
  chapters,
  wholeBook,
  progress,
  value,
  onChange,
}: Omit<PositionPickerProps, "pageMap">) {
  const available = progress.finished
    ? chapters
    : chapters.filter((chapter) => chapter.number <= progress.chapter);
  const maxPct = maxPctFor(value.chapter, progress);

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="chapter" value={value.chapter} />
      {!wholeBook && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-chapter">장</Label>
          <select
            id="note-chapter"
            className="border-input h-9 rounded-lg border bg-transparent px-2 text-sm"
            value={value.chapter}
            onChange={(event) => {
              const chapter = Number(event.target.value);
              onChange({
                chapter,
                pct: Math.min(value.pct, maxPctFor(chapter, progress)),
              });
            }}
          >
            {available.map((chapter) => (
              <option key={chapter.number} value={chapter.number}>
                {chapter.number}. {chapter.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note-pct">
          {wholeBook ? "책 전체에서의 위치" : "이 장 안에서의 위치"}:{" "}
          {value.pct}%
        </Label>
        <input
          id="note-pct"
          name="pct"
          type="range"
          min={0}
          max={maxPct}
          step={1}
          value={Math.min(value.pct, maxPct)}
          onChange={(event) =>
            onChange({
              chapter: value.chapter,
              pct: Number(event.target.value),
            })
          }
          className="accent-foreground w-full"
        />
        <p className="text-muted-foreground text-sm">
          내 진도까지만 고를 수 있어요. 이 위치까지 읽은 회원에게만 보여요.
        </p>
      </div>
    </div>
  );
}
