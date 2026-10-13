"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";

type ConfirmActionProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  // 폼과 함께 보낼 숨은 값(예: groupId, userId)
  fields: Record<string, string>;
  label: string;
  // 한 번 더 물을 때 보여 줄 문구와 확정 버튼 이름
  question: string;
  confirmLabel: string;
  size?: "sm" | "default";
  // 처음 보이는 버튼의 모양. 글 목록의 보조 버튼은 "ghost"로 맞춘다.
  triggerVariant?: "outline" | "ghost";
};

// 되돌리기 어려운 동작(강퇴·탈퇴·삭제)을 두 번 눌러야 실행되게 한다.
export function ConfirmAction({
  action,
  fields,
  label,
  question,
  confirmLabel,
  size = "sm",
  triggerVariant = "outline",
}: ConfirmActionProps) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button
        type="button"
        variant={triggerVariant}
        size={size}
        onClick={() => setAsking(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p className="text-sm">{question}</p>
      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="destructive"
          size={size}
          disabled={pending}
        >
          {pending ? "처리하는 중…" : confirmLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={size}
          onClick={() => setAsking(false)}
          disabled={pending}
        >
          취소
        </Button>
      </div>
    </form>
  );
}
