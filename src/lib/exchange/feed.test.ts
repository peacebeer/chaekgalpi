import { describe, expect, test } from "vitest";

import {
  buildFeed,
  kindLabel,
  lockedLabel,
  type NoteRow,
  type QuoteRow,
} from "./feed";

const quote = (over: Partial<QuoteRow> & { id: string }): QuoteRow => ({
  chapter: 1,
  pct: 10,
  text: "인용문",
  createdBy: "u1",
  locked: false,
  createdAt: "2026-10-13T00:00:00Z",
  ...over,
});

const note = (over: Partial<NoteRow> & { id: string }): NoteRow => ({
  chapter: 1,
  pct: 10,
  kind: "impression",
  body: "감상",
  quoteId: null,
  parentId: null,
  authorId: "u1",
  hidden: false,
  createdAt: "2026-10-13T00:00:00Z",
  likedBy: [],
  ...over,
});

describe("buildFeed", () => {
  test("장 순서, 그 안에서는 위치 순서로 묶는다", () => {
    const feed = buildFeed(
      [
        quote({ id: "q2", chapter: 2, pct: 5 }),
        quote({ id: "q1", chapter: 1, pct: 80 }),
      ],
      [note({ id: "n1", chapter: 1, pct: 20, kind: "question" })],
    );

    expect(feed.map((section) => section.chapter)).toEqual([1, 2]);
    expect(feed[0].threads.map((thread) => thread.id)).toEqual(["n1", "q1"]);
    expect(feed[1].threads.map((thread) => thread.id)).toEqual(["q2"]);
  });

  test("카드에 단 감상은 카드 안에, 답글은 감상 안에 시간순으로 넣는다", () => {
    const feed = buildFeed(
      [quote({ id: "q1" })],
      [
        note({ id: "n2", quoteId: "q1", createdAt: "2026-10-13T02:00:00Z" }),
        note({ id: "n1", quoteId: "q1", createdAt: "2026-10-13T01:00:00Z" }),
        note({
          id: "r2",
          quoteId: "q1",
          parentId: "n1",
          createdAt: "2026-10-13T04:00:00Z",
        }),
        note({
          id: "r1",
          quoteId: "q1",
          parentId: "n1",
          createdAt: "2026-10-13T03:00:00Z",
        }),
      ],
    );

    expect(feed).toHaveLength(1);
    const [thread] = feed[0].threads;
    expect(thread.type).toBe("quote");
    if (thread.type !== "quote") return;
    expect(thread.notes.map((item) => item.id)).toEqual(["n1", "n2"]);
    expect(thread.notes[0].replies.map((item) => item.id)).toEqual([
      "r1",
      "r2",
    ]);
  });

  test("인용 없이 쓴 메모는 따로 묶고 답글을 붙인다", () => {
    const feed = buildFeed(
      [],
      [
        note({ id: "n1", kind: "memo", likedBy: ["u2"] }),
        note({ id: "r1", parentId: "n1" }),
      ],
    );
    const [thread] = feed[0].threads;
    expect(thread.type).toBe("note");
    if (thread.type !== "note") return;
    expect(thread.note.likedBy).toEqual(["u2"]);
    expect(thread.note.replies.map((item) => item.id)).toEqual(["r1"]);
  });

  test("위치가 없는 글은 책 전체 묶음으로 맨 뒤에 둔다", () => {
    const feed = buildFeed(
      [quote({ id: "q1", chapter: 3 })],
      [note({ id: "n1", chapter: null, pct: null, kind: "summary" })],
    );
    expect(feed.map((section) => section.chapter)).toEqual([3, null]);
  });

  test("카드가 보이지 않으면 그 카드의 감상도 내보내지 않는다", () => {
    expect(buildFeed([], [note({ id: "n1", quoteId: "q-hidden" })])).toEqual(
      [],
    );
  });
});

describe("문구", () => {
  test("종류를 한국어로 바꾼다", () => {
    expect(kindLabel("question")).toBe("질문");
    expect(kindLabel("unknown")).toBe("감상");
  });

  test("잠긴 개수는 있는 것만 적는다", () => {
    expect(lockedLabel({ quotes: 2, notes: 3 })).toBe(
      "인용 카드 2개, 감상 3개",
    );
    expect(lockedLabel({ quotes: 0, notes: 1 })).toBe("감상 1개");
  });
});
