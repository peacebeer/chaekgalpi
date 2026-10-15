import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  // 가입 없이 체험하기로 들어온 익명 사용자
  isAnonymous: boolean;
};

// 지금 로그인한 사용자. 쿠키를 읽으므로 반드시 <Suspense> 안의 컴포넌트나
// Server Action·Route Handler에서 부른다. getClaims는 토큰 서명을 검증한다.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const email = data.claims.email;
  return {
    id: data.claims.sub,
    email: typeof email === "string" ? email : null,
    isAnonymous: data.claims.is_anonymous === true,
  };
}

// 로그인이 필요한 화면·동작에서 쓴다. 로그인 뒤 원래 가려던 곳으로 돌아온다.
export async function requireUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
