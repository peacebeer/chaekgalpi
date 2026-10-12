import { z } from "zod";

import { nicknameSchema } from "./profile";

export const PASSWORD_MIN = 8;
// bcrypt가 72바이트까지만 쓰므로 Supabase Auth도 그 이상은 받지 않는다.
export const PASSWORD_MAX = 72;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("이메일 주소를 확인해 주세요."));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `비밀번호는 ${PASSWORD_MIN}자 이상으로 정해 주세요.`)
  .max(PASSWORD_MAX, `비밀번호는 ${PASSWORD_MAX}자까지 쓸 수 있어요.`);

export const loginSchema = z.object({
  email: emailSchema,
  // 로그인은 길이 규칙을 알려 주지 않는다(가입 때만 검사).
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export const signupSchema = z.object({
  nickname: nicknameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// 로그인 뒤 돌아갈 경로. 우리 사이트 안의 경로만 허용한다(오픈 리다이렉트 방지).
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\s]/.test(value)) return fallback;
  return value;
}
