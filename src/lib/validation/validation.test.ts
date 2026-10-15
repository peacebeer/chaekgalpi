import { describe, expect, test } from "vitest";

import { bookSchema, isbnSchema } from "./book";
import { charLength } from "./common";
import { groupSchema, inviteCodeSchema, joinGroupSchema } from "./group";
import { LIMITS } from "./limits";
import { positionNoteSchema, quoteNoteSchema, replySchema } from "./note";
import {
  comparePosition,
  isWithinProgress,
  pageSchema,
  positionSchema,
  progressSchema,
} from "./position";
import { profileSchema } from "./profile";
import {
  createQuoteSchema,
  exceedsQuoteLimit,
  remainingQuoteChars,
} from "./quote";

const GROUP_ID = "7b0b7a52-3d5e-4c1b-9a51-0d6f3e2a1c11";
const OTHER_ID = "c1f6a8de-52a4-4f0e-8d1c-9b7e5a3f2d10";

describe("LIMITS", () => {
  test("DB 제약과 같은 숫자다", () => {
    expect(LIMITS).toMatchObject({
      nicknameMax: 30,
      groupNameMax: 50,
      capacityMin: 3,
      capacityMax: 8,
      quoteTextMax: 300,
      groupQuoteLimit: 10_000,
      noteBodyMax: 2000,
    });
  });
});

describe("charLength", () => {
  test("Postgres char_length처럼 이모지를 한 글자로 센다", () => {
    expect(charLength("책갈피")).toBe(3);
    expect(charLength("😀")).toBe(1);
  });
});

describe("위치", () => {
  test("pct를 소수 둘째 자리로 맞춘다", () => {
    expect(positionSchema.parse({ chapter: 2, pct: 33.336 })).toEqual({
      chapter: 2,
      pct: 33.34,
    });
  });

  test("범위를 벗어난 장·pct를 거부한다", () => {
    expect(positionSchema.safeParse({ chapter: 0, pct: 0 }).success).toBe(
      false,
    );
    expect(positionSchema.safeParse({ chapter: 1.5, pct: 0 }).success).toBe(
      false,
    );
    expect(positionSchema.safeParse({ chapter: 1, pct: -0.01 }).success).toBe(
      false,
    );
    expect(positionSchema.safeParse({ chapter: 1, pct: 100.01 }).success).toBe(
      false,
    );
  });

  test("장을 먼저, 같은 장이면 pct를 비교한다", () => {
    expect(
      comparePosition({ chapter: 1, pct: 90 }, { chapter: 2, pct: 0 }),
    ).toBeLessThan(0);
    expect(
      comparePosition({ chapter: 2, pct: 40 }, { chapter: 2, pct: 40 }),
    ).toBe(0);
    expect(
      comparePosition({ chapter: 2, pct: 41 }, { chapter: 2, pct: 40 }),
    ).toBeGreaterThan(0);
  });

  test("1장 20%까지 읽은 회원에게 2장은 진도 밖이고, 완독자에게는 모두 진도 안이다", () => {
    const progress = { chapter: 1, pct: 20 };
    expect(isWithinProgress({ chapter: 1, pct: 20 }, progress)).toBe(true);
    expect(isWithinProgress({ chapter: 1, pct: 20.01 }, progress)).toBe(false);
    expect(isWithinProgress({ chapter: 2, pct: 0 }, progress)).toBe(false);
    expect(isWithinProgress({ chapter: 2, pct: 0 }, progress, true)).toBe(true);
  });

  test("진도는 finished 기본값이 false다", () => {
    expect(progressSchema.parse({ chapter: 3, pct: 40 })).toEqual({
      chapter: 3,
      pct: 40,
      finished: false,
    });
  });

  test("쪽수는 1 이상의 정수다", () => {
    expect(pageSchema.safeParse(143).success).toBe(true);
    expect(pageSchema.safeParse(0).success).toBe(false);
    expect(pageSchema.safeParse(1.5).success).toBe(false);
  });
});

describe("프로필", () => {
  test("닉네임 앞뒤 공백을 떼고 1~30자를 받는다", () => {
    expect(profileSchema.parse({ nickname: "  지은  " })).toEqual({
      nickname: "지은",
    });
    expect(profileSchema.safeParse({ nickname: "가".repeat(30) }).success).toBe(
      true,
    );
  });

  test("빈 닉네임과 31자를 거부한다", () => {
    expect(profileSchema.safeParse({ nickname: "   " }).success).toBe(false);
    expect(profileSchema.safeParse({ nickname: "가".repeat(31) }).success).toBe(
      false,
    );
  });
});

