import { describe, expect, test } from "vitest";

import {
  buildPageMap,
  maxPageFor,
  pageToPosition,
  positionToPage,
} from "./pages";

const chapters = [
  { number: 1, start_page: 7 },
  { number: 2, start_page: 43 },
  { number: 3, start_page: 111 },
];
const map = buildPageMap(chapters, 189)!;

describe("buildPageMap", () => {
  test("모든 장의 시작 쪽과 전체 쪽수가 있어야 만든다", () => {
    expect(map.starts.map((item) => item.start)).toEqual([7, 43, 111]);
    expect(buildPageMap(chapters, null)).toBe(null);
    expect(
      buildPageMap([...chapters, { number: 4, start_page: null }], 189),
    ).toBe(null);
    expect(buildPageMap([], 189)).toBe(null);
  });

  test("시작 쪽이 거꾸로이거나 전체 쪽수를 넘으면 쓰지 않는다", () => {
    expect(
      buildPageMap(
        [
          { number: 1, start_page: 50 },
          { number: 2, start_page: 10 },
        ],
        189,
      ),
    ).toBe(null);
    expect(buildPageMap(chapters, 100)).toBe(null);
  });
});

describe("pageToPosition", () => {
  test("DB의 page_to_position과 같이 장과 장 안 %로 바꾼다", () => {
    expect(pageToPosition(map, 7)).toEqual({ chapter: 1, pct: 0 });
    expect(pageToPosition(map, 25)).toEqual({ chapter: 1, pct: 50 });
    expect(pageToPosition(map, 43)).toEqual({ chapter: 2, pct: 0 });
    // 마지막 장은 전체 쪽수 다음 쪽에서 끝난다고 본다.
    expect(pageToPosition(map, 150)).toEqual({ chapter: 3, pct: 49.37 });
  });

  test("첫 장 앞은 첫 장의 처음, 범위 밖은 null", () => {
    expect(pageToPosition(map, 3)).toEqual({ chapter: 1, pct: 0 });
    expect(pageToPosition(map, 0)).toBe(null);
    expect(pageToPosition(map, 190)).toBe(null);
    expect(pageToPosition(map, 1.5)).toBe(null);
  });
});

describe("positionToPage", () => {
  test("쪽으로 정한 위치는 같은 쪽으로 돌아온다", () => {
    for (let page = 7; page <= 189; page += 1) {
      expect(positionToPage(map, pageToPosition(map, page)!)).toBe(page);
    }
  });
});

describe("maxPageFor", () => {
  test("진도를 넘지 않는 가장 뒤 쪽", () => {
    const max = maxPageFor(map, { chapter: 2, pct: 50, finished: false });
    expect(max).toBe(77);
    expect(pageToPosition(map, max)!.pct).toBeLessThanOrEqual(50);
    expect(pageToPosition(map, max + 1)!.pct).toBeGreaterThan(50);
  });

  test("장 끝까지 읽어도 다음 장 첫 쪽은 고를 수 없고, 완독이면 마지막 쪽까지", () => {
    expect(maxPageFor(map, { chapter: 1, pct: 100, finished: false })).toBe(42);
    expect(maxPageFor(map, { chapter: 1, pct: 0, finished: true })).toBe(189);
  });
});
