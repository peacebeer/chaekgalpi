import { describe, expect, test } from "vitest";

import {
  buildDiscussion,
  clampRange,
  defaultRange,
  readThrough,
  type DiscussionMember,
} from "./discussion";
import type { NoteRow, QuoteRow } from "./feed";

const A = "a0000000-0000-0000-0000-000000000001";
const B = "b0000000-0000-0000-0000-000000000002";

function note(id: string, fields: Partial<NoteRow>): NoteRow {
  return {
    id,
    chapter: 1,
    pct: 10,
    kind: "impression",
    body: id,
    quoteId: null,
    parentId: null,
    authorId: A,
    hidden: false,
    createdAt: "2026-10-01T00:00:00Z",
    likedBy: [],
    ...fields,
  };
}

function quote(id: string, fields: Partial<QuoteRow>): QuoteRow {
  return {
    id,
    chapter: 1,
    pct: 20,
    text: id,
    createdBy: A,
    locked: false,
    createdAt: "2026-10-01T00:00:00Z",
    ...fields,
  };
}

const members: DiscussionMember[] = [
  { id: A, nickname: "서연", chapter: 4, pct: 100, finished: true },
  { id: B, nickname: "도윤", chapter: 2, pct: 30, finished: false },
];

describe("범위", () => {
  test("목차 안으로 맞추고, 거꾸로 고르면 바꾼다", () => {
    expect(clampRange(0, 9, 4)).toEqual({ from: 1, to: 4 });
    expect(clampRange(3, 2, 4)).toEqual({ from: 2, to: 3 });
    expect(clampRange(1.5, 2, 4)).toEqual({ from: 1, to: 2 });
  });

  test("처음에는 1장부터 내가 읽는 장까지, 완독했으면 끝까지", () => {
    expect(defaultRange({ chapter: 2, finished: false }, 4)).toEqual({
      from: 1,
      to: 2,
    });
    expect(defaultRange({ chapter: 1, finished: true }, 4)).toEqual({
      from: 1,
      to: 4,
    });
  });

  test("범위 끝 장을 다 읽었거나 지나간 회원만 끝까지 읽은 것으로 본다", () => {
    expect(readThrough(members[1], 1)).toBe(true);
    expect(readThrough(members[1], 2)).toBe(false);
    expect(readThrough({ ...members[1], pct: 100 }, 2)).toBe(true);
    expect(readThrough(members[0], 4)).toBe(true);
  });
});

describe("buildDiscussion", () => {
  const notes = [
    note("q-open", { kind: "question", chapter: 2, pct: 5, authorId: B }),
    note("q-answered", { kind: "question", chapter: 1, pct: 50 }),
    note("reply", { parentId: "q-answered", authorId: B, chapter: 1, pct: 50 }),
    note("liked", { likedBy: [A, B], chapter: 1, pct: 30 }),
    note("liked-less", { likedBy: [B], chapter: 2, pct: 1 }),
    note("hidden", { hidden: true, likedBy: [A, B, "x"] }),
    note("on-card", { quoteId: "card", chapter: 1, pct: 20 }),
    note("on-card-2", { quoteId: "card", chapter: 1, pct: 20, authorId: B }),
    note("far", { chapter: 4, pct: 10, kind: "question" }),
    note("whole", { chapter: null, pct: null, kind: "summary" }),
  ];
  const quotes = [
    quote("card", { chapter: 1, pct: 20 }),
    quote("quiet", { chapter: 2, pct: 50 }),
  ];
  const result = buildDiscussion({
    quotes,
    notes,
    members,
    chapterCount: 4,
    from: 1,
    to: 2,
  });

  test("답글 없는 질문만, 위치 순으로 모은다", () => {
    expect(result.openQuestions.map((item) => item.id)).toEqual(["q-open"]);
  });

  test("좋아요 많은 순으로 감상을 고르고, 숨긴 글과 범위 밖 글은 뺀다", () => {
    expect(result.likedNotes.map((item) => [item.id, item.likes])).toEqual([
      ["liked", 2],
      ["liked-less", 1],
    ]);
  });

  test("감상이 달린 인용 카드를 이야기가 많은 순으로 고른다", () => {
    expect(result.busyQuotes.map((item) => [item.id, item.talk])).toEqual([
      ["card", 2],
    ]);
  });

  test("장별로 카드와 글 수를 센다", () => {
    expect(result.chapters).toEqual([
      { chapter: 1, quotes: 1, notes: 5 },
      { chapter: 2, quotes: 1, notes: 2 },
    ]);
  });

  test("회원별 글 수와 범위를 끝까지 읽었는지 알려 준다", () => {
    expect(
      result.participation.map((item) => [
        item.member.nickname,
        item.posts,
        item.readThrough,
      ]),
    ).toEqual([
      ["서연", 4, true],
      // 도윤은 2장 30%라 2장까지의 범위를 아직 다 읽지 않았다.
      ["도윤", 3, false],
    ]);
  });

  test("책 전체 글은 범위가 마지막 장까지 닿을 때만 넣는다", () => {
    const whole = buildDiscussion({
      quotes,
      notes: [note("whole", { chapter: null, pct: null, likedBy: [B] })],
      members,
      chapterCount: 4,
      from: 3,
      to: 4,
    });
    expect(whole.likedNotes.map((item) => item.id)).toEqual(["whole"]);
    expect(result.likedNotes.map((item) => item.id)).not.toContain("whole");
  });
});
