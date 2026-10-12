import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

// 클라이언트 컴포넌트용. 로그인 사용자 권한으로만 동작하고 RLS가 데이터를 지킨다.
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
