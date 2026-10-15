"use client";

import { useActionState } from "react";

import { startDemo } from "@/app/demo/actions";
import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE } from "@/lib/form-state";

type DemoButtonProps = {
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "lg";
  label?: string;
};

// 누르면 가입 없이 체험 그룹으로 들어간다.
export function DemoButton({
  variant = "secondary",
  size = "lg",
  label = "가입 없이 체험하기",
}: DemoButtonProps) {
  const [state, formAction, pending] = useActionState(
    // 체험하기는 입력이 없어 이전 상태를 쓰지 않는다.
    () => startDemo(),
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending ? "체험 그룹 준비 중…" : label}
      </Button>
      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}
