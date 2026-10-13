"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { toErrorMessage } from "@/lib/errors";
import { fieldErrorsOf, textOf, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import {
  positionNoteSchema,
  quoteNoteSchema,
  replySchema,
} from "@/lib/validation/note";
import { chapterSchema, pctSchema } from "@/lib/validation/position";
import { createQuoteSchema, quoteTextSchema } from "@/lib/validation/quote";

// 위치·진도 잠금·인용 한도 같은 규칙은 모두 DB(RLS, 트리거, RPC)가 판정한다.
// 여기서는 입력 모양만 검사하고 DB가 던진 오류 키를 문구로 바꾼다.

// 인용 카드 등록: 인용문 + 본인 감상을 한 번에 저장한다.
export async function createQuote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createQuoteSchema.safeParse({
    groupId: textOf(formData, "groupId"),
    chapter: Number(textOf(formData, "chapter")),
    pct: Number(textOf(formData, "pct")),
    text: textOf(formData, "text"),
    body: textOf(formData, "body"),
    kind: textOf(formData, "kind") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  await requireUser(`/groups/${parsed.data.groupId}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_quote", {
    p_group_id: parsed.data.groupId,
    p_chapter: parsed.data.chapter,
    p_pct: parsed.data.pct,
    p_text: parsed.data.text,
    p_body: parsed.data.body,
    p_kind: parsed.data.kind,
  });
  if (error) return { error: toErrorMessage(error) };

  refresh();
  return { notice: "인용 카드를 등록했어요." };
}

export type SimilarQuote = {
  id: string;
  text: string;
  chapter: number;
  pct: number;
};

// 인용을 입력하는 동안 같은 장의 비슷한 카드를 찾는다. RLS 때문에 내가 볼 수 있는 카드만 나온다.
export async function findSimilarQuotes(
  groupId: string,
  chapter: number,
  pct: number,
  text: string,
): Promise<SimilarQuote[]> {
  const parsedGroup = uuidSchema.safeParse(groupId);
  const parsedChapter = chapterSchema.safeParse(chapter);
  const parsedPct = pctSchema.safeParse(pct);
  const parsedText = quoteTextSchema.safeParse(text);
  if (
    !parsedGroup.success ||
    !parsedChapter.success ||
    !parsedPct.success ||
    !parsedText.success
  ) {
    return [];
  }
  await requireUser(`/groups/${parsedGroup.data}`);

  const supabase = await createClient();
  const { data } = await supabase.rpc("similar_quotes", {
    p_group_id: parsedGroup.data,
    p_chapter: parsedChapter.data,
    p_pct: parsedPct.data,
    p_text: parsedText.data,
  });
  return (data ?? []).map((row) => ({
    id: row.id,
    text: row.text,
    chapter: row.chapter,
    pct: Number(row.pct),
  }));
}

// 감상·메모·질문·답글. 어떤 값이 왔는지로 종류를 가린다.
// - parentId: 답글 / quoteId: 인용 카드에 다는 감상 / 둘 다 없음: 위치에 붙이는 메모·질문
export async function addNote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const groupId = textOf(formData, "groupId");
  const body = textOf(formData, "body");
  const kind = textOf(formData, "kind") || undefined;
  const supabase = await createClient();

  if (textOf(formData, "parentId")) {
    const parsed = replySchema.safeParse({
      groupId,
      parentId: textOf(formData, "parentId"),
      body,
    });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
    await requireUser(`/groups/${parsed.data.groupId}`);

    const { error } = await supabase.from("notes").insert({
      group_id: parsed.data.groupId,
      parent_id: parsed.data.parentId,
      body: parsed.data.body,
    });
    if (error) return { error: toErrorMessage(error) };
  } else if (textOf(formData, "quoteId")) {
    const parsed = quoteNoteSchema.safeParse({
      groupId,
      quoteId: textOf(formData, "quoteId"),
      body,
      kind,
    });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
    await requireUser(`/groups/${parsed.data.groupId}`);

    const { error } = await supabase.from("notes").insert({
      group_id: parsed.data.groupId,
      quote_id: parsed.data.quoteId,
      body: parsed.data.body,
      kind: parsed.data.kind,
    });
    if (error) return { error: toErrorMessage(error) };
  } else {
    // 책 전체에 대한 글은 위치 없이 저장하고, 완독자에게만 보인다.
    const wholeBook = formData.get("wholeBook") === "on";
    const parsed = positionNoteSchema.safeParse({
      groupId,
      position: wholeBook
        ? null
        : {
            chapter: Number(textOf(formData, "chapter")),
            pct: Number(textOf(formData, "pct")),
          },
      body,
      kind,
    });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
    await requireUser(`/groups/${parsed.data.groupId}`);

    const { error } = await supabase.from("notes").insert({
      group_id: parsed.data.groupId,
      chapter: parsed.data.position?.chapter ?? null,
      pct: parsed.data.position?.pct ?? null,
      body: parsed.data.body,
      kind: parsed.data.kind,
    });
    if (error) return { error: toErrorMessage(error) };
  }

  refresh();
  return { notice: "등록했어요." };
}

// 좋아요 누르기·취소. liked가 "true"면 지금 눌린 상태이므로 취소한다.
export async function toggleLike(formData: FormData): Promise<void> {
  const noteId = uuidSchema.safeParse(textOf(formData, "noteId"));
  if (!noteId.success) return;
  const user = await requireUser("/groups");

  const supabase = await createClient();
  if (textOf(formData, "liked") === "true") {
    await supabase
      .from("reactions")
      .delete()
      .eq("note_id", noteId.data)
      .eq("user_id", user.id);
  } else {
    // 이미 눌렀으면 중복 오류(23505)가 나지만 결과는 같으므로 무시한다.
    await supabase.from("reactions").insert({ note_id: noteId.data });
  }

  refresh();
}

// 리더가 감상을 숨기거나 다시 보이게 한다. 권한은 DB 함수가 확인한다.
export async function setNoteHidden(formData: FormData): Promise<void> {
  const noteId = uuidSchema.safeParse(textOf(formData, "noteId"));
  if (!noteId.success) return;
  await requireUser("/groups");

  const supabase = await createClient();
  await supabase.rpc("hide_note", {
    p_note_id: noteId.data,
    p_hidden: textOf(formData, "hidden") === "true",
  });

  refresh();
}
