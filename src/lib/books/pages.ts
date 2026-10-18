import type { Position } from "@/lib/validation/position";

// 쪽수와 (장, 장 안 %)를 서로 바꾸는 데 필요한 정보.
// 모든 장의 시작 쪽과 전체 쪽수를 알 때만 만든다(마지막 장이 어디서 끝나는지 알아야 해서).
export type PageMap = {
  // 장 순서대로의 [장 번호, 시작 쪽]
  starts: { chapter: number; start: number }[];
  pages: number;
};

export function buildPageMap(
  chapters: { number: number; start_page: number | null }[],
  pages: number | null,
): PageMap | null {
  if (!pages || chapters.length === 0) return null;
  const sorted = [...chapters].sort((a, b) => a.number - b.number);
  if (sorted.some((chapter) => !chapter.start_page)) return null;
  const starts = sorted.map((chapter) => ({
    chapter: chapter.number,
    start: chapter.start_page!,
  }));
  if (starts.some((item, i) => i > 0 && item.start < starts[i - 1].start)) {
    return null;
  }
  if (starts[starts.length - 1].start > pages) return null;
  return { starts, pages };
}

// 장 하나가 차지하는 쪽 범위 [시작, 다음 장 시작) — DB의 page_to_position과 같은 계산
function span(map: PageMap, index: number): { start: number; end: number } {
  const start = map.starts[index].start;
  const end = map.starts[index + 1]?.start ?? map.pages + 1;
  return { start, end };
}

export function pageToPosition(map: PageMap, page: number): Position | null {
  if (!Number.isInteger(page) || page < 1 || page > map.pages) return null;
  let index = -1;
  for (let i = 0; i < map.starts.length; i += 1) {
    if (map.starts[i].start <= page) index = i;
  }
  // 첫 장 시작 쪽보다 앞(머리말 등)은 첫 장의 처음으로 본다.
  if (index === -1) return { chapter: map.starts[0].chapter, pct: 0 };
  const { start, end } = span(map, index);
  const pct =
    end <= start
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(((100 * (page - start)) / (end - start)) * 100) / 100,
          ),
        );
  return { chapter: map.starts[index].chapter, pct };
}

// (장, %) 위치가 몇 쪽인지. 쪽으로 저장한 위치는 같은 쪽으로 돌아온다.
export function positionToPage(map: PageMap, position: Position): number {
  const index = map.starts.findIndex(
    (item) => item.chapter === position.chapter,
  );
  if (index === -1) return 1;
  const { start, end } = span(map, index);
  const page = start + Math.round((position.pct / 100) * (end - start));
  return Math.min(Math.max(page, 1), map.pages);
}

// 진도 안에서 고를 수 있는 가장 뒤 쪽
export function maxPageFor(
  map: PageMap,
  progress: Position & { finished: boolean },
): number {
  if (progress.finished) return map.pages;
  const index = map.starts.findIndex(
    (item) => item.chapter === progress.chapter,
  );
  if (index === -1) return map.pages;
  const { start, end } = span(map, index);
  // 이 쪽의 위치가 진도를 넘지 않도록 내림한다. 다음 장의 첫 쪽은 넘어간 것으로 본다.
  let page = Math.min(
    start + Math.floor((progress.pct / 100) * (end - start)),
    Math.max(start, end - 1),
  );
  while (page > start && pageToPosition(map, page)!.pct > progress.pct) {
    page -= 1;
  }
  return Math.min(page, map.pages);
}

// 글 위치 표시: 쪽수를 알면 "2장 · 77쪽"(목차 없는 책은 "77쪽"), 모르면 "2장 · 40%".
// chapter가 없으면 책 전체(완독자에게만 보이는 글)다.
export function placeLabel(
  position: { chapter: number | null; pct: number | null },
  wholeBook: boolean,
  pageMap: PageMap | null,
): string {
  if (position.chapter === null) return "책 전체";
  const at = { chapter: position.chapter, pct: position.pct ?? 0 };
  if (!pageMap) {
    const pct = `${Math.round(at.pct)}%`;
    return wholeBook ? pct : `${at.chapter}장 · ${pct}`;
  }
  const page = `${positionToPage(pageMap, at)}쪽`;
  return wholeBook ? page : `${at.chapter}장 · ${page}`;
}
