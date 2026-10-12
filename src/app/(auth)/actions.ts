"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { toAuthErrorMessage } from "@/lib/errors";
import { fieldErrorsOf, textOf, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, safeNextPath, signupSchema } from "@/lib/validation/auth";

// 메일 링크·구글 로그인이 돌아올 주소. Supabase의 Redirect URLs 허용 목록에 있어야 동작한다.
async function callbackUrl(next: string): Promise<string> {
  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const next = safeNextPath(formData.get("next"));
  const values = { email: textOf(formData, "email") };

  const parsed = loginSchema.safeParse({
    email: values.email,
    password: textOf(formData, "password"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: toAuthErrorMessage(error), values };

  redirect(next);
}

export async function signup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const next = safeNextPath(formData.get("next"));
  const values = {
    nickname: textOf(formData, "nickname"),
    email: textOf(formData, "email"),
  };

  const parsed = signupSchema.safeParse({
    ...values,
    password: textOf(formData, "password"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // 가입 트리거(handle_new_user)가 이 값으로 프로필 닉네임을 만든다.
      data: { nickname: parsed.data.nickname },
      emailRedirectTo: await callbackUrl(next),
    },
  });
  if (error) return { error: toAuthErrorMessage(error), values };

  // 이메일 인증이 꺼져 있으면 바로 로그인된다.
  if (data.session) redirect(next);

  // 이미 가입한 이메일이어도 같은 안내를 보여 준다(가입 여부를 알려 주지 않기 위해).
  return {
    notice: `${parsed.data.email} 주소로 확인 메일을 보냈어요. 메일의 링크를 이 브라우저에서 열면 가입이 끝나요.`,
  };
}

export async function loginWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(next) },
  });
  if (error || !data.url) {
    redirect(`/login?error=${error?.code ?? "auth_callback_failed"}`);
  }

  redirect(data.url);
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
