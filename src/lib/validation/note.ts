import { z } from "zod";

import { boundedText, uuidSchema } from "./common";
import { LIMITS } from "./limits";
import { positionSchema } from "./position";

export const NOTE_KINDS = [
  "impression",
  "memo",
  "question",
  "summary",
] as const;

export const noteKindSchema = z.enum(NOTE_KINDS);

export type NoteKind = z.infer<typeof noteKindSchema>;

export const noteBodySchema = boundedText(
  1,
  LIMITS.noteBodyMax,
  `내용을 1~${LIMITS.noteBodyMax.toLocaleString("ko-KR")}자로 입력해 주세요.`,
);

// 인용 카드에 다는 감상. 위치는 DB 트리거가 카드 위치로 채운다.
export const quoteNoteSchema = z.object({
  groupId: uuidSchema,
  quoteId: uuidSchema,
  body: noteBodySchema,
  kind: noteKindSchema.default("impression"),
});

// 인용 없이 위치에 붙이는 메모·질문. position이 null이면 "책 전체"(완독자 전용)
export const positionNoteSchema = z.object({
  groupId: uuidSchema,
  position: positionSchema.nullable(),
  body: noteBodySchema,
  kind: noteKindSchema.default("memo"),
});

// 답글(1단계만). 위치와 종류는 보내지 않는다.
export const replySchema = z.object({
  groupId: uuidSchema,
  parentId: uuidSchema,
  body: noteBodySchema,
});

export type QuoteNoteInput = z.infer<typeof quoteNoteSchema>;
export type PositionNoteInput = z.infer<typeof positionNoteSchema>;
export type ReplyInput = z.infer<typeof replySchema>;
