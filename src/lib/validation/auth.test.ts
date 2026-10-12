import { describe, expect, test } from "vitest";

import { loginSchema, safeNextPath, signupSchema } from "./auth";

describe("로그인·가입 입력", () => {
  test("이메일은 공백을 떼고 소문자로 맞춘다", () => {
    expect(
      loginSchema.parse({ email: "  Jieun@Example.com ", password: "x" }).email,
    ).toBe("jieun@example.com");
  });

  test("잘못된 이메일과 빈 비밀번호를 거부한다", () => {
    expect(
      loginSchema.safeParse({ email: "jieun", password: "x" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: "a@example.com", password: "" }).success,
    ).toBe(false);
  });

  test("가입 비밀번호는 8~72자다", () => {
    const base = { nickname: "지은", email: "a@example.com" };
    expect(
      signupSchema.safeParse({ ...base, password: "1234567" }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...base, password: "12345678" }).success,
    ).toBe(true);
    expect(
      signupSchema.safeParse({ ...base, password: "a".repeat(73) }).success,
    ).toBe(false);
  });

  test("가입 닉네임은 프로필과 같은 규칙(1~30자)을 쓴다", () => {
    const base = { email: "a@example.com", password: "12345678" };
    expect(signupSchema.safeParse({ ...base, nickname: " " }).success).toBe(
      false,
    );
    expect(
      signupSchema.safeParse({ ...base, nickname: "가".repeat(31) }).success,
    ).toBe(false);
  });
});

describe("safeNextPath", () => {
  test("사이트 안 경로는 그대로 돌려준다", () => {
    expect(safeNextPath("/join/a1b2c3d4e5")).toBe("/join/a1b2c3d4e5");
    expect(safeNextPath("/groups/1?tab=notes")).toBe("/groups/1?tab=notes");
  });

  test("바깥 주소로 보내려는 값은 기본 경로로 바꾼다", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath(null, "/profile")).toBe("/profile");
  });
});
