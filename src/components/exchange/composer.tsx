"use client";

import { useActionState, useEffect, useState } from "react";

import {
  addNote,
  createQuote,
  findSimilarQuotes,
  type SimilarQuote,
} from "@/app/groups/[id]/exchange-actions";
import {
  maxPctFor,
  PositionPicker,
  type PickerProgress,
} from "@/components/exchange/position-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { positionLabel } from "@/lib/books/progress";
import { KIND_LABELS } from "@/lib/exchange/feed";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";
import { charLength } from "@/lib/validation/common";
import { remainingQuoteChars } from "@/lib/validation/quote";
import { LIMITS } from "@/lib/validation/limits";

type ComposerProps = {
  groupId: string;
  chapters: { number: number; title: string }[];
  wholeBook: boolean;
  progress: PickerProgress;
  // 그룹 인용 한도 사용량(아직 못 읽은 카드 포함). 불러오지 못했으면 null
  quota?: { used: number; limit: number } | null;
};

type Mode = "quote" | "note";

const SIMILAR_DELAY_MS = 300;
const SIMILAR_MIN_CHARS = 4;

// 새 글 쓰기: 인용 카드(인용문 + 내 감상) 또는 인용 없는 메모·질문
export function Composer({
  groupId,
  chapters,
  wholeBook,
  progress,
  quota = null,
}: ComposerProps) {
  const [mode, setMode] = useState<Mode>("quote");
  const [position, setPosition] = useState({
    chapter: progress.chapter,
    pct: maxPctFor(progress.chapter, progress),
  });
  const [text, setText] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("memo");
  const [aboutWholeBook, setAboutWholeBook] = useState(false);
  const [similar, setSimilar] = useState<SimilarQuote[]>([]);

  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result =
        mode === "quote"
          ? await createQuote(prev, formData)
          : await addNote(prev, formData);
      if (result.notice) {
        setText("");
        setBody("");
        setSimilar([]);
      }
      return result;
    },
    EMPTY_FORM_STATE,
  );
  const errors = state.fieldErrors ?? {};
  const textLength = charLength(text.trim());
  const quotaLeft = quota ? remainingQuoteChars(quota.used, quota.limit) : null;
  const overQuota = quotaLeft !== null && textLength > quotaLeft;

  // 인용을 입력하는 동안 같은 장의 비슷한 카드를 찾아 중복 등록을 줄인다.
  useEffect(() => {
    const wanted = mode === "quote" && textLength >= SIMILAR_MIN_CHARS;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = wanted
        ? await findSimilarQuotes(groupId, position.chapter, position.pct, text)
        : [];
      if (!cancelled) setSimilar(found);
    }, SIMILAR_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [groupId, mode, position.chapter, position.pct, text, textLength]);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="groupId" value={groupId} />

      <div className="flex gap-2" role="tablist" aria-label="글 종류">
        {(
          [
            ["quote", "인용 카드"],
            ["note", "메모·질문"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            size="sm"
            variant={mode === value ? "default" : "outline"}
            onClick={() => setMode(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {mode === "note" && progress.finished && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="wholeBook"
            className="size-4"
            checked={aboutWholeBook}
            onChange={(event) => setAboutWholeBook(event.target.checked)}
          />
          책 전체에 대한 글 (완독한 회원에게만 보여요)
        </label>
      )}

      {!(mode === "note" && aboutWholeBook) && (
        <PositionPicker
          chapters={chapters}
          wholeBook={wholeBook}
          progress={progress}
          value={position}
          onChange={setPosition}
        />
      )}

      {mode === "quote" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quote-text">인용문</Label>
          <Textarea
            id="quote-text"
            name="text"
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={errors.text ? true : undefined}
            placeholder="책에서 옮겨 적을 문장"
          />
          <p
            className={
              textLength > LIMITS.quoteTextMax
                ? "text-destructive text-sm"
                : "text-muted-foreground text-sm"
            }
          >
            {textLength}/{LIMITS.quoteTextMax}자 · 출처(책·장)는 자동으로
            표시돼요.
          </p>
          {quota && quotaLeft !== null && (
            <p
              className={
                overQuota
                  ? "text-destructive text-sm"
                  : "text-muted-foreground text-sm"
              }
            >
              그룹 인용 한도: {quota.used.toLocaleString("ko-KR")} /{" "}
              {quota.limit.toLocaleString("ko-KR")}자 사용 · 남은{" "}
              {quotaLeft.toLocaleString("ko-KR")}자
              {overQuota ? " · 이 인용문은 남은 한도를 넘어요." : ""}
            </p>
          )}
          {errors.text && (
            <p role="alert" className="text-destructive text-sm">
              {errors.text}
            </p>
          )}

          {similar.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">
                비슷한 인용 카드가 이미 있어요. 같은 문장이면 그 카드에 감상을
                남겨 주세요.
              </p>
              <ul className="flex flex-col gap-2">
                {similar.map((item) => (
                  <li key={item.id} className="flex flex-col gap-0.5">
                    <span className="line-clamp-2">“{item.text}”</span>
                    <span className="text-muted-foreground">
                      {positionLabel(item, wholeBook)} ·{" "}
                      <a href={`#quote-${item.id}`} className="underline">
                        여기에 감상 남기기
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">
                다른 문장이면 그대로 새 카드로 등록하면 돼요.
              </p>
            </div>
          )}
        </div>
      )}

      {mode === "note" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-kind">종류</Label>
          <select
            id="note-kind"
            name="kind"
            className="border-input h-9 rounded-lg border bg-transparent px-2 text-sm"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {(["memo", "question", "summary"] as const).map((value) => (
              <option key={value} value={value}>
                {KIND_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note-body">
          {mode === "quote" ? "내 감상 (필수)" : "내용"}
        </Label>
        <Textarea
          id="note-body"
          name="body"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-invalid={errors.body ? true : undefined}
          placeholder={
            mode === "quote"
              ? "이 문장을 고른 이유나 떠오른 생각"
              : "이 위치에서 든 생각이나 궁금한 점"
          }
        />
        {errors.body && (
          <p role="alert" className="text-destructive text-sm">
            {errors.body}
          </p>
        )}
      </div>

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
        {pending
          ? "등록하는 중…"
          : mode === "quote"
            ? "인용 카드 등록"
            : "등록"}
      </Button>
    </form>
  );
}
