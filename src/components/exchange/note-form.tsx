"use client";

import { useActionState, useState } from "react";

import { addNote } from "@/app/groups/[id]/exchange-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";

type NoteFormProps = {
  groupId: string;
  // 인용 카드에 다는 감상이면 quoteId, 답글이면 parentId
  target: { quoteId: string } | { parentId: string };
  label: string;
  placeholder: string;
};

// 버튼을 누르면 펼쳐지는 짧은 글쓰기 칸(카드 감상, 답글)
export function NoteForm({
  groupId,
  target,
  label,
  placeholder,
}: NoteFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await addNote(prev, formData);
      if (result.notice) setOpen(false);
      return result;
    },
    EMPTY_FORM_STATE,
  );

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      {"quoteId" in target ? (
        <input type="hidden" name="quoteId" value={target.quoteId} />
      ) : (
        <input type="hidden" name="parentId" value={target.parentId} />
      )}
      <Textarea
        name="body"
        rows={2}
        aria-label={label}
        placeholder={placeholder}
        autoFocus
      />
      {(state.error ?? state.fieldErrors?.body) && (
        <p role="alert" className="text-destructive text-sm">
          {state.error ?? state.fieldErrors?.body}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "등록하는 중…" : "등록"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          취소
        </Button>
      </div>
    </form>
  );
}
