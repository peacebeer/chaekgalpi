import type { NoteRow, QuoteRow } from "./feed";

// 토론 준비: 고른 장 범위에서 이야기할 거리를 모은다.
// 입력은 RLS를 통과한(요청한 회원이 볼 수 있는) 행뿐이라, 아직 안 읽은 곳의 글은 처음부터 빠져 있다.
// AI 없이 개수와 반응만으로 계산한다(나중에 AI 정리를 붙일 때도 이 결과를 재료로 쓴다).

export type DiscussionMember = {
  id: string;
  nickname: string;
  chapter: number;
  pct: number;
  finished: boolean;
};

export type DiscussionInput = {
  quotes: QuoteRow[];
  notes: NoteRow[];
  members: DiscussionMember[];
  chapterCount: number;
  from: number;
  to: number;
};

export type DiscussionNote = {
  id: string;
  chapter: number | null;
  pct: number | null;
  body: string;
  authorId: string | null;
  likes: number;
  replies: number;
  // 인용 카드에 단 감상이면 그 카드 id
  quoteId: string | null;
};

export type DiscussionQuote = {
  id: string;
  chapter: number;
  pct: number;
  text: string;
  createdBy: string | null;
  // 카드에 달린 감상과 그 답글 수
  talk: number;
};

export type ChapterActivity = {
  chapter: number;
  quotes: number;
  notes: number;
};

export type Participation = {
  member: DiscussionMember;
  // 범위 안에 쓴 감상·메모·질문·답글 수
  posts: number;
  // 범위 끝까지 읽었는지(토론에서 스포일러를 조심할 회원을 알려 주려고)
  readThrough: boolean;
};

export type Discussion = {
  // 답글이 아직 없는 질문(위치 순)
  openQuestions: DiscussionNote[];
  // 좋아요를 많이 받은 감상
  likedNotes: DiscussionNote[];
  // 감상이 많이 달린 인용 카드
  busyQuotes: DiscussionQuote[];
  chapters: ChapterActivity[];
  participation: Participation[];
};

export const TOP_COUNT = 5;

// 장 범위를 목차 안으로 맞춘다. 거꾸로 고르면 바꿔 준다.
export function clampRange(
  from: number,
  to: number,
  chapterCount: number,
): { from: number; to: number } {
  const fit = (value: number) =>
    Math.min(Math.max(Number.isInteger(value) ? value : 1, 1), chapterCount);
  const a = fit(from);
  const b = fit(to);
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

// 처음 열었을 때의 범위: 1장부터 내가 읽고 있는 장까지
export function defaultRange(
  progress: { chapter: number; finished: boolean },
  chapterCount: number,
): { from: number; to: number } {
  return clampRange(
    1,
    progress.finished ? chapterCount : progress.chapter,
    chapterCount,
  );
}

const byPosition = (
  a: { chapter: number | null; pct: number | null },
  b: { chapter: number | null; pct: number | null },
) =>
  (a.chapter ?? Infinity) - (b.chapter ?? Infinity) ||
  (a.pct ?? 0) - (b.pct ?? 0);

export function readThrough(member: DiscussionMember, to: number): boolean {
  return (
    member.finished ||
    member.chapter > to ||
    (member.chapter === to && member.pct >= 100)
  );
}

export function buildDiscussion({
  quotes,
  notes,
  members,
  chapterCount,
  from,
  to,
}: DiscussionInput): Discussion {
  const visible = notes.filter((note) => !note.hidden);
  // 책 전체 글(chapter 없음)은 범위가 마지막 장까지 닿을 때만 넣는다.
  const inRange = (chapter: number | null) =>
    chapter === null ? to === chapterCount : chapter >= from && chapter <= to;

  const repliesOf = new Map<string, number>();
  for (const note of visible) {
    if (note.parentId) {
      repliesOf.set(note.parentId, (repliesOf.get(note.parentId) ?? 0) + 1);
    }
  }

  const toNote = (note: NoteRow): DiscussionNote => ({
    id: note.id,
    chapter: note.chapter,
    pct: note.pct,
    body: note.body,
    authorId: note.authorId,
    likes: note.likedBy.length,
    replies: repliesOf.get(note.id) ?? 0,
    quoteId: note.quoteId,
  });

  const rangeNotes = visible.filter((note) => inRange(note.chapter));
  const topLevel = rangeNotes.filter((note) => !note.parentId).map(toNote);

  const openQuestions = rangeNotes
    .filter(
      (note) =>
        note.kind === "question" && !note.parentId && !repliesOf.get(note.id),
    )
    .map(toNote)
    .sort(byPosition);

  const likedNotes = topLevel
    .filter((note) => note.likes > 0)
    .sort(
      (a, b) => b.likes - a.likes || b.replies - a.replies || byPosition(a, b),
    )
    .slice(0, TOP_COUNT);

  const rangeQuotes = quotes.filter((quote) => inRange(quote.chapter));
  const talkOf = new Map<string, number>();
  for (const note of rangeNotes) {
    if (note.quoteId) {
      talkOf.set(note.quoteId, (talkOf.get(note.quoteId) ?? 0) + 1);
    }
  }
  const busyQuotes = rangeQuotes
    .map((quote) => ({
      id: quote.id,
      chapter: quote.chapter,
      pct: quote.pct,
      text: quote.text,
      createdBy: quote.createdBy,
      talk: talkOf.get(quote.id) ?? 0,
    }))
    .filter((quote) => quote.talk > 0)
    .sort((a, b) => b.talk - a.talk || byPosition(a, b))
    .slice(0, TOP_COUNT);

  const chapters: ChapterActivity[] = [];
  for (let chapter = from; chapter <= to; chapter += 1) {
    chapters.push({
      chapter,
      quotes: rangeQuotes.filter((quote) => quote.chapter === chapter).length,
      notes: rangeNotes.filter((note) => note.chapter === chapter).length,
    });
  }

  const participation = members
    .map((member) => ({
      member,
      posts: rangeNotes.filter((note) => note.authorId === member.id).length,
      readThrough: readThrough(member, to),
    }))
    .sort((a, b) => b.posts - a.posts);

  return { openQuestions, likedNotes, busyQuotes, chapters, participation };
}
