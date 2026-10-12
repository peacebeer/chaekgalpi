import { z } from "zod";

// 국립중앙도서관 ISBN 서지정보 API(seoji/SearchApi.do) 응답. 쓰는 항목만 검사한다.
const nlkDocSchema = z.object({
  TITLE: z.string(),
  AUTHOR: z.string().optional().default(""),
  PUBLISHER: z.string().optional().default(""),
  EA_ISBN: z.string().optional().default(""),
  PAGE: z.string().optional().default(""),
  BOOK_TB_CNT_URL: z.string().optional().default(""),
  PUBLISH_PREDATE: z.string().optional().default(""),
});

export const nlkResponseSchema = z.object({
  docs: z.array(nlkDocSchema),
});

type NlkDoc = z.infer<typeof nlkDocSchema>;

export type NlkBook = {
  isbn: string;
  title: string;
  author: string;
  translator: string;
  publisher: string;
  pages: number | null;
  year: string;
  // 목차 파일 주소. 2021년 2월 이후 책은 대부분 비어 있다.
  tocUrl: string | null;
};

const ISBN = /^[0-9X]{10}([0-9]{3})?$/;
const TRANSLATOR_ROLE = /옮김|옮긴이|역자|번역/;

function stripRole(name: string): string {
  return name
    .replace(/^(지은이|저자|글쓴이|옮긴이|역자|번역|글|저)\s*[:：]\s*/, "")
    .replace(/\s*(지음|옮김|엮음|번역|글|저|역)$/, "")
    .trim();
}

// "지은이: 한강" → 한강, "주리 데이 지음 ;윤재승 옮김" → 저자 주리 데이 / 역자 윤재승
export function splitAuthor(raw: string): {
  author: string;
  translator: string;
} {
  const authors: string[] = [];
  const translators: string[] = [];

  for (const part of raw.split(";")) {
    const text = part.trim();
    if (!text) continue;
    const name = stripRole(text);
    if (!name) continue;
    (TRANSLATOR_ROLE.test(text) ? translators : authors).push(name);
  }

  return { author: authors.join(", "), translator: translators.join(", ") };
}

// "103 p." → 103, "약 500 페이지 내외" → 500, "" → null
export function parsePages(raw: string): number | null {
  const match = /\d{1,5}/.exec(raw);
  const pages = match ? Number(match[0]) : 0;
  return pages > 0 ? pages : null;
}

// 목차 파일은 국립중앙도서관 서버의 것만 받는다(다른 주소로 요청을 보내지 않기 위해).
export function safeTocUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const trusted =
      url.protocol === "https:" &&
      url.hostname === "www.nl.go.kr" &&
      url.pathname.startsWith("/seoji/");
    return trusted ? url.toString() : null;
  } catch {
    return null;
  }
}

// ISBN이 없는 자료(세트, 일부 전자책)는 대표 도서로 쓸 수 없어 뺀다.
export function toNlkBooks(docs: NlkDoc[]): NlkBook[] {
  const books: NlkBook[] = [];
  const seen = new Set<string>();

  for (const doc of docs) {
    const isbn = doc.EA_ISBN.replace(/[\s-]/g, "").toUpperCase();
    const title = doc.TITLE.trim();
    if (!ISBN.test(isbn) || !title || seen.has(isbn)) continue;
    seen.add(isbn);

    books.push({
      isbn,
      title: title.slice(0, 200),
      ...splitAuthor(doc.AUTHOR),
      publisher: doc.PUBLISHER.trim(),
      pages: parsePages(doc.PAGE),
      year: doc.PUBLISH_PREDATE.slice(0, 4),
      tocUrl: safeTocUrl(doc.BOOK_TB_CNT_URL),
    });
  }

  return books;
}
