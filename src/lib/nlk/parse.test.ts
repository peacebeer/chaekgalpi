import { describe, expect, test } from "vitest";

import {
  nlkResponseSchema,
  parsePages,
  safeTocUrl,
  splitAuthor,
  toNlkBooks,
} from "./parse";

describe("splitAuthor", () => {
  test("역할 표시를 떼고 저자와 역자를 나눈다", () => {
    expect(splitAuthor("지은이: 한강")).toEqual({
      author: "한강",
      translator: "",
    });
    expect(splitAuthor("저자 : 윤지한")).toEqual({
      author: "윤지한",
      translator: "",
    });
    expect(splitAuthor("주리 데이 지음 ;윤재승 옮김")).toEqual({
      author: "주리 데이",
      translator: "윤재승",
    });
    expect(splitAuthor("")).toEqual({ author: "", translator: "" });
  });
});

describe("parsePages", () => {
  test("쪽수 표기에서 숫자만 꺼낸다", () => {
    expect(parsePages("103 p.")).toBe(103);
    expect(parsePages("약 500 페이지 내외")).toBe(500);
    expect(parsePages("")).toBe(null);
    expect(parsePages("0")).toBe(null);
  });
});

describe("safeTocUrl", () => {
  test("국립중앙도서관 서지 파일 주소만 허용한다", () => {
    const url =
      "https://www.nl.go.kr/seoji/fu/ecip/dbfiles/CIP_FILES_TBL/6631705_6.txt";
    expect(safeTocUrl(url)).toBe(url);
    expect(safeTocUrl("")).toBe(null);
    expect(safeTocUrl("http://www.nl.go.kr/seoji/a.txt")).toBe(null);
    expect(safeTocUrl("https://evil.example/seoji/a.txt")).toBe(null);
    expect(safeTocUrl("https://www.nl.go.kr.evil.example/seoji/a.txt")).toBe(
      null,
    );
    expect(safeTocUrl("https://www.nl.go.kr/other/a.txt")).toBe(null);
  });
});

describe("toNlkBooks", () => {
  const doc = {
    TITLE: "흰 ",
    AUTHOR: "지은이: 한강",
    PUBLISHER: "문학동네",
    EA_ISBN: "9788954651134",
    PAGE: "189 p.",
    BOOK_TB_CNT_URL:
      "https://www.nl.go.kr/seoji/fu/ecip/dbfiles/CIP_FILES_TBL/6631705_6.txt",
    PUBLISH_PREDATE: "20180425",
  };

  test("응답 한 건을 화면에서 쓰는 모양으로 바꾼다", () => {
    const { docs } = nlkResponseSchema.parse({
      TOTAL_COUNT: "1",
      docs: [{ ...doc, KDC: "810" }],
    });
    expect(toNlkBooks(docs)).toEqual([
      {
        isbn: "9788954651134",
        title: "흰",
        author: "한강",
        translator: "",
        publisher: "문학동네",
        pages: 189,
        year: "2018",
        tocText: null,
        tocUrl: doc.BOOK_TB_CNT_URL,
        hasToc: true,
      },
    ]);
  });

  test("목차 글이 응답에 담겨 오면 주소가 없어도 목차가 있다고 본다", () => {
    const { docs } = nlkResponseSchema.parse({
      docs: [
        {
          ...doc,
          BOOK_TB_CNT: "프롤로그 17\r\n시선감옥 53\r\n",
          BOOK_TB_CNT_URL: "",
        },
        { ...doc, EA_ISBN: "9788954651301", BOOK_TB_CNT_URL: "" },
      ],
    });
    const [withText, without] = toNlkBooks(docs);
    expect(withText).toMatchObject({
      tocText: "프롤로그 17\r\n시선감옥 53",
      tocUrl: null,
      hasToc: true,
    });
    expect(without).toMatchObject({ tocText: null, hasToc: false });
  });

  test("ISBN이 없거나 겹치는 자료는 뺀다", () => {
    const { docs } = nlkResponseSchema.parse({
      docs: [doc, { ...doc, TITLE: "흰 (중복)" }, { TITLE: "[세트] 1~2" }],
    });
    expect(toNlkBooks(docs).map((book) => book.title)).toEqual(["흰"]);
  });

  test("예상과 다른 응답은 거부한다", () => {
    expect(nlkResponseSchema.safeParse({ error: "invalid key" }).success).toBe(
      false,
    );
  });
});
