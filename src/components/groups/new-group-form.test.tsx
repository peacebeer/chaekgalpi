import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
    expect(heading("3. 그룹 정보")).toBeNull();
  });

  test("필수 항목은 빨간 필수, 전체 쪽수와 목차는 권장으로 표시한다", () => {
    render(<NewGroupForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "검색 없이 직접 입력" }),
    );
    expect(
      screen.getByLabelText(/^책 제목/).closest("div")!.textContent,
    ).toContain("필수");
    expect(
      screen.getByLabelText(/^전체 쪽수/).closest("div")!.textContent,
    ).toContain("권장");
    expect(screen.getByText("목차").parentElement!.textContent).toContain(
      "권장",
    );
  });

  test("전체 쪽수나 목차를 비우고 만들기를 누르면 만들기 전에 한 번 알리고 돌아가 채울 수 있다", () => {
    actions.createGroup.mockResolvedValue({});
    render(<NewGroupForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "검색 없이 직접 입력" }),
    );
    fireEvent.change(screen.getByLabelText(/^책 제목/), {
      target: { value: "소년이 온다" },
    });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText(/목차 없음/)).toBeDefined();
    fireEvent.change(screen.getByLabelText(/^그룹 이름/), {
      target: { value: "봄 독서" },
    });

    fireEvent.click(screen.getByRole("button", { name: "그룹 만들기" }));
    expect(
      screen.getByText(
        "권장 항목을 비워 두고 만들까요? (비어 있음: 전체 쪽수, 목차)",
      ),
    ).toBeDefined();
    expect(actions.createGroup).not.toHaveBeenCalled();

    // 돌아가서 채우기를 누르면 2단계로 간다.
    fireEvent.click(
      screen.getByRole("button", { name: "책 정보로 돌아가 채우기" }),
    );
    expect(heading("2. 책 정보와 목차")).not.toBeNull();
  });

  test("목차를 적으면 3단계로 가고, 이전으로 돌아와도 입력이 남는다", () => {
    render(<NewGroupForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "검색 없이 직접 입력" }),
    );
    fireEvent.change(screen.getByLabelText(/^책 제목/), {
      target: { value: "소년이 온다" },
    });
    fireEvent.change(screen.getByLabelText(/^목차/), {
      target: { value: "어린 새 | 7\n검은 숨 | 45" },
    });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText(/목차 2개 장/)).toBeDefined();

    // 3단계의 이전 버튼(2단계의 것은 숨겨져 있어 역할로는 하나만 잡힌다)
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect((screen.getByLabelText(/^책 제목/) as HTMLInputElement).value).toBe(
      "소년이 온다",
    );
    expect(screen.queryByRole("button", { name: "그룹 만들기" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(heading("1. 함께 읽을 책 찾기")).not.toBeNull();
  });
});

describe("목차 미리 보기", () => {
  test("적은 목차가 어떻게 저장될지 장 제목과 쪽수로 보여 준다", () => {
    render(<NewGroupForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "검색 없이 직접 입력" }),
    );
    expect(screen.queryByRole("list", { name: "목차 미리 보기" })).toBeNull();

    fireEvent.change(screen.getByLabelText(/^목차/), {
      target: { value: "어린 새 130p\n검은 숨" },
    });

    const preview = screen.getByRole("list", { name: "목차 미리 보기" });
    expect(preview.textContent).toContain("어린 새");
    expect(preview.textContent).toContain("130쪽");
    expect(preview.textContent).toContain("쪽수 없음");
    expect(screen.getByText(/이렇게 저장돼요 \(2개 장\)/)).toBeDefined();
  });
});

describe("저장된 목차 버전", () => {
  const fresh = {
    isbn: "9788936434120",
    title: "소년이 온다",
    author: "한강",
    translator: "",
    publisher: "창비",
    pages: "215",
    coverUrl: "",
    chaptersText: "1장 | 7\n2장 | 45",
    source: "kakao" as const,
    tocFromLibrary: true,
  };
  const saved = {
    id: "e1000000-0000-0000-0000-0000000000b1",
    title: "소년이 온다",
    author: "한강",
    translator: "",
    publisher: "창비",
    pages: "215",
    coverUrl: "",
    chaptersText: "어린 새 | 7\n검은 숨 | 45",
    chapterCount: 2,
    hasStartPages: true,
    groupCount: 3,
    fromLibrary: false,
  };

  const tocField = () =>
    document.getElementById("chapters") as HTMLTextAreaElement;

  async function pickSavedBook() {
    actions.searchBooks.mockResolvedValue({
      ok: true,
      books: [{ ...fresh, year: "2014", coverUrl: null }],
      total: 1,
      nextPage: null,
    });
    actions.pickBook.mockResolvedValue({
      ok: true,
      book: fresh,
      versions: [saved],
    });
    const view = render(<NewGroupForm />);
    fireEvent.change(screen.getByLabelText("책 제목, 저자, 출판사 또는 ISBN"), {
      target: { value: "소년이 온다" },
    });
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    const result = await screen.findByRole("button", { name: /소년이 온다/ });
    // 검색이 끝나 버튼이 다시 눌릴 수 있을 때 고른다.
    await waitFor(() =>
      expect((result as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(result);
    await screen.findByRole("region", { name: "저장된 목차" });
    const hidden = (name: string) =>
      (
        view.container.querySelector(
          `input[name="${name}"]`,
        ) as HTMLInputElement
      ).value;
    return hidden;
  }

  test("저장된 목차가 있으면 추천 1순위를 그대로 쓰도록 골라 두고 고칠 수 없게 한다", async () => {
    const hidden = await pickSavedBook();
    expect(hidden("bookVersion")).toBe(saved.id);
    expect((tocField() as HTMLTextAreaElement).value).toBe(saved.chaptersText);
    expect(screen.getByLabelText(/^책 제목/).hasAttribute("readonly")).toBe(
      true,
    );
  });

  test("바탕으로 고쳐 만들면 칸을 고칠 수 있고, 새로 만들면 도서관 목차로 시작한다", async () => {
    const hidden = await pickSavedBook();

    fireEvent.click(
      screen.getByRole("button", { name: "바탕으로 고쳐 만들기" }),
    );
    expect([hidden("bookVersion"), hidden("basedOn")]).toEqual(["", saved.id]);
    expect(tocField().hasAttribute("readonly")).toBe(false);
    expect(hidden("tocFromLibrary")).toBe("");

    fireEvent.click(
      screen.getByRole("button", { name: "도서관 목차로 새로 만들기" }),
    );
    expect([hidden("bookVersion"), hidden("basedOn")]).toEqual(["", ""]);
    expect((tocField() as HTMLTextAreaElement).value).toBe(fresh.chaptersText);
    expect(hidden("tocFromLibrary")).toBe("1");
  });
});
