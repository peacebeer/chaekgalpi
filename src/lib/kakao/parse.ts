import { z } from "zod";

// 카카오 책 검색 API(https://dapi.kakao.com/v3/search/book) 응답. 쓰는 항목만 검사한다.
const kakaoDocSchema = z.object({
  title: z.string(),
  // "ISBN10 ISBN13"처럼 공백으로 이어져 온다. 둘 중 하나만 있을 수도 있다.
  isbn: z.string().optional().default(""),
  authors: z.array(z.string()).optional().default([]),
  translators: z.array(z.string()).optional().default([]),
  publisher: z.string().optional().default(""),
  datetime: z.string().optional().default(""),
  thumbnail: z.string().optional().default(""),
});

export const kakaoResponseSchema = z.object({
  meta: z.object({
    total_count: z.number(),
    pageable_count: z.number(),
    is_end: z.boolean(),
  }),
  documents: z.array(kakaoDocSchema),
});

type KakaoDoc = z.infer<typeof kakaoDocSchema>;

export type KakaoBook = {
  isbn: string;
  title: string;
  author: string;
  translator: string;
  publisher: string;
  year: string;
  coverUrl: string | null;
};

const ISBN13 = /^[0-9]{13}$/;
const ISBN10 = /^[0-9X]{10}$/;

// 13자리를 먼저 고른다(판본을 가리는 표준이고, 도서관 API에서 목차를 찾을 때도 쓴다).
export function pickIsbn(raw: string): string | null {
  const parts = raw.toUpperCase().split(/\s+/).filter(Boolean);
  return (
    parts.find((part) => ISBN13.test(part)) ??
    parts.find((part) => ISBN10.test(part)) ??
    null
  );
}

// 표지는 카카오 이미지 서버의 https 주소만 받는다(다른 주소가 저장되지 않게).
export function safeCoverUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 500) return null;
  try {
    const url = new URL(raw);
    const trusted =
      url.protocol === "https:" &&
      (url.hostname === "kakaocdn.net" ||
        url.hostname.endsWith(".kakaocdn.net"));
    return trusted ? url.toString() : null;
  } catch {
    return null;
  }
}

// ISBN이 없는 자료는 대표 도서로 쓸 수 없어 뺀다.
export function toKakaoBooks(docs: KakaoDoc[]): KakaoBook[] {
  const books: KakaoBook[] = [];
  const seen = new Set<string>();

  for (const doc of docs) {
    const isbn = pickIsbn(doc.isbn);
    const title = doc.title.trim();
    if (!isbn || !title || seen.has(isbn)) continue;
    seen.add(isbn);

    books.push({
      isbn,
      title: title.slice(0, 200),
      author: doc.authors.join(", ").slice(0, 200),
      translator: doc.translators.join(", ").slice(0, 200),
      publisher: doc.publisher.trim().slice(0, 100),
      year: doc.datetime.slice(0, 4),
      coverUrl: safeCoverUrl(doc.thumbnail),
    });
  }

  return books;
}