describe("책", () => {
  const book = {
    title: "소년이 온다",
    chapters: [
      { number: 1, title: "어린 새", startPage: 7 },
      { number: 2, title: "검은 숨" },
    ],
  };

  test("ISBN의 붙임표를 떼고 10·13자리만 받는다", () => {
    expect(isbnSchema.parse("978-89-364-3412-0")).toBe("9788936434120");
    expect(isbnSchema.parse("89-364-3412-x")).toBe("893643412X");
    expect(isbnSchema.safeParse("12345").success).toBe(false);
  });

  test("직접 입력한 책은 선택 항목이 null로 채워진다", () => {
    expect(bookSchema.parse({ ...book, isbn: "", author: " " })).toMatchObject({
      isbn: null,
      author: null,
      pages: null,
      source: "manual",
      chapters: [
        { number: 1, startPage: 7 },
        { number: 2, startPage: null },
      ],
    });
  });

  test("목차가 비었거나 장 번호가 겹치면 거부한다", () => {
    expect(bookSchema.safeParse({ ...book, chapters: [] }).success).toBe(false);
    expect(
      bookSchema.safeParse({
        ...book,
        chapters: [
          { number: 1, title: "가" },
          { number: 1, title: "나" },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("그룹", () => {
  const group = { bookId: OTHER_ID, name: "소년이 온다 함께 읽기" };

  test("정원 기본값은 8, 공개 기본값은 false다", () => {
    expect(groupSchema.parse(group)).toMatchObject({
      capacity: 8,
      isPublic: false,
      startDate: null,
      targetDate: null,
    });
  });

  test("정원은 3~8명만 받는다", () => {
    expect(groupSchema.safeParse({ ...group, capacity: 3 }).success).toBe(true);
    expect(groupSchema.safeParse({ ...group, capacity: 2 }).success).toBe(
      false,
    );
    expect(groupSchema.safeParse({ ...group, capacity: 9 }).success).toBe(
      false,
    );
  });

  test("이름은 50자까지 받는다", () => {
    expect(
      groupSchema.safeParse({ ...group, name: "가".repeat(50) }).success,
    ).toBe(true);
    expect(
      groupSchema.safeParse({ ...group, name: "가".repeat(51) }).success,
    ).toBe(false);
  });

  test("목표 완독일이 시작일보다 앞서면 거부한다", () => {
    const dates = { startDate: "2026-11-01", targetDate: "2026-10-31" };
    const result = groupSchema.safeParse({ ...group, ...dates });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["targetDate"]);
    expect(
      groupSchema.safeParse({ ...group, ...dates, targetDate: "2026-11-01" })
        .success,
    ).toBe(true);
  });

  test("초대 코드는 16진수 10자다", () => {
    expect(inviteCodeSchema.parse(" A1B2C3D4E5 ")).toBe("a1b2c3d4e5");
    expect(inviteCodeSchema.safeParse("a1b2c3").success).toBe(false);
    expect(inviteCodeSchema.safeParse("zzzzzzzzzz").success).toBe(false);
  });

  test("입장은 초대 코드나 그룹 id 중 하나로 한다", () => {
    expect(
      joinGroupSchema.safeParse({ inviteCode: "a1b2c3d4e5" }).success,
    ).toBe(true);
    expect(joinGroupSchema.safeParse({ groupId: GROUP_ID }).success).toBe(true);
    expect(joinGroupSchema.safeParse({}).success).toBe(false);
  });
});

describe("인용 카드", () => {
  const quote = {
    groupId: GROUP_ID,
    chapter: 2,
    pct: 40,
    text: "인용문",
    body: "내 감상",
  };

  test("종류 기본값은 impression이다", () => {
    expect(createQuoteSchema.parse(quote).kind).toBe("impression");
  });

  test("인용문은 300자까지 받는다", () => {
    expect(
      createQuoteSchema.safeParse({ ...quote, text: "가".repeat(300) }).success,
    ).toBe(true);
    expect(
      createQuoteSchema.safeParse({ ...quote, text: "가".repeat(301) }).success,
    ).toBe(false);
    expect(createQuoteSchema.safeParse({ ...quote, text: "  " }).success).toBe(
      false,
    );
  });

  test("본인 감상이 없으면 거부한다", () => {
    expect(createQuoteSchema.safeParse({ ...quote, body: " " }).success).toBe(
      false,
    );
  });

  test("그룹 인용 합계 10,000자를 넘는지 계산한다", () => {
    expect(remainingQuoteChars(9_900)).toBe(100);
    expect(remainingQuoteChars(10_050)).toBe(0);
    expect(exceedsQuoteLimit("가".repeat(100), 9_900)).toBe(false);
    expect(exceedsQuoteLimit("가".repeat(101), 9_900)).toBe(true);
    expect(exceedsQuoteLimit("가".repeat(11), 0, 10)).toBe(true);
  });
});

describe("감상·메모·답글", () => {
  test("본문은 2,000자까지 받는다", () => {
    const note = { groupId: GROUP_ID, quoteId: OTHER_ID };
    expect(
      quoteNoteSchema.safeParse({ ...note, body: "가".repeat(2000) }).success,
    ).toBe(true);
    expect(
      quoteNoteSchema.safeParse({ ...note, body: "가".repeat(2001) }).success,
    ).toBe(false);
    expect(quoteNoteSchema.safeParse({ ...note, body: "" }).success).toBe(
      false,
    );
  });

  test("위치 메모는 위치가 없으면 책 전체로 받는다", () => {
    const memo = { groupId: GROUP_ID, body: "질문", kind: "question" };
    expect(
      positionNoteSchema.parse({ ...memo, position: { chapter: 1, pct: 10 } })
        .position,
    ).toEqual({ chapter: 1, pct: 10 });
    expect(positionNoteSchema.parse({ ...memo, position: null }).position).toBe(
      null,
    );
    expect(
      positionNoteSchema.safeParse({ ...memo, position: null, kind: "review" })
        .success,
    ).toBe(false);
  });

  test("답글은 상위 글 id가 필요하다", () => {
    expect(
      replySchema.safeParse({
        groupId: GROUP_ID,
        parentId: OTHER_ID,
        body: "답",
      }).success,
    ).toBe(true);
    expect(
      replySchema.safeParse({ groupId: GROUP_ID, parentId: "x", body: "답" })
        .success,
    ).toBe(false);
  });
});
