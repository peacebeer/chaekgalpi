"use client";

import { Label } from "@/components/ui/label";

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
};

// 그 장에서 고를 수 있는 가장 뒤 위치
export function maxPctFor(chapter: number, progress: PickerProgress): number {
  if (progress.finished || chapter < progress.chapter) return 100;
  return Math.floor(progress.pct);
}

// 글을 붙일 위치(장 + 장 안 %)를 고른다. 폼에는 chapter, pct 값으로 실린다.
export function PositionPicker({
  chapters,
  wholeBook,
  progress,
  value,
  onChange,
}: PositionPickerProps) {
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
