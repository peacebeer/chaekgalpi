"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { toErrorMessage } from "@/lib/errors";
import { fieldErrorsOf, textOf, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { groupDetailsSchema } from "@/lib/validation/group";

// 아래 동작의 권한은 모두 RLS가 판정한다(수정·삭제·강퇴는 리더, 탈퇴는 본인).
// 권한이 없으면 오류 없이 0행이 바뀌므로, 바뀐 행 수로 결과를 확인한다.
const NOT_ALLOWED = toErrorMessage("not_owner");

export async function updateGroup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const groupId = uuidSchema.safeParse(textOf(formData, "groupId"));
  if (!groupId.success) return { error: toErrorMessage("group_not_found") };
  await requireUser(`/groups/${groupId.data}/settings`);

  const parsed = groupDetailsSchema.safeParse({
    name: textOf(formData, "name"),
    capacity: Number(textOf(formData, "capacity")),
    startDate: textOf(formData, "startDate"),
    targetDate: textOf(formData, "targetDate"),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { count: memberCount } = await supabase
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("group_id", groupId.data);
  if (memberCount !== null && parsed.data.capacity < memberCount) {
    return {
      fieldErrors: {
        capacity: `지금 회원이 ${memberCount}명이라 정원을 그보다 줄일 수 없어요.`,
      },
    };
  }

  const { error, count } = await supabase
    .from("groups")
    .update(
      {
        name: parsed.data.name,
        capacity: parsed.data.capacity,
        start_date: parsed.data.startDate,
        target_date: parsed.data.targetDate,
        is_public: parsed.data.isPublic,
      },
      { count: "exact" },
    )
    .eq("id", groupId.data);
  if (error) return { error: toErrorMessage(error) };
  if (!count) return { error: NOT_ALLOWED };

  refresh();
  return { notice: "저장했어요." };
}

// 리더가 회원을 내보내거나, 회원이 스스로 나간다. 리더 본인은 나갈 수 없다(그룹 삭제만 가능).
export async function removeMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const groupId = uuidSchema.safeParse(textOf(formData, "groupId"));
  const userId = uuidSchema.safeParse(textOf(formData, "userId"));
  if (!groupId.success || !userId.success) {
    return { error: toErrorMessage("group_not_found") };
  }
  const user = await requireUser(`/groups/${groupId.data}`);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("memberships")
    .delete({ count: "exact" })
    .eq("group_id", groupId.data)
    .eq("user_id", userId.data);
  if (error) return { error: toErrorMessage(error) };
  if (!count) return { error: NOT_ALLOWED };

  if (userId.data === user.id) redirect("/groups");

  refresh();
  return {};
}

// 그룹과 그 안의 회원·인용 카드·감상이 모두 지워진다. 되돌릴 수 없다.
export async function deleteGroup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const groupId = uuidSchema.safeParse(textOf(formData, "groupId"));
  if (!groupId.success) return { error: toErrorMessage("group_not_found") };
  await requireUser(`/groups/${groupId.data}/settings`);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("groups")
    .delete({ count: "exact" })
    .eq("id", groupId.data);
  if (error) return { error: toErrorMessage(error) };
  if (!count) return { error: NOT_ALLOWED };

  redirect("/groups");
}
