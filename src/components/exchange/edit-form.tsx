"use client";

import { useActionState } from "react";

import { usePanel } from "@/components/action-group";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";

type EditFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  // 함께 보낼 숨은 값(예: noteId, quoteId)
  fields: Record<string, string>;
  // 고칠 글이 실리는 이름("body" 또는 "text")
  name: string;
  initial: string;
  label: string;
  hint?: string;
};

// "수정"을 누르면 버튼 줄 아래에 한 줄을 다 쓰는 고치기 칸이 펼쳐진다.
// 버튼은 제자리에 두어 옆 버튼들이 밀리지 않게 한다.
export function EditForm({
  action,
  fields,
  name,
  initial,
  label,
  hint,
}: EditFormProps) {
  const [open, setOpen] = usePanel();
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.notice) setOpen(false);
      return result;
    },
    EMPTY_FORM_STATE,
  );

  return (
    <>
      <Button
        type="button"
        variant={open ? "secondary" : "ghost"}
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
          {Object.entries(fields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <Textarea
            name={name}
            rows={4}
            aria-label={label}
            defaultValue={initial}
            className="bg-card min-h-28"
            autoFocus
          />
          {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
          {state.error && (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
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
              {pending ? "저장하는 중…" : "저장"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
