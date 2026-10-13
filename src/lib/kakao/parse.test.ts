import { describe, expect, test } from "vitest";

import {
  kakaoResponseSchema,
  pickIsbn,
  safeCoverUrl,
  toKakaoBooks,
} from "./parse";

describe("pickIsbn", () => {
  test("13자리를 먼저 고르고, 없으면 10자리를 쓴다", () => {
    expect(pickIsbn("8936434128 9788936434120")).toBe("9788936434120");
    expect(pickIsbn("893643412X")).toBe("893643412X");
    expect(pickIsbn(" 9788936434120")).toBe("9788936434120");
    expect(pickIsbn("")).toBe(null);
    expect(pickIsbn("12345")).toBe(null);
  });
});

describe("safeCoverUrl", () => {
  test("카카오 이미지 서버의 https 주소만 받는다", () => {
    const url =
      "https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Fa.jpg";
    expect(safeCoverUrl(url)).toBe(url);
    expect(safeCoverUrl("http://search1.kakaocdn.net/a.jpg")).toBe(null);
    expect(safeCoverUrl("https://evil.example/a.jpg")).toBe(null);
    expect(safeCoverUrl("https://kakaocdn.net.evil.example/a.jpg")).toBe(null);
    expect(safeCoverUrl("")).toBe(null);
    expect(safeCoverUrl(null)).toBe(null);
  });
});

describe("toKakaoBooks", () => {
  const doc = {
    title: "소년이 온다",
    isbn: "8936434128 9788936434120",
    authors: ["한강"],
    translators: [],
    publisher: "창비",
    datetime: "2014-05-19T00:00:00.000+09:00",
    thumbnail: "https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=x",
    contents: "쓰지 않는 항목",
  };

  test("응답 한 건을 화면에서 쓰는 모양으로 바꾼다", () => {
    const { documents, meta } = kakaoResponseSchema.parse({
      meta: { total_count: 26, pageable_count: 26, is_end: false },
      documents: [doc],
    });
    expect(meta.is_end).toBe(false);
    expect(toKakaoBooks(documents)).toEqual([
      {
        isbn: "9788936434120",
        title: "소년이 온다",
        author: "한강",
        translator: "",
        publisher: "창비",
        year: "2014",
        coverUrl: doc.thumbnail,
      },
    ]);
  });

  test("저자·역자가 여럿이면 쉼표로 잇고, 표지가 없으면 null이다", () => {
    const { documents } = kakaoResponseSchema.parse({
      meta: { total_count: 1, pageable_count: 1, is_end: true },
      documents: [
        {
          ...doc,
          authors: ["가", "나"],
          translators: ["다"],
          thumbnail: "",
        },
      ],
    });
    expect(toKakaoBooks(documents)[0]).toMatchObject({
      author: "가, 나",
      translator: "다",
      coverUrl: null,
    });
  });

  test("ISBN이 없거나 겹치는 자료는 뺀다", () => {
    const { documents } = kakaoResponseSchema.parse({
      meta: { total_count: 3, pageable_count: 3, is_end: true },
      documents: [doc, { ...doc, title: "중복" }, { title: "ISBN 없음" }],
    });
    expect(toKakaoBooks(documents).map((book) => book.title)).toEqual([
      "소년이 온다",
    ]);
  });

  test("예상과 다른 응답은 거부한다", () => {
    expect(
      kakaoResponseSchema.safeParse({ errorType: "AccessDeniedError" }).success,
    ).toBe(false);
  });
});
