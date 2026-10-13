import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { NewGroupForm } from "./new-group-form";

// 서버 동작은 가짜로 바꾸고, 단계 이동과 안내만 확인한다.
const actions = vi.hoisted(() => ({
  createGroup: vi.fn(),
  searchBooks: vi.fn(),
  pickBook: vi.fn(),
}));
vi.mock("@/app/groups/actions", () => actions);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function heading(name: string) {
  return screen.queryByRole("heading", { name });
}

describe("그룹 만들기 단계", () => {
  test("직접 입력으로 2단계에 가면 수정 불가 안내가 보인다", () => {
    render(<NewGroupForm />);
    expect(heading("1. 함께 읽을 책 찾기")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "검색 없이 직접 입력" }),
    );

    expect(heading("1. 함께 읽을 책 찾기")).toBeNull();
    expect(
      screen.getByText(/그룹을 만든 뒤에는 수정할 수 없어요/),
    ).toBeDefined();
  });

  test("책 제목 없이는 다음으로 갈 수 없다", () => {
    render(<NewGroupForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "검색 없이 직접 입력" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.getByText("책 제목을 입력해 주세요.")).toBeDefined();
    expect(screen.queryByText("목차 없이 진행할까요?")).toBeNull();
  });

  test("목차 없이 다음을 누르면 한 번 알리고, 다시 누르면 3단계로 간다", () => {
    render(<NewGroupForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "검색 없이 직접 입력" }),
    );
    fireEvent.change(screen.getByLabelText("책 제목"), {
      target: { value: "소년이 온다" },
    });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("목차 없이 진행할까요?")).toBeDefined();
    expect(screen.getByText(/스포일러가 생기기\s+쉬워요/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "목차 없이 다음" }));
    expect(screen.getByRole("button", { name: "그룹 만들기" })).toBeDefined();
    expect(screen.getByText(/목차 없음/)).toBeDefined();
  });

  test("목차를 적으면 알림 없이 3단계로 가고, 이전으로 돌아와도 입력이 남는다", () => {
    render(<NewGroupForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "검색 없이 직접 입력" }),
    );
    fireEvent.change(screen.getByLabelText("책 제목"), {
      target: { value: "소년이 온다" },
    });
    fireEvent.change(screen.getByLabelText(/^목차/), {
      target: { value: "어린 새 | 7\n검은 숨 | 45" },
    });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.queryByText("목차 없이 진행할까요?")).toBeNull();
    expect(screen.getByText(/목차 2개 장/)).toBeDefined();

    // 3단계의 이전 버튼(2단계의 것은 숨겨져 있어 역할로는 하나만 잡힌다)
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect((screen.getByLabelText("책 제목") as HTMLInputElement).value).toBe(
      "소년이 온다",
    );
    expect(screen.queryByRole("button", { name: "그룹 만들기" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(heading("1. 함께 읽을 책 찾기")).not.toBeNull();
  });
});
