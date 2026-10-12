import type { z } from "zod";

// Server Action이 useActionState로 돌려주는 폼 상태
export type FormState = {
  // 폼 전체에 대한 오류
  error?: string;
  // 성공 안내
  notice?: string;
  // 입력 칸별 오류(칸마다 첫 번째 것만)
  fieldErrors?: Record<string, string>;
  // 오류가 났을 때 다시 채워 줄 입력값(비밀번호는 넣지 않는다)
  values?: Record<string, string>;
};

export const EMPTY_FORM_STATE: FormState = {};

export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export function textOf(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
