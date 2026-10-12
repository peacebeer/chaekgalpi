import { z } from "zod";

// Postgres char_length와 같은 기준(코드 포인트)으로 센다. "😀".length는 2지만 여기서는 1.
export function charLength(value: string): number {
  return Array.from(value).length;
}

// 앞뒤 공백을 뗀 뒤 min~max자인 글
export function boundedText(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => {
      const length = charLength(value);
      return length >= min && length <= max;
    }, message);
}

// 비워 두면 null로 저장하는 선택 입력
export function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => charLength(value) <= max, message)
    .transform((value) => (value === "" ? null : value))
    .nullish()
    .transform((value) => value ?? null);
}

export const uuidSchema = z.uuid("잘못된 요청이에요.");

// HTML date 입력값(YYYY-MM-DD). 비워 두면 null
export const optionalDateSchema = z
  .union([z.literal(""), z.iso.date("날짜를 확인해 주세요.")])
  .nullish()
  .transform((value) => value || null);
