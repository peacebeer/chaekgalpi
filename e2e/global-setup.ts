import { createClient } from "@supabase/supabase-js";

import { e2eAccounts } from "./accounts";

// CI의 임시 로컬 Supabase에는 계정이 없으므로 테스트 전에 가입시킨다.
// 이메일 확인이 꺼져 있는 로컬 전용이다(E2E_CREATE_USERS=1 일 때만 동작).
// 실제 프로젝트에서는 메일 확인이 필요해 이 방법을 쓰지 않고, 미리 만든 계정을 쓴다.
export default async function globalSetup() {
  if (process.env.E2E_CREATE_USERS !== "1") return;

  const accounts = e2eAccounts();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!accounts || !url || !key) {
    throw new Error(
      "E2E_CREATE_USERS=1 인데 계정 또는 Supabase 환경 변수가 없다",
    );
  }

  for (const [nickname, account] of [
    ["E2E 리더", accounts.a],
    ["E2E 회원", accounts.b],
  ] as const) {
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
    const { error } = await supabase.auth.signUp({
      email: account.email,
      password: account.password,
      options: { data: { nickname } },
    });
    // 다시 돌릴 때 이미 있는 계정은 그대로 쓴다.
    if (error && error.code !== "user_already_exists") {
      throw new Error(
        `E2E 계정을 만들지 못했다: ${error.code ?? error.message}`,
      );
    }
  }
}
