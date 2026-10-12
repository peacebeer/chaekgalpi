import { z } from "zod";

// 위치 = 그룹 대표 도서의 목차 기준 (장 번호, 장 안 진도 %) 쌍
export const chapterSchema = z
  .number("장을 선택해 주세요.")
  .int("장을 선택해 주세요.")
  .min(1, "장을 선택해 주세요.");

// DB 컬럼이 numeric(5, 2)라 소수 둘째 자리로 맞춘다.
export const pctSchema = z
  .number("위치를 선택해 주세요.")
  .min(0, "위치는 0~100% 사이여야 해요.")
  .max(100, "위치는 0~100% 사이여야 해요.")
  .transform((value) => Math.round(value * 100) / 100);

export const positionSchema = z.object({
  chapter: chapterSchema,
  pct: pctSchema,
});

export type Position = z.infer<typeof positionSchema>;

// Postgres의 (chapter, pct) 행 비교와 같은 순서. a가 앞이면 음수, 같으면 0, 뒤면 양수
export function comparePosition(a: Position, b: Position): number {
  return a.chapter - b.chapter || a.pct - b.pct;
}

// 화면 표시용 판정(예: 진도보다 뒤 위치는 입력 단계에서 막기).
// 실제 잠금은 DB의 can_see와 RLS가 한다. 이 함수로 내용을 가리지 않는다.
export function isWithinProgress(
  position: Position,
  progress: Position,
  finished = false,
): boolean {
  return finished || comparePosition(position, progress) <= 0;
}

export const pageSchema = z
  .number("쪽수를 확인해 주세요.")
  .int("쪽수를 확인해 주세요.")
  .min(1, "쪽수를 확인해 주세요.");

// memberships UPDATE로 저장하는 진도
export const progressSchema = positionSchema.extend({
  finished: z.boolean().default(false),
});

export type ProgressInput = z.infer<typeof progressSchema>;
