import type { Position } from "@/lib/validation/position";

// 책 전체에서 얼마나 읽었는지(0~100). 장마다 길이가 같다고 보는 어림값이라 현황판 막대에만 쓴다.
// 잠금 판정에는 쓰지 않는다(그건 DB가 (장, %) 쌍으로 한다).
export function overallPercent(
  position: Position,
  chapterCount: number,
  finished = false,
): number {
  if (finished) return 100;
  if (chapterCount < 1) return 0;

  const chapter = Math.min(Math.max(position.chapter, 1), chapterCount);
  const pct = Math.min(Math.max(position.pct, 0), 100);
  return Math.round((((chapter - 1) * 100 + pct) / chapterCount) * 10) / 10;
}

// "2장 · 40%" 또는 목차 없는 책의 "40%"
export function positionLabel(
  position: Position,
  wholeBook: boolean,
  finished = false,
): string {
  if (finished) return "완독";
  const pct = `${Math.round(position.pct)}%`;
  return wholeBook ? pct : `${position.chapter}장 · ${pct}`;
}
