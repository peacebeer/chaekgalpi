import { z } from "zod";

import { boundedText, charLength, uuidSchema } from "./common";
import { LIMITS } from "./limits";
import { noteBodySchema, noteKindSchema } from "./note";
import { chapterSchema, pctSchema } from "./position";

export const quoteTextSchema = boundedText(
  1,
  LIMITS.quoteTextMax,
  `인용문을 1~${LIMITS.quoteTextMax}자로 입력해 주세요.`,
);

// rpc('create_quote') 입력. 저작권 규칙: 카드당 300자, 등록 시 본인 감상 필수
export const createQuoteSchema = z.object({
  groupId: uuidSchema,
  chapter: chapterSchema,
  pct: pctSchema,
  text: quoteTextSchema,
  body: noteBodySchema,
  kind: noteKindSchema.default("impression"),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

// 그룹 인용 합계 한도에서 남은 글자 수(입력 화면 안내용). 최종 판정은 create_quote가 한다.
export function remainingQuoteChars(
  usedChars: number,
  quoteLimit: number = LIMITS.groupQuoteLimit,
): number {
  return Math.max(0, quoteLimit - usedChars);
}

export function exceedsQuoteLimit(
  text: string,
  usedChars: number,
  quoteLimit: number = LIMITS.groupQuoteLimit,
): boolean {
  return usedChars + charLength(text.trim()) > quoteLimit;
}
