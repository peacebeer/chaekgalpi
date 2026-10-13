import { z } from "zod";

import { boundedText, optionalText } from "./common";
import { LIMITS } from "./limits";

// ISBN-10 또는 ISBN-13. 붙임표와 공백은 떼고 저장한다.
export const isbnSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
  .refine(
    (value) => /^[0-9X]{10}([0-9]{3})?$/.test(value),
    "ISBN은 숫자 10자리 또는 13자리예요.",
  );

export const bookChapterSchema = z.object({
  number: z
    .number("장 번호를 확인해 주세요.")
    .int("장 번호를 확인해 주세요.")
    .min(1, "장 번호는 1부터 시작해요."),
  title: boundedText(
    1,
    LIMITS.chapterTitleMax,
    `장 제목을 1~${LIMITS.chapterTitleMax}자로 입력해 주세요.`,
  ),
  // 쪽수 → 위치 환산용(선택)
  startPage: z
    .number("시작 쪽을 확인해 주세요.")
    .int("시작 쪽을 확인해 주세요.")
    .min(1, "시작 쪽은 1 이상이어야 해요.")
    .nullish()
    .transform((value) => value ?? null),
});

export const MAX_CHAPTERS = 300;

export const bookChaptersSchema = z
  .array(bookChapterSchema)
  .min(1, "목차에 장을 하나 이상 입력해 주세요.")
  .max(MAX_CHAPTERS, `목차는 ${MAX_CHAPTERS}장까지 입력할 수 있어요.`)
  .refine(
    (chapters) =>
      new Set(chapters.map((chapter) => chapter.number)).size ===
      chapters.length,
    "장 번호가 겹쳐요.",
  );

export const bookSchema = z.object({
  isbn: z
    .union([z.literal(""), isbnSchema])
    .nullish()
    .transform((value) => value || null),
  title: boundedText(
    1,
    LIMITS.bookTitleMax,
    `책 제목을 1~${LIMITS.bookTitleMax}자로 입력해 주세요.`,
  ),
  author: optionalText(
    LIMITS.bookPersonMax,
    `저자는 ${LIMITS.bookPersonMax}자까지 입력할 수 있어요.`,
  ),
  translator: optionalText(
    LIMITS.bookPersonMax,
    `역자는 ${LIMITS.bookPersonMax}자까지 입력할 수 있어요.`,
  ),
  publisher: optionalText(
    LIMITS.publisherMax,
    `출판사는 ${LIMITS.publisherMax}자까지 입력할 수 있어요.`,
  ),
  pages: z
    .number("전체 쪽수를 확인해 주세요.")
    .int("전체 쪽수를 확인해 주세요.")
    .min(1, "전체 쪽수는 1 이상이어야 해요.")
    .nullish()
    .transform((value) => value ?? null),
  // 모르는 값이 오면 직접 입력으로 본다.
  source: z.enum(["nlk", "kakao", "manual"]).catch("manual"),
  // 표지 이미지 주소(서버가 허용한 주소만 넘긴다). 없으면 null
  coverUrl: z
    .string()
    .max(500)
    .nullish()
    .transform((value) => value || null),
  chapters: bookChaptersSchema,
});

export type BookInput = z.infer<typeof bookSchema>;
