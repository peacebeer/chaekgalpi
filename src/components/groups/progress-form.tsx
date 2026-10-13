"use client";

import { useActionState, useState, useTransition } from "react";

import {
  pageToPosition,
  saveProgress,
} from "@/app/groups/[id]/progress-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { positionLabel } from "@/lib/books/progress";
import { EMPTY_FORM_STATE } from "@/lib/form-state";

type ProgressFormProps = {
  groupId: string;
  chapters: { number: number; title: string }[];
  // 목차 없이 만든 책(책 전체가 한 장)
  wholeBook: boolean;
  // 모든 장에 시작 쪽이 있어 쪽수로 입력할 수 있는지
  canUsePages: boolean;
  initial: { chapter: number; pct: number; finished: boolean };
};

export function ProgressForm({
  groupId,
  chapters,
  wholeBook,
  canUsePages,
  initial,
}: ProgressFormProps) {
  const [state, formAction, pending] = useActionState(
    saveProgress,
    EMPTY_FORM_STATE,
  );
  const [chapter, setChapter] = useState(initial.chapter);
  const [pct, setPct] = useState(Math.round(initial.pct));
  const [finished, setFinished] = useState(initial.finished);

  const [page, setPage] = useState("");
  const [pageNote, setPageNote] = useState<string | null>(null);
  const [converting, startConvert] = useTransition();

  function applyPage() {
    setPageNote(null);
    startConvert(async () => {
      const result = await pageToPosition(groupId, Number(page));
      if (!result.ok) {
        setPageNote(result.message);
        return;
      }
      setChapter(result.chapter);
      setFinished(false);
      if (result.pct === null) {
        setPageNote(
          "이 장 안의 위치는 쪽수로 알 수 없어요. 아래 막대로 맞춰 주세요.",
        );
      } else {
        setPct(Math.round(result.pct));
        setPageNote(
          `${page}쪽은 ${positionLabel({ chapter: result.chapter, pct: result.pct }, wholeBook)} 위치예요. 저장을 눌러 주세요.`,
        );
      }
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />
      {/* 완독이면 서버가 위치를 책 끝으로 맞춘다 */}
      <input type="hidden" name="chapter" value={chapter} />

      {canUsePages && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page">쪽수로 입력</Label>
          <div className="flex gap-2">
            <Input
              id="page"
              inputMode="numeric"
              placeholder="예: 143"
              value={page}
              onChange={(event) => setPage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyPage();
                }
              }}
              disabled={finished}
            />
            <Button
              type="button"
              variant="outline"
              onClick={applyPage}
              disabled={converting || finished || page.trim() === ""}
            >
              {converting ? "계산 중…" : "위치로 바꾸기"}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            대표 도서와 같은 책을 읽을 때만 정확해요. 다른 판본이면 아래에서
            직접 골라 주세요.
          </p>
          {pageNote && (
            <p role="status" className="text-sm">
              {pageNote}
            </p>
          )}
        </div>
      )}

      {!wholeBook && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chapter-select">읽고 있는 장</Label>
          <select
            id="chapter-select"
            className="border-input h-9 rounded-lg border bg-transparent px-2 text-sm"
            value={chapter}
            onChange={(event) => setChapter(Number(event.target.value))}
            disabled={finished}
          >
            {chapters.map((item) => (
              <option key={item.number} value={item.number}>
                {item.number}. {item.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pct">
          {wholeBook ? "책 전체에서 읽은 위치" : "이 장에서 읽은 위치"}:{" "}
          {finished ? "완독" : `${pct}%`}
        </Label>
        <input
          id="pct"
          name="pct"
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={(event) => setPct(Number(event.target.value))}
          disabled={finished}
          className="accent-foreground w-full"
        />
        <p className="text-muted-foreground text-sm">
          대략이어도 괜찮아요. 저장한 위치까지의 감상만 열려요.
        </p>
      </div>
      {/* disabled 입력은 제출되지 않으므로 완독일 때 pct를 따로 보낸다 */}
      {finished && <input type="hidden" name="pct" value={pct} />}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="finished"
          className="size-4"
          checked={finished}
          onChange={(event) => setFinished(event.target.checked)}
        />
        끝까지 다 읽었어요 (완독)
      </label>

      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm">
          {state.notice}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "저장하는 중…" : "진도 저장"}
      </Button>
    </form>
  );
}
