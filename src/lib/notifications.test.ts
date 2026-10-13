import { describe, expect, test } from "vitest";

import { countUnseen, mergeNotifications, snippet } from "./notifications";

const G = "7b0b7a52-3d5e-4c1b-9a51-0d6f3e2a1c11";

const reply = (over: Record<string, unknown>) => ({
  id: "r1",
  body: "답글 내용",
  created_at: "2026-10-13T03:00:00Z",
  author_id: "other",
  group_id: G,
  parent_id: null,
  quote_id: null,
  ...over,
});

describe("mergeNotifications", () => {
  const merged = mergeNotifications({
    myNotes: [{ id: "n1", body: "내가 쓴 감상", group_id: G }],
    myQuotes: [{ id: "q1", text: "내가 옮긴 문장", group_id: G }],
    replies: [reply({ id: "r1", parent_id: "n1" })],
    quoteNotes: [
      reply({
        id: "n9",
        quote_id: "q1",
        body: "카드에 단 감상",
        created_at: "2026-10-13T05:00:00Z",
      }),
    ],
    likes: [
      { note_id: "n1", user_id: "other", created_at: "2026-10-13T04:00:00Z" },
    ],
    limit: 30,
  });

  test("세 종류를 최신순으로 합친다", () => {
    expect(merged.map((item) => item.kind)).toEqual([
      "quote_note",
      "like",
      "reply",
    ]);
  });

  test("누르면 그룹 화면의 해당 글로 간다", () => {
    expect(merged[0].href).toBe(`/groups/${G}#note-n9`);
    expect(merged[1].href).toBe(`/groups/${G}#note-n1`);
    expect(merged[2].href).toBe(`/groups/${G}#note-r1`);
  });

  test("내 글과 상대 글의 앞부분을 담는다", () => {
    expect(merged[0]).toMatchObject({
      target: "내가 옮긴 문장",
      excerpt: "카드에 단 감상",
    });
    expect(merged[1]).toMatchObject({ target: "내가 쓴 감상", excerpt: null });
  });

  test("내 글이 아닌 것에 대한 소식은 버리고 개수를 제한한다", () => {
    const result = mergeNotifications({
      myNotes: [{ id: "n1", body: "글", group_id: G }],
      myQuotes: [],
      replies: [
        reply({ id: "r1", parent_id: "n1" }),
        reply({ id: "r2", parent_id: "someone-else" }),
        reply({
          id: "r3",
          parent_id: "n1",
          created_at: "2026-10-13T09:00:00Z",
        }),
      ],
      quoteNotes: [],
      likes: [],
      limit: 1,
    });
    expect(result.map((item) => item.id)).toEqual(["reply-r3"]);
  });
});

describe("countUnseen", () => {
  const items = mergeNotifications({
    myNotes: [{ id: "n1", body: "글", group_id: G }],
    myQuotes: [],
    replies: [
      reply({ id: "r1", parent_id: "n1", created_at: "2026-10-13T01:00:00Z" }),
      reply({ id: "r2", parent_id: "n1", created_at: "2026-10-13T03:00:00Z" }),
    ],
    quoteNotes: [],
    likes: [],
    limit: 30,
  });

  test("마지막 확인 뒤에 온 것만 센다", () => {
    expect(countUnseen(items, "2026-10-13T02:00:00.000Z")).toBe(1);
    expect(countUnseen(items, "2026-10-13T04:00:00.000Z")).toBe(0);
  });

  test("확인한 적이 없거나 값이 이상하면 모두 새 소식이다", () => {
    expect(countUnseen(items, null)).toBe(2);
    expect(countUnseen(items, "not-a-date")).toBe(2);
  });
});

describe("snippet", () => {
  test("줄바꿈을 펴고 길면 줄인다", () => {
    expect(snippet("첫 줄\n둘째 줄")).toBe("첫 줄 둘째 줄");
    expect(snippet("가".repeat(80))).toBe(`${"가".repeat(60)}…`);
  });
});
