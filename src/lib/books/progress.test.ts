import { describe, expect, test } from "vitest";

import { overallPercent, positionLabel } from "./progress";

describe("overallPercent", () => {
  test("장 수로 나눠 책 전체 진행률을 어림한다", () => {
    expect(overallPercent({ chapter: 1, pct: 0 }, 4)).toBe(0);
    expect(overallPercent({ chapter: 1, pct: 50 }, 4)).toBe(12.5);
    expect(overallPercent({ chapter: 3, pct: 0 }, 4)).toBe(50);
    expect(overallPercent({ chapter: 4, pct: 100 }, 4)).toBe(100);
  });

  test("목차 없는 책은 pct가 그대로 전체 진행률이다", () => {
    expect(overallPercent({ chapter: 1, pct: 37.5 }, 1)).toBe(37.5);
  });

  test("완독이면 위치와 상관없이 100이다", () => {
    expect(overallPercent({ chapter: 1, pct: 0 }, 6, true)).toBe(100);
  });

  test("범위를 벗어난 값은 0~100 안으로 맞춘다", () => {
    expect(overallPercent({ chapter: 9, pct: 100 }, 4)).toBe(100);
    expect(overallPercent({ chapter: 1, pct: 10 }, 0)).toBe(0);
  });
});

describe("positionLabel", () => {
  test("장과 %를 함께 보여 준다", () => {
    expect(positionLabel({ chapter: 2, pct: 40.4 }, false)).toBe("2장 · 40%");
  });

  test("목차 없는 책은 %만 보여 준다", () => {
    expect(positionLabel({ chapter: 1, pct: 40 }, true)).toBe("40%");
  });

  test("완독을 표시한다", () => {
    expect(positionLabel({ chapter: 3, pct: 100 }, false, true)).toBe("완독");
  });
});
