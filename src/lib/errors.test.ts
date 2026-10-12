import { describe, expect, test } from "vitest";

import {
  DEFAULT_ERROR_MESSAGE,
  ERROR_MESSAGES,
  toErrorMessage,
} from "./errors";

describe("toErrorMessage", () => {
  test("DB 함수가 던진 키를 한국어 문구로 바꾼다", () => {
    expect(toErrorMessage({ code: "P0001", message: "group_full" })).toBe(
      "그룹 정원이 가득 찼어요.",
    );
    expect(toErrorMessage(new Error("quote_locked"))).toBe(
      ERROR_MESSAGES.quote_locked,
    );
  });

  test("같은 문구를 쓰는 키들을 묶는다", () => {
    expect(toErrorMessage("quote_empty")).toBe(
      toErrorMessage("quote_too_long"),
    );
    expect(toErrorMessage("position_invalid")).toBe(
      toErrorMessage("chapter_not_found"),
    );
  });

  test("RLS 거부와 중복은 Postgres 코드로 찾는다", () => {
    expect(
      toErrorMessage({
        code: "42501",
        message: 'new row violates row-level security policy for table "notes"',
      }),
    ).toBe("권한이 없어요.");
    expect(
      toErrorMessage({ code: "23505", message: "duplicate key value" }),
    ).toBe("이미 처리됐어요.");
  });

  test("모르는 오류는 기본 문구로 바꾸고 원문을 드러내지 않는다", () => {
    expect(toErrorMessage({ code: "XX000", message: "internal detail" })).toBe(
      DEFAULT_ERROR_MESSAGE,
    );
    expect(toErrorMessage(null)).toBe(DEFAULT_ERROR_MESSAGE);
    expect(toErrorMessage("toString")).toBe(DEFAULT_ERROR_MESSAGE);
  });
});
