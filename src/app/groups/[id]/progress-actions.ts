"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { toErrorMessage } from "@/lib/errors";
import { textOf, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { pageSchema, progressSchema } from "@/lib/validation/position";

// 내 진도를 저장한다. RLS와 컬럼 권한이 본인 행의 진도 컬럼만 바꾸게 한다.
export async function saveProgress(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const groupId = uuidSchema.safeParse(textOf(formData, "groupId"));
  if (!groupId.success) return { error: toErrorMessage("group_not_found") };
  const user = await requireUser(`/groups/${groupId.data}`);

  const parsed = progressSchema.safeParse({
    chapter: Number(textOf(formData, "chapter")),
    pct: Number(textOf(formData, "pct")),
    finished: formData.get("finished") === "on",
  });
  if (!parsed.success) return { error: toErrorMessage("position_invalid") };

  const supabase = await createClient();
  let { chapter, pct } = parsed.data;

  if (parsed.data.finished) {
    // 완독이면 위치를 마지막 장의 끝으로 맞춘다.
    const { data: group } = await supabase
      .from("groups")
      .select("books(book_chapters(number))")
      .eq("id", groupId.data)
      .maybeSingle();
    const numbers = group?.books.book_chapters.map((row) => row.number) ?? [];
    chapter = numbers.length > 0 ? Math.max(...numbers) : chapter;
    pct = 100;
  }

  const { error, count } = await supabase
    .from("memberships")
    .update(
      {
        progress_chapter: chapter,
        progress_pct: pct,
        finished_at: parsed.data.finished ? new Date().toISOString() : null,
      },
      { count: "exact" },
    )
    .eq("group_id", groupId.data)
    .eq("user_id", user.id);
  if (error) return { error: toErrorMessage(error) };
  if (!count) return { error: toErrorMessage("not_member") };

  refresh();
  return {
    notice: parsed.data.finished
      ? "완독을 기록했어요. 이제 그룹의 모든 감상이 열려요."
      : "진도를 저장했어요. 여기까지의 감상이 열려요.",
  };
}

export type PagePositionResult =
  | { ok: true; chapter: number; pct: number | null }
  | { ok: false; message: string };

// 쪽수 → (장, %). 대표 도서의 모든 장에 시작 쪽이 있을 때만 쓸 수 있다.
// pct가 null이면 그 장 안의 위치는 알 수 없어 슬라이더로 받는다.
export async function pageToPosition(
  groupId: string,
  page: number,
): Promise<PagePositionResult> {
  const parsedGroup = uuidSchema.safeParse(groupId);
  const parsedPage = pageSchema.safeParse(page);
  if (!parsedGroup.success || !parsedPage.success) {
    return { ok: false, message: toErrorMessage("page_invalid") };
  }
  await requireUser(`/groups/${parsedGroup.data}`);

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("book_id")
    .eq("id", parsedGroup.data)
    .maybeSingle();
  if (!group) return { ok: false, message: toErrorMessage("group_not_found") };

  const { data, error } = await supabase.rpc("page_to_position", {
    p_book_id: group.book_id,
    p_page: parsedPage.data,
  });
  const row = data?.[0];
  if (error || !row) return { ok: false, message: toErrorMessage(error) };

  return {
    ok: true,
    chapter: row.chapter,
    pct: row.pct === null ? null : Number(row.pct),
  };
}
