import type { NoteRow, QuoteRow } from "./feed";

// 감상문 도우미: 내가 남긴 인용과 감상을 감상문 뼈대(도입 → 인상 깊은 장면 → 생각의 변화 → 맺음)에 배치한다.
// 재료는 내 글뿐이라 스포일러 걱정이 없다. AI 없이 위치·종류·좋아요로만 고른다
// (나중에 AI 정리를 붙일 때도 이 결과를 재료로 쓴다).

type Position = { chapter: number | null; pct: number | null };

export type EssayItem = Position & {
  id: string;
  body: string;
  likes: number;
};

export type EssayScene = EssayItem & {
  quoteId: string;
  quote: string;
};

export type EssayOutline = {
  intro: EssayItem[];
  scenes: EssayScene[];
  journey: EssayItem[];
  closing: EssayItem[];
};

export const SCENE_COUNT = 5;
export const JOURNEY_COUNT = 6;

const byPosition = (a: Position, b: Position) =>
  (a.chapter ?? Infinity) - (b.chapter ?? Infinity) ||
  (a.pct ?? 0) - (b.pct ?? 0);

export function buildEssayOutline({
  quotes,
  notes,
  userId,
}: {
  quotes: QuoteRow[];
  notes: NoteRow[];
  userId: string;
}): EssayOutline {
  const quoteText = new Map(quotes.map((quote) => [quote.id, quote.text]));
  // 답글은 대화라 빼고, 내가 쓴 첫 글만 쓴다.
  const mine = notes
    .filter(
      (note) => note.authorId === userId && !note.hidden && !note.parentId,
    )
    .map((note) => ({
      id: note.id,
      chapter: note.chapter,
      pct: note.pct,
      body: note.body,
      likes: note.likedBy.length,
      kind: note.kind,
      quoteId: note.quoteId,
    }))
    .sort(byPosition);

  const toItem = ({
    id,
    chapter,
    pct,
    body,
    likes,
  }: (typeof mine)[number]) => ({
    id,
    chapter,
    pct,
    body,
    likes,
  });

  // 인상 깊은 장면: 인용 카드에 남긴 내 감상. 공감을 많이 받은 것부터 고르고 책 순서로 놓는다.
  const scenes = mine
    .filter((note) => note.quoteId && quoteText.has(note.quoteId))
    .sort((a, b) => b.likes - a.likes || byPosition(a, b))
    .slice(0, SCENE_COUNT)
    .sort(byPosition)
    .map((note) => ({
      ...toItem(note),
      quoteId: note.quoteId!,
      quote: quoteText.get(note.quoteId!)!,
    }));

  // 맺음: 정리 글과 책 전체에 대한 글
  const closing = mine
    .filter((note) => note.kind === "summary" || note.chapter === null)
    .map(toItem);

  // 인용 없이 남긴 위치 글(감상·메모·질문)
  const loose = mine.filter(
    (note) => !note.quoteId && note.kind !== "summary" && note.chapter !== null,
  );
  // 도입: 가장 앞에서 남긴 글 하나
  const intro = loose.slice(0, 1).map(toItem);
  // 생각의 변화: 나머지를 책 순서로
  const journey = loose.slice(1, 1 + JOURNEY_COUNT).map(toItem);

  return { intro, scenes, journey, closing };
}

export function isEmptyOutline(outline: EssayOutline): boolean {
  return (
    outline.intro.length +
      outline.scenes.length +
      outline.journey.length +
      outline.closing.length ===
    0
  );
}

// 목적격 조사: 받침이 있으면 "을", 없으면 "를". 한글로 끝나지 않으면 "을(를)"
// 끝에 붙은 괄호 표기("(체험용)", "(특별판)")는 건너뛰고 본 제목의 끝 글자로 고른다.
export function objectParticle(word: string): string {
  const base = word.trim().replace(/\s*[([][^()[\]]*[)\]]$/, "");
  const last = (base || word.trim()).at(-1) ?? "";
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "을(를)";
  return code % 28 === 0 ? "를" : "을";
}

// 뼈대를 고쳐 쓰기 좋은 글로 바꾼다. 비어 있는 단락에는 무엇을 쓰면 좋을지 안내를 넣는다.
export function essayDraft(
  outline: EssayOutline,
  book: { title: string; author: string | null },
  place: (position: Position) => string,
): string {
  // "한강, 『소년이 온다』를 읽고"
  const by = book.author ? `${book.author}, ` : "";
  const section = (title: string, lines: string[], empty: string) =>
    [`[${title}]`, ...(lines.length > 0 ? lines : [`(${empty})`])].join("\n");

  return [
    `${by}『${book.title}』${objectParticle(book.title)} 읽고`,
    section(
      "도입",
      outline.intro.map((item) => `${item.body} (${place(item)})`),
      "이 책을 고른 이유나 첫인상을 적어 보세요",
    ),
    section(
      "인상 깊은 장면",
      outline.scenes.map(
        (item) => `“${item.quote}” (${place(item)})\n→ ${item.body}`,
      ),
      "마음에 남은 문장을 인용 카드로 남기면 여기에 모여요",
    ),
    section(
      "생각의 변화",
      outline.journey.map((item) => `${place(item)}: ${item.body}`),
      "읽으면서 달라진 생각이나 질문을 적어 보세요",
    ),
    section(
      "맺음",
      outline.closing.map((item) => item.body),
      "다 읽고 난 뒤의 생각을 정리해 보세요. 완독 후 '책 전체' 글로 남기면 여기에 모여요",
    ),
  ].join("\n\n");
}
