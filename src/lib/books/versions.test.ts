import { describe, expect, test } from "vitest";

import { sameToc, toTocVersions, versionSummary } from "./versions";

const row = {
  book_id: "e1000000-0000-0000-0000-0000000000b1",
  title: "소년이 온다",
  author: "한강",
  translator: null,
  publisher: "창비",
  pages: 215,
  cover_url: null,
  toc_source: "nlk",
  chapter_count: 2,
  has_start_pages: true,
  group_count: 3,
  chapters: [
    { number: 1, title: "어린 새", start_page: 7 },
    { number: 2, title: "검은 숨", start_page: 45 },
  ],
};

describe("toTocVersions", () => {
  test("DB 행을 화면에서 쓰는 목차 버전으로 바꾼다", () => {
    expect(toTocVersions([row])).toEqual([
      {
        id: row.book_id,
        title: "소년이 온다",
        author: "한강",
        translator: "",
        publisher: "창비",
        pages: "215",
        coverUrl: "",
        chaptersText: "어린 새 | 7\n검은 숨 | 45",
        chapterCount: 2,
        hasStartPages: true,
        groupCount: 3,
        fromLibrary: true,
      },
    ]);
  });

  test("목차 모양이 이상하거나 비어 있는 행은 뺀다", () => {
    expect(
      toTocVersions([
        { ...row, chapters: "깨진 값" },
        { ...row, chapters: [] },
      ]),
    ).toEqual([]);
  });
});

describe("sameToc", () => {
  const [version] = toTocVersions([row]);
  const chapters = [
    { title: "어린 새", startPage: 7 },
    { title: "검은 숨", startPage: 45 },
  ];

  test("장 제목·시작 쪽·전체 쪽수가 모두 같으면 같은 목차다", () => {
    expect(sameToc(version, { pages: 215, chapters })).toBe(true);
  });

  test("하나라도 다르면 새 버전이다", () => {
    expect(sameToc(version, { pages: 216, chapters })).toBe(false);
    expect(sameToc(version, { pages: null, chapters })).toBe(false);
    expect(
      sameToc(version, {
        pages: 215,
        chapters: [chapters[0], { title: "검은 숨", startPage: 46 }],
      }),
    ).toBe(false);
  });
});

describe("versionSummary", () => {
  test("출처, 장 수, 시작 쪽, 쓰는 그룹 수를 한 줄로 보여 준다", () => {
    const [version] = toTocVersions([row]);
    expect(versionSummary(version)).toBe(
      "도서관 제공 · 2개 장 · 시작 쪽 있음 · 그룹 3개 사용",
    );
    expect(
      versionSummary({
        ...version,
        fromLibrary: false,
        hasStartPages: false,
        groupCount: 0,
      }),
    ).toBe("회원 입력 · 2개 장 · 시작 쪽 없음 · 아직 쓰는 그룹 없음");
  });
});
