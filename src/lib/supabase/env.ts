import { z } from "zod";

const supabaseEnvSchema = z.object({
  url: z.url("NEXT_PUBLIC_SUPABASE_URL이 올바른 주소가 아니에요."),
  publishableKey: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 비어 있어요."),
});

// 브라우저에 공개해도 되는 두 값만 읽는다. Secret/service_role 키는 쓰지 않는다.
// NEXT_PUBLIC_ 값은 빌드 때 치환되므로 process.env.이름 형태로 직접 적어야 한다.
export function getSupabaseEnv() {
  return supabaseEnvSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
