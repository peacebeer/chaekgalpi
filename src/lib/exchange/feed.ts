import type { NoteKind } from "@/lib/validation/note";

// DB에서 읽은 행(RLS를 통과해 내가 볼 수 있는 것만 들어 있다)
export type QuoteRow = {
  id: string;
  chapter: number;
  pct: number;
  text: string;
  createdBy: string | null;
  // 다른 회원의 감상이 달려 잠긴 카드(등록자는 오타 수정만 가능)
  locked: boolean;
  createdAt: string;
};

export type NoteRow = {
  id: string;
  chapter: number | null;
  pct: number | null;
  kind: string;
  body: string;
  quoteId: string | null;
  parentId: string | null;
  authorId: string | null;
  hidden: boolean;
  createdAt: string;
  // 좋아요를 누른 회원 id
  likedBy: string[];
};

export type FeedNote = Omit<
  NoteRow,
  "quoteId" | "parentId" | "chapter" | "pct"
> & {
  replies: FeedNote[];
};

export type FeedThread =
  | {
      type: "quote";
      id: string;
      pct: number;
      text: string;
      createdBy: string | null;
      locked: boolean;
      createdAt: string;
      // 카드에 달린 감상(답글은 각 감상 안에)
      notes: FeedNote[];
    }
  | {
      type: "note";
      id: string;
      pct: number;
      createdAt: string;
      note: FeedNote;
    };

export type FeedSection = {
  // null = 책 전체(완독자에게만 보이는 글)
  chapter: number | null;
  threads: FeedThread[];
};

const byTime = (a: { createdAt: string }, b: { createdAt: string }) =>
  a.createdAt.localeCompare(b.createdAt);

// 인용 카드와 감상을 "장 → 위치순 묶음"으로 정리한다.
// 묶음 하나는 인용 카드(+감상들) 또는 인용 없이 쓴 메모·질문(+답글)이다.
export function buildFeed(quotes: QuoteRow[], notes: NoteRow[]): FeedSection[] {
  const repliesOf = new Map<string, FeedNote[]>();
  const toFeedNote = (row: NoteRow): FeedNote => ({
    id: row.id,
    kind: row.kind,
    body: row.body,
    authorId: row.authorId,
    hidden: row.hidden,
    createdAt: row.createdAt,
    likedBy: row.likedBy,
    replies: [],
  });

  for (const row of notes) {
    if (!row.parentId) continue;
    const list = repliesOf.get(row.parentId) ?? [];
    list.push(toFeedNote(row));
    repliesOf.set(row.parentId, list);
  }

  const topLevel = notes
    .filter((row) => !row.parentId)
    .map((row) => ({
      row,
      note: {
        ...toFeedNote(row),
        replies: (repliesOf.get(row.id) ?? []).sort(byTime),
      },
    }));

  const sections = new Map<number | null, FeedThread[]>();
  const push = (chapter: number | null, thread: FeedThread) => {
    const list = sections.get(chapter) ?? [];
    list.push(thread);
    sections.set(chapter, list);
  };

  for (const quote of quotes) {
    push(quote.chapter, {
      type: "quote",
      id: quote.id,
      pct: quote.pct,
      text: quote.text,
      createdBy: quote.createdBy,
      locked: quote.locked,
      createdAt: quote.createdAt,
      notes: topLevel
        .filter(({ row }) => row.quoteId === quote.id)
        .map(({ note }) => note)
        .sort(byTime),
    });
  }

  for (const { row, note } of topLevel) {
    // 카드에 단 감상은 위에서 카드 안에 넣었다. 카드가 안 보이면 감상도 내보내지 않는다.
    if (row.quoteId) continue;
    push(row.chapter, {
      type: "note",
      id: row.id,
      pct: row.pct ?? 0,
      createdAt: row.createdAt,
      note,
    });
  }

  return [...sections.entries()]
    .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
    .map(([chapter, threads]) => ({
      chapter,
      threads: threads.sort((a, b) => a.pct - b.pct || byTime(a, b)),
    }));
}

export const KIND_LABELS: Record<NoteKind, string> = {
  impression: "감상",
  memo: "메모",
  question: "질문",
  summary: "정리",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind as NoteKind] ?? KIND_LABELS.impression;
}

export type LockedCount = {
  chapter: number | null;
  quotes: number;
  notes: number;
};

// "카드 2개, 감상 3개"처럼 잠긴 개수를 문구로 만든다. 본문은 서버에서도 받지 않는다.
export function lockedLabel({ quotes, notes }: Omit<LockedCount, "chapter">) {
  const parts = [
    quotes > 0 ? `인용 카드 ${quotes}개` : "",
    notes > 0 ? `감상 ${notes}개` : "",
  ].filter(Boolean);
  return parts.join(", ");
}
