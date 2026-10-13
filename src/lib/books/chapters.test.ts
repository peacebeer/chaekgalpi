import { describe, expect, test } from "vitest";

import {
  formatChapterLines,
  isWholeBook,
  parseChapterLines,
  wholeBookChapters,
} from "./chapters";

describe("parseChapterLines", () => {
  test("국립중앙도서관 목차 파일 형식을 읽는다", () => {
    const text =
      "차례\r\n\r\n1장 나  7\r\n2장 그녀  43\r\n3장 모든 흰  111\r\n";
    expect(parseChapterLines(text)).toEqual([
      { number: 1, title: "1장 나", startPage: 7 },
      { number: 2, title: "2장 그녀", startPage: 43 },
      { number: 3, title: "3장 모든 흰", startPage: 111 },
    ]);
  });

  test("쪽수가 없으면 제목만 받는다", () => {
    expect(parseChapterLines("어린 새\n\n  검은 숨  \n")).toEqual([
      { number: 1, title: "어린 새", startPage: null },
      { number: 2, title: "검은 숨", startPage: null },
    ]);
  });

  test("| · 탭 · 점선 뒤의 숫자를 시작 쪽으로 읽는다", () => {
    expect(
      parseChapterLines(
        "어린 새 | 7\n검은 숨\t45\n일곱 개의 뺨 ······ 73\n쇠와 피...101",
      ).map((chapter) => [chapter.title, chapter.startPage]),
    ).toEqual([
      ["어린 새", 7],
      ["검은 숨", 45],
      ["일곱 개의 뺨", 73],
      ["쇠와 피", 101],
    ]);
  });

  test("공백 한 칸 뒤의 숫자는 제목의 일부로 둔다", () => {
    expect(parseChapterLines("1984 1\n제2차 세계대전 1939")).toEqual([
      { number: 1, title: "1984 1", startPage: null },
      { number: 2, title: "제2차 세계대전 1939", startPage: null },
    ]);
  });

  test("빈 입력은 빈 목록이다", () => {
    expect(parseChapterLines(" \n목차\n")).toEqual([]);
  });
});

describe("formatChapterLines", () => {
  test("다시 읽으면 같은 목차가 된다", () => {
    const chapters = [
      { number: 1, title: "1장 나", startPage: 7 },
      { number: 2, title: "작가의 말", startPage: null },
    ];
    const text = formatChapterLines(chapters);
    expect(text).toBe("1장 나 | 7\n작가의 말");
    expect(parseChapterLines(text)).toEqual(chapters);
  });
});

describe("wholeBookChapters", () => {
  test("목차가 없으면 책 전체를 한 장으로 둔다", () => {
    expect(wholeBookChapters(null)).toEqual([
      { number: 1, title: "책 전체", startPage: null },
    ]);
    expect(isWholeBook(wholeBookChapters(null))).toBe(true);
  });

  test("전체 쪽수를 알면 1쪽부터 시작하게 해 쪽수 입력을 받는다", () => {
    expect(wholeBookChapters(189)[0].startPage).toBe(1);
  });

  test("직접 적은 목차는 책 전체로 보지 않는다", () => {
    expect(isWholeBook(parseChapterLines("1장 나\n2장 그녀"))).toBe(false);
    expect(isWholeBook(parseChapterLines("프롤로그"))).toBe(false);
  });
});
