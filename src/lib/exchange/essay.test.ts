import { describe, expect, test } from "vitest";

import {
  buildEssayOutline,
  essayDraft,
  isEmptyOutline,
  objectParticle,
} from "./essay";
import type { NoteRow, QuoteRow } from "./feed";

const ME = "a0000000-0000-0000-0000-000000000001";
const OTHER = "b0000000-0000-0000-0000-000000000002";

function note(id: string, fields: Partial<NoteRow>): NoteRow {
  return {
    id,
    chapter: 1,
    pct: 10,
    kind: "impression",
    body: id,
    quoteId: null,
    parentId: null,
    authorId: ME,
    hidden: false,
    createdAt: "2026-10-01T00:00:00Z",
    likedBy: [],
    ...fields,
  };
}

const quote = (id: string, chapter: number, text: string): QuoteRow => ({
  id,
  chapter,
  pct: 20,
  text,
  createdBy: OTHER,
  locked: false,
  createdAt: "2026-10-01T00:00:00Z",
});

const quotes = [quote("q1", 1, "첫 문장"), quote("q2", 3, "셋째 장 문장")];
const notes = [
  note("first", { chapter: 1, pct: 5, kind: "memo", body: "첫인상" }),
  note("later", { chapter: 2, pct: 40, kind: "question", body: "왜 그랬을까" }),
  note("on-q2", {
    quoteId: "q2",
    chapter: 3,
    pct: 20,
    body: "슬펐다",
    likedBy: [OTHER],
  }),
  note("on-q1", { quoteId: "q1", chapter: 1, pct: 20, body: "좋았다" }),
  note("sum", {
    chapter: null,
    pct: null,
    kind: "summary",
    body: "다 읽고 나니",
  }),
  note("reply", { parentId: "later", body: "답글은 빠진다" }),
  note("hidden", { hidden: true, body: "숨긴 글" }),
  note("theirs", { authorId: OTHER, body: "남의 글" }),
];

describe("buildEssayOutline", () => {
  const outline = buildEssayOutline({ quotes, notes, userId: ME });

  test("가장 앞의 위치 글을 도입으로, 나머지를 생각의 변화로 둔다", () => {
    expect(outline.intro.map((item) => item.id)).toEqual(["first"]);
    expect(outline.journey.map((item) => item.id)).toEqual(["later"]);
  });

  test("인용 카드에 남긴 내 감상을 책 순서로 장면에 넣는다", () => {
    expect(outline.scenes.map((item) => [item.id, item.quote])).toEqual([
      ["on-q1", "첫 문장"],
      ["on-q2", "셋째 장 문장"],
    ]);
  });

  test("정리 글과 책 전체 글은 맺음으로, 답글·숨긴 글·남의 글은 뺀다", () => {
    expect(outline.closing.map((item) => item.id)).toEqual(["sum"]);
    const all = [
      ...outline.intro,
      ...outline.scenes,
      ...outline.journey,
      ...outline.closing,
    ].map((item) => item.id);
    expect(all).not.toContain("reply");
    expect(all).not.toContain("hidden");
    expect(all).not.toContain("theirs");
  });

  test("장면이 많으면 공감을 많이 받은 것부터 고른다", () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      note(`s${index}`, {
        quoteId: "q1",
        chapter: 1,
        pct: index,
        likedBy: index === 6 ? [OTHER] : [],
      }),
    );
    const picked = buildEssayOutline({ quotes, notes: many, userId: ME });
    expect(picked.scenes).toHaveLength(5);
    expect(picked.scenes.map((item) => item.id)).toContain("s6");
  });
});

describe("essayDraft", () => {
  const place = (position: { chapter: number | null }) =>
    position.chapter === null ? "책 전체" : `${position.chapter}장`;

  test("단락마다 내 글을 넣고 위치를 붙인다", () => {
    const outline = buildEssayOutline({ quotes, notes, userId: ME });
    const draft = essayDraft(
      outline,
      { title: "소년이 온다", author: "한강" },
      place,
    );
    expect(draft.split("\n")[0]).toBe("한강, 『소년이 온다』를 읽고");
    expect(draft).toContain("[도입]\n첫인상 (1장)");
    expect(draft).toContain("“첫 문장” (1장)\n→ 좋았다");
    expect(draft).toContain("[생각의 변화]\n2장: 왜 그랬을까");
    expect(draft).toContain("[맺음]\n다 읽고 나니");
  });

  test("비어 있는 단락에는 무엇을 쓰면 좋을지 안내한다", () => {
    const empty = buildEssayOutline({ quotes, notes: [], userId: ME });
    expect(isEmptyOutline(empty)).toBe(true);
    const draft = essayDraft(empty, { title: "흰", author: null }, place);
    expect(draft.split("\n")[0]).toBe("『흰』을 읽고");
    expect(draft).toContain("(이 책을 고른 이유나 첫인상을 적어 보세요)");
  });
});

describe("objectParticle", () => {
  test("받침에 따라 을/를을 고른다", () => {
    expect(objectParticle("소년이 온다")).toBe("를");
    expect(objectParticle("흰")).toBe("을");
    expect(objectParticle("Cosmos")).toBe("을(를)");
    expect(objectParticle("작은 서점의 사계절 (체험용)")).toBe("을");
    expect(objectParticle("소년이 온다(특별한정판)")).toBe("를");
  });
});
