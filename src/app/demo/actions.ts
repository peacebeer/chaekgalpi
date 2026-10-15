"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { toAuthErrorMessage, toErrorMessage } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const DEMO_NICKNAME = "체험 독자";

// 가입 없이 체험하기: 익명으로 로그인하고, 예시 글이 채워진 체험 그룹을 새로 만든다.
// 이미 가입한 회원은 체험 그룹 대신 내 그룹 목록으로 보낸다.
export async function startDemo(): Promise<FormState> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (user && !user.isAnonymous) redirect("/groups");
  if (!user) {
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { nickname: DEMO_NICKNAME } },
    });
    if (error) return { error: toAuthErrorMessage(error) };
  }

  const { data: groupId, error } = await supabase.rpc("start_demo");
  if (error || !groupId) return { error: toErrorMessage(error) };
  redirect(`/groups/${groupId}`);
}
