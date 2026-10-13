export type ChapterDraft = {
  number: number;
  title: string;
  startPage: number | null;
};

const HEADING_LINE = /^(차례|목차|contents?)$/i;

// 쪽수 표기: 130, 130p, 130쪽, p.130 …
const PAGE = String.raw`(?:p\.?\s*)?(\d{1,5})\s*(?:pp?\.?|쪽|페이지)?`;

// 1) 제목과 쪽수 사이에 구분이 있는 줄: "|", 탭, 점선(.. ·· …), 공백 2칸 이상
const SEPARATED_PAGE = new RegExp(
  String.raw`^(.+?)(?:\s*\|\s*|\t+\s*|\s*[.·…]{2,}\s*|\s{2,})${PAGE}$`,
  "i",
);
// 2) 공백 한 칸이지만 쪽수 단위가 붙은 줄: "어린 새 130p", "어린 새 130쪽", "어린 새 p.130"
const UNIT_PAGE =
  /^(.+?)\s+(?:p\.?\s*(\d{1,5})|(\d{1,5})\s*(?:pp?\.?|쪽|페이지))$/i;
// 3) 공백 한 칸 뒤에 숫자만 있는 줄: "어린 새 130". 제목의 일부("챕터 1")일 수 있어 따로 판단한다.
const BARE_NUMBER = /^(.+?)\s(\d{1,5})$/;

type ParsedLine = {
  line: string;
  title: string;
  page: number | null;
  // 3)에 해당할 때의 후보
  bare: { title: string; page: number } | null;
};

function parseLine(line: string): ParsedLine {
  const separated = SEPARATED_PAGE.exec(line);
  if (separated) {
    return {
      line,
      title: separated[1].trim(),
      page: Number(separated[2]),
      bare: null,
    };
  }
  const unit = UNIT_PAGE.exec(line);
  if (unit) {
    return {
      line,
      title: unit[1].trim(),
      page: Number(unit[2] ?? unit[3]),
      bare: null,
    };
  }
  const bare = BARE_NUMBER.exec(line);
  return {
    line,
    title: line,
    page: null,
    bare: bare ? { title: bare[1].trim(), page: Number(bare[2]) } : null,
  };
}

// 쪽수가 붙은 줄이 이 비율 이상이면 목차 전체를 "쪽수가 있는 목차"로 본다.
// 부 제목이나 프롤로그처럼 쪽수 없이 적힌 줄이 섞이는 실제 목차를 받기 위해서다.
const PAGED_SHARE = 0.6;

// 숫자만 붙은 줄들을 쪽수로 볼지 정한다. 쪽수라면 대부분의 줄에 있고 뒤로 갈수록 커진다.
// 1, 2, 3처럼 1씩 늘어나면 "챕터 1, 챕터 2" 같은 장 번호로 보고 제목에 남긴다.
// "|"를 쓴 줄이 하나라도 있으면 형식을 알고 쓴 것이므로 추측하지 않는다.
function bareNumbersArePages(lines: ParsedLine[]): boolean {
  const bareLines = lines.filter((item) => item.bare);
  if (bareLines.length < 2) return false;
  if (lines.some((item) => item.line.includes("|"))) return false;

  const paged = lines.filter((item) => item.page !== null || item.bare);
  if (paged.length < lines.length * PAGED_SHARE) return false;

  const pages = paged.map((item) => item.page ?? item.bare!.page);
  const increasing = pages.every(
    (page, index) => index === 0 || page >= pages[index - 1],
  );
  const barePages = bareLines.map((item) => item.bare!.page);
  const countingUp = barePages.every(
    (page, index) => index === 0 || page === barePages[index - 1] + 1,
  );
  return increasing && !countingUp;
}

// 한 줄에 한 장씩 적은 목차를 장 목록으로 바꾼다. 장 번호는 위에서부터 1, 2, 3…
// 국립중앙도서관 목차 파일("1장 나  7")과 사람이 붙여 넣은 여러 형식을 함께 받는다.
// 화면은 이 결과를 미리 보여 줘서 잘못 읽힌 줄을 고칠 수 있게 한다.
export function parseChapterLines(text: string): ChapterDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !HEADING_LINE.test(line))
    .map(parseLine);
  const useBare = bareNumbersArePages(lines);

  return lines.map((item, index) => {
    const picked =
      item.page === null && item.bare && useBare ? item.bare : item;
    return {
      number: index + 1,
      title: picked.title,
      startPage: picked.page && picked.page > 0 ? picked.page : null,
    };
  });
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

export const WHOLE_BOOK_TITLE = "책 전체";

// 목차 없이 만든 책: 책 전체를 한 장으로 두고 "책 전체의 몇 %"로 위치를 나눈다.
// 전체 쪽수를 알면 1쪽부터 시작한다고 두어, 쪽수 입력을 %로 바꿀 수 있게 한다.
export function wholeBookChapters(pages: number | null): ChapterDraft[] {
  return [{ number: 1, title: WHOLE_BOOK_TITLE, startPage: pages ? 1 : null }];
}

export function isWholeBook(chapters: Pick<ChapterDraft, "title">[]): boolean {
  return chapters.length === 1 && chapters[0].title === WHOLE_BOOK_TITLE;
}
