"use client";

import { useActionState } from "react";

import { updateProfile } from "@/app/profile/actions";
import { Field } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation/limits";

type ProfileFormProps = {
  nickname: string;
};

export function ProfileForm({ nickname }: ProfileFormProps) {
  const initialState: FormState = { values: { nickname } };
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field
        name="nickname"
        label="닉네임"
        autoComplete="nickname"
        maxLength={LIMITS.nicknameMax}
        defaultValue={state.values?.nickname}
        error={state.fieldErrors?.nickname}
        hint={`그룹에서 다른 회원에게 보이는 이름이에요. ${LIMITS.nicknameMax}자까지`}
        required
      />

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

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "저장하는 중…" : "저장"}
      </Button>
    </form>
  );
}
