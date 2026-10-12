export type ChapterDraft = {
  number: number;
  title: string;
  startPage: number | null;
};

const HEADING_LINE = /^(차례|목차|contents?)$/i;

// 줄 끝의 시작 쪽. 제목과 쪽수 사이가 "|", 탭, 점선(.. ·· …), 공백 2칸 이상일 때만 쪽수로 본다.
// 공백 한 칸은 쪽수로 보지 않는다("1984 1" 같은 제목을 지키기 위해).
const TRAILING_PAGE =
  /^(.+?)(?:\s*\|\s*|\t+\s*|\s*[.·…]{2,}\s*|\s{2,})(\d{1,5})$/;

// 한 줄에 한 장씩 적은 목차를 장 목록으로 바꾼다. 장 번호는 위에서부터 1, 2, 3…
// 국립중앙도서관 목차 파일("1장 나  7")과 사람이 붙여 넣은 목차를 함께 받는다.
export function parseChapterLines(text: string): ChapterDraft[] {
  const chapters: ChapterDraft[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || HEADING_LINE.test(line)) continue;

    const match = TRAILING_PAGE.exec(line);
    const page = match ? Number(match[2]) : null;
    chapters.push({
      number: chapters.length + 1,
      title: (match ? match[1] : line).trim(),
      startPage: page && page > 0 ? page : null,
    });
  }

  return chapters;
}

export function formatChapterLines(
  chapters: Pick<ChapterDraft, "title" | "startPage">[],
): string {
  return chapters
    .map(({ title, startPage }) =>
      startPage ? `${title} | ${startPage}` : title,
    )
    .join("\n");
}
