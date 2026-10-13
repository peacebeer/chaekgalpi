import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Composer } from "./composer";
import { maxPctFor } from "./position-picker";

const actions = vi.hoisted(() => ({
  createQuote: vi.fn(),
  addNote: vi.fn(),
  findSimilarQuotes: vi.fn(),
}));
vi.mock("@/app/groups/[id]/exchange-actions", () => actions);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const GROUP_ID = "7b0b7a52-3d5e-4c1b-9a51-0d6f3e2a1c11";
const chapters = [
  { number: 1, title: "어린 새" },
  { number: 2, title: "검은 숨" },
  { number: 3, title: "일곱 개의 뺨" },
];

function renderComposer(
  progress = { chapter: 2, pct: 40, finished: false },
  wholeBook = false,
) {
  actions.findSimilarQuotes.mockResolvedValue([]);
  return render(
    <Composer
      groupId={GROUP_ID}
      chapters={chapters}
      wholeBook={wholeBook}
      progress={progress}
    />,
  );
}

describe("maxPctFor", () => {
  test("내 진도 장에서는 내 위치까지, 앞 장은 끝까지 고를 수 있다", () => {
    const progress = { chapter: 2, pct: 40.6, finished: false };
    expect(maxPctFor(2, progress)).toBe(40);
    expect(maxPctFor(1, progress)).toBe(100);
    expect(maxPctFor(2, { ...progress, finished: true })).toBe(100);
  });
});

describe("글 남기기", () => {
  test("내 진도 위치에서 시작하고, 아직 읽지 않은 장은 고를 수 없다", () => {
    renderComposer();
    const select = screen.getByLabelText("장") as HTMLSelectElement;
    expect(select.value).toBe("2");
    expect([...select.options].map((option) => option.value)).toEqual([
      "1",
      "2",
    ]);
    expect(screen.getByText(/이 장 안에서의 위치: 40%/)).toBeDefined();
  });

  test("인용 카드는 인용문과 감상 칸이 있고 글자 수를 센다", () => {
    renderComposer();
    fireEvent.change(screen.getByLabelText("인용문"), {
      target: { value: "가".repeat(301) },
    });
    expect(screen.getByText(/301\/300자/)).toBeDefined();
    expect(screen.getByLabelText("내 감상 (필수)")).toBeDefined();
  });

  test("메모·질문으로 바꾸면 인용문 칸이 사라지고 종류를 고른다", () => {
    renderComposer();
    fireEvent.click(screen.getByRole("tab", { name: "메모·질문" }));

    expect(screen.queryByLabelText("인용문")).toBeNull();
    expect(
      [...(screen.getByLabelText("종류") as HTMLSelectElement).options].map(
        (option) => option.text,
      ),
    ).toEqual(["메모", "질문", "정리"]);
    // 완독 전에는 책 전체 글을 쓸 수 없다.
    expect(screen.queryByLabelText(/책 전체에 대한 글/)).toBeNull();
  });

  test("완독한 회원은 책 전체에 대한 글을 고를 수 있고, 고르면 위치 칸이 사라진다", () => {
    renderComposer({ chapter: 3, pct: 100, finished: true });
    fireEvent.click(screen.getByRole("tab", { name: "메모·질문" }));
    fireEvent.click(screen.getByLabelText(/책 전체에 대한 글/));
    expect(screen.queryByLabelText("장")).toBeNull();
  });

  test("인용을 입력하면 비슷한 카드를 찾아 그 카드로 가는 링크를 보여 준다", async () => {
    renderComposer();
    actions.findSimilarQuotes.mockResolvedValue([
      {
        id: "c1f6a8de-52a4-4f0e-8d1c-9b7e5a3f2d10",
        text: "당신이 죽은 뒤 장례를 치르지 못해",
        chapter: 2,
        pct: 12,
      },
    ]);

    fireEvent.change(screen.getByLabelText("인용문"), {
      target: { value: "당신이 죽은 뒤 장례를" },
    });

    const link = await waitFor(() =>
      screen.getByRole("link", { name: "여기에 감상 남기기" }),
    );
    expect(link.getAttribute("href")).toBe(
      "#quote-c1f6a8de-52a4-4f0e-8d1c-9b7e5a3f2d10",
    );
    expect(actions.findSimilarQuotes).toHaveBeenLastCalledWith(
      GROUP_ID,
      2,
      40,
      "당신이 죽은 뒤 장례를",
    );
  });

  test("짧은 입력으로는 비슷한 카드를 찾지 않는다", async () => {
    renderComposer();
    fireEvent.change(screen.getByLabelText("인용문"), {
      target: { value: "당신" },
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(actions.findSimilarQuotes).not.toHaveBeenCalled();
  });

  test("목차 없는 책은 장 선택 없이 책 전체 위치만 고른다", () => {
    renderComposer({ chapter: 1, pct: 60, finished: false }, true);
    expect(screen.queryByLabelText("장")).toBeNull();
    expect(screen.getByText(/책 전체에서의 위치: 60%/)).toBeDefined();
  });
});
