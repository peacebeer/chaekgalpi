import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import type { Database } from "./database.types";

import { getSupabaseEnv } from "./env";

// 서버 컴포넌트·Server Action·Route Handler용. 요청마다 새로 만든다(전역에 두지 않는다).
export async function createClient() {
  // 세션 확인은 현재 시각과 토큰 만료 시각을 비교하므로 미리 그려 둘 수 없다.
  // 실제 요청이 올 때까지 기다리게 해서 Next.js의 사전 렌더링·미리 불러오기에서 뺀다.
  await connection();

  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy.ts가 맡는다.
        }
      },
    },
  });
}
