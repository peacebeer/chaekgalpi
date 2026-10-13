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

  const pairs = (text: string) =>
    parseChapterLines(text).map((chapter) => [
      chapter.title,
      chapter.startPage,
    ]);

  test("쪽수에 p·쪽 같은 단위가 붙어도 읽는다", () => {
    expect(
      pairs(
        "어린 새 130p\n검은 숨 145쪽\n일곱 개의 뺨 p.173\n쇠와 피 | 201p\n밤의 눈동자  230 쪽",
      ),
    ).toEqual([
      ["어린 새", 130],
      ["검은 숨", 145],
      ["일곱 개의 뺨", 173],
      ["쇠와 피", 201],
      ["밤의 눈동자", 230],
    ]);
  });

  test("모든 줄이 커지는 숫자로 끝나면 | 없이도 쪽수로 읽는다", () => {
    expect(pairs("어린 새 7\n검은 숨 45\n일곱 개의 뺨 73")).toEqual([
      ["어린 새", 7],
      ["검은 숨", 45],
      ["일곱 개의 뺨", 73],
    ]);
  });

  test("1씩 늘어나는 숫자는 장 번호로 보고 제목에 남긴다", () => {
    expect(pairs("챕터 1\n챕터 2\n챕터 3")).toEqual([
      ["챕터 1", null],
      ["챕터 2", null],
      ["챕터 3", null],
    ]);
  });

  test("쪽수 없는 줄(부 제목, 프롤로그)이 조금 섞여도 나머지는 쪽수로 읽는다", () => {
    expect(
      pairs(
        "프롤로그\n포포 사피엔스 17\n타인은 지옥이다 21\n시선감옥\n감옥 53",
      ),
    ).toEqual([
      ["프롤로그", null],
      ["포포 사피엔스", 17],
      ["타인은 지옥이다", 21],
      ["시선감옥", null],
      ["감옥", 53],
    ]);
  });

  test("숫자로 끝나는 줄이 절반쯤뿐이거나 숫자가 작아지면 제목에 남긴다", () => {
    expect(pairs("들어가며\n1부\n어린 새 7\n검은 숨 45")).toEqual([
      ["들어가며", null],
      ["1부", null],
      ["어린 새 7", null],
      ["검은 숨 45", null],
    ]);
    expect(pairs("서울 1988\n부산 1950")).toEqual([
      ["서울 1988", null],
      ["부산 1950", null],
    ]);
  });

  test("|를 쓴 줄이 있으면 나머지 줄의 숫자는 추측하지 않는다", () => {
    expect(pairs("1984 1\n제2차 세계대전 1939\n맺음말 | 250")).toEqual([
      ["1984 1", null],
      ["제2차 세계대전 1939", null],
      ["맺음말", 250],
    ]);
  });

  test("숫자로 끝나는 줄이 하나뿐이면 제목에 남긴다", () => {
    expect(pairs("1984 1")).toEqual([["1984 1", null]]);
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

describe("화면에 안내하는 시작 쪽 표기", () => {
  test("안내한 형식은 모두 같은 장과 쪽수로 읽힌다", () => {
    for (const line of [
      "어린 새 | 7",
      "어린 새 7p",
      "어린 새 7쪽",
      "어린 새 p.7",
    ]) {
      expect(parseChapterLines(line)).toEqual([
        { number: 1, title: "어린 새", startPage: 7 },
      ]);
    }
    expect(parseChapterLines("어린 새")).toEqual([
      { number: 1, title: "어린 새", startPage: null },
    ]);
  });
});
