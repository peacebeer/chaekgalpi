import { z } from "zod";

import { formatChapterLines, type ChapterDraft } from "./chapters";

// 같은 ISBN에 저장된 목차 버전. 그룹을 만들 때 하나를 고르거나 바탕으로 고쳐 새 버전을 만든다.
export type TocVersion = {
  id: string;
  title: string;
  author: string;
  translator: string;
  publisher: string;
  pages: string;
  coverUrl: string;
  chaptersText: string;
  chapterCount: number;
  // 모든 장의 시작 쪽과 전체 쪽수가 있어 쪽수로 위치를 받을 수 있는지
  hasStartPages: boolean;
  groupCount: number;
  // 국립중앙도서관 목차를 그대로 쓴 버전인지
  fromLibrary: boolean;
};

// 처음에 보여 줄 버전 수. 나머지는 "더 보기"로 접어 둔다.
export const VERSIONS_SHOWN = 3;

const chaptersSchema = z.array(
  z.object({
    number: z.number(),
    title: z.string(),
    start_page: z.number().nullable(),
  }),
);

// rpc('toc_versions')가 돌려준 행(정렬된 상태)을 화면에서 쓰는 모양으로 바꾼다.
export type TocVersionRow = {
  book_id: string;
  title: string;
  author: string | null;
  translator: string | null;
  publisher: string | null;
  pages: number | null;
  cover_url: string | null;
  toc_source: string;
  chapter_count: number;
  has_start_pages: boolean;
  group_count: number;
  chapters: unknown;
};

export function toTocVersions(rows: TocVersionRow[]): TocVersion[] {
  return rows.flatMap((row) => {
    const chapters = chaptersSchema.safeParse(row.chapters);
    if (!chapters.success || chapters.data.length === 0) return [];
    return [
      {
        id: row.book_id,
        title: row.title,
        author: row.author ?? "",
        translator: row.translator ?? "",
        publisher: row.publisher ?? "",
        pages: row.pages ? String(row.pages) : "",
        coverUrl: row.cover_url ?? "",
        chaptersText: formatChapterLines(
          chapters.data.map((chapter) => ({
            title: chapter.title,
            startPage: chapter.start_page,
          })),
        ),
        chapterCount: row.chapter_count,
        hasStartPages: row.has_start_pages,
        groupCount: row.group_count,
        fromLibrary: row.toc_source === "nlk",
      },
    ];
  });
}

// 새로 저장하려는 목차가 이미 있는 버전과 같은지(장 제목·시작 쪽·전체 쪽수가 모두 같으면 같은 버전)
export function sameToc(
  version: Pick<TocVersion, "pages" | "chaptersText">,
  candidate: {
    pages: number | null;
    chapters: Pick<ChapterDraft, "title" | "startPage">[];
  },
): boolean {
  return (
    version.pages === (candidate.pages ? String(candidate.pages) : "") &&
    version.chaptersText === formatChapterLines(candidate.chapters)
  );
}

// 버전 한 줄 요약: "도서관 제공 · 7개 장 · 시작 쪽 있음 · 그룹 5개 사용"
export function versionSummary(version: TocVersion): string {
  return [
    version.fromLibrary ? "도서관 제공" : "회원 입력",
    `${version.chapterCount}개 장`,
    version.hasStartPages ? "시작 쪽 있음" : "시작 쪽 없음",
    version.groupCount > 0
      ? `그룹 ${version.groupCount}개 사용`
      : "아직 쓰는 그룹 없음",
  ].join(" · ");
}
