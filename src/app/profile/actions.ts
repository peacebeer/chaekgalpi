"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { toErrorMessage } from "@/lib/errors";
import { fieldErrorsOf, textOf, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation/profile";

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/profile");
  const values = {
    nickname: textOf(formData, "nickname"),
  };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const supabase = await createClient();
  // RLS가 본인 행만 고치게 한다. id 조건은 의도를 드러내기 위한 것이다.
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id);
  if (error) return { error: toErrorMessage(error), values };

  // 머리글의 닉네임도 새 값으로 다시 그린다.
  refresh();
  return {
    notice: "저장했어요.",
    values: { nickname: parsed.data.nickname },
  };
}
