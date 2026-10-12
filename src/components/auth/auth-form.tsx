"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { login, loginWithGoogle, signup } from "@/app/(auth)/actions";
import { Field } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { toAuthErrorMessage } from "@/lib/errors";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { PASSWORD_MIN, safeNextPath } from "@/lib/validation/auth";
import { LIMITS } from "@/lib/validation/limits";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const callbackError = searchParams.get("error");

  const [state, formAction, pending] = useActionState(
    isSignup ? signup : login,
    EMPTY_FORM_STATE,
  );

  const error =
    state.error ?? (callbackError ? toAuthErrorMessage(callbackError) : null);
  const otherHref = `${isSignup ? "/login" : "/signup"}${
    next === "/" ? "" : `?next=${encodeURIComponent(next)}`
  }`;

  if (state.notice) {
    return (
      <p role="status" className="bg-muted rounded-lg p-4 text-sm leading-6">
        {state.notice}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={loginWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" size="lg" className="w-full">
          구글 계정으로 계속하기
        </Button>
      </form>

      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <span className="bg-border h-px flex-1" />
        또는 이메일로
        <span className="bg-border h-px flex-1" />
      </div>

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        {isSignup && (
          <Field
            name="nickname"
            label="닉네임"
            autoComplete="nickname"
            maxLength={LIMITS.nicknameMax}
            defaultValue={state.values?.nickname}
            error={state.fieldErrors?.nickname}
            hint="그룹에서 다른 회원에게 보이는 이름이에요."
            required
          />
        )}
        <Field
          name="email"
          label="이메일"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
          required
        />
        <Field
          name="password"
          label="비밀번호"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          error={state.fieldErrors?.password}
          hint={isSignup ? `${PASSWORD_MIN}자 이상` : undefined}
          required
        />

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "잠시만요…" : isSignup ? "가입하기" : "로그인"}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        {isSignup ? "이미 계정이 있나요? " : "처음이신가요? "}
        <Link href={otherHref} className="text-foreground underline">
          {isSignup ? "로그인" : "가입하기"}
        </Link>
      </p>
    </div>
  );
}
