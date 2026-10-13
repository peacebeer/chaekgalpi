"use client";

import { useActionState } from "react";

import { addNote } from "@/app/groups/[id]/exchange-actions";
import { usePanel } from "@/components/action-group";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";

type NoteFormProps = {
  groupId: string;
  // 인용 카드에 다는 감상이면 quoteId, 답글이면 parentId
  target: { quoteId: string } | { parentId: string };
  label: string;
  placeholder: string;
  // 카드의 주된 동작("이 문장에 감상 남기기")은 테두리 버튼, 보조 동작(답글)은 글자 버튼
  variant?: "outline" | "ghost";
};

// 버튼을 누르면 버튼 줄 아래에 펼쳐지는 짧은 글쓰기 칸(카드 감상, 답글).
// 버튼은 제자리에 두어 옆 버튼들이 밀리지 않게 한다.
export function NoteForm({
  groupId,
  target,
  label,
  placeholder,
  variant = "ghost",
}: NoteFormProps) {
  const [open, setOpen] = usePanel();
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await addNote(prev, formData);
      if (result.notice) setOpen(false);
      return result;
    },
    EMPTY_FORM_STATE,
  );

  return (
    <>
      <Button
        type="button"
        variant={open ? "secondary" : variant}
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
      </Button>
      {open && (
        <form
          action={formAction}
          data-open
          className="order-last mt-2 flex w-full basis-full flex-col gap-2 text-left"
        >
          <input type="hidden" name="groupId" value={groupId} />
          {"quoteId" in target ? (
            <input type="hidden" name="quoteId" value={target.quoteId} />
          ) : (
            <input type="hidden" name="parentId" value={target.parentId} />
          )}
          <Textarea
            name="body"
            rows={3}
            aria-label={label}
            placeholder={placeholder}
            className="bg-card min-h-20"
            autoFocus
          />
          {(state.error ?? state.fieldErrors?.body) && (
            <p role="alert" className="text-destructive text-sm">
              {state.error ?? state.fieldErrors?.body}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "등록하는 중…" : "등록"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
