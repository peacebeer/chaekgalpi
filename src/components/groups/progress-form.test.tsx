import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ProgressForm } from "./progress-form";

const actions = vi.hoisted(() => ({
  saveProgress: vi.fn(),
  pageToPosition: vi.fn(),
}));
vi.mock("@/app/groups/[id]/progress-actions", () => actions);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const chapters = [
  { number: 1, title: "어린 새" },
  { number: 2, title: "검은 숨" },
  { number: 3, title: "일곱 개의 뺨" },
];

function renderForm(props: Partial<Parameters<typeof ProgressForm>[0]> = {}) {
  return render(
    <ProgressForm
      groupId="7b0b7a52-3d5e-4c1b-9a51-0d6f3e2a1c11"
      chapters={chapters}
      wholeBook={false}
      canUsePages={true}
      initial={{ chapter: 2, pct: 40, finished: false }}
      {...props}
    />,
  );
}

describe("진도 입력", () => {
  test("저장된 장과 위치로 시작한다", () => {
    renderForm();
    expect(
      (screen.getByLabelText("읽고 있는 장") as HTMLSelectElement).value,
    ).toBe("2");
    expect(screen.getByText(/이 장에서 읽은 위치: 40%/)).toBeDefined();
  });

  test("쪽수를 위치로 바꿔 장과 막대에 반영한다", async () => {
    actions.pageToPosition.mockResolvedValue({
      ok: true,
      chapter: 3,
      pct: 25.4,
    });
    renderForm();

    fireEvent.change(screen.getByLabelText("쪽수로 입력"), {
      target: { value: "143" },
    });
    fireEvent.click(screen.getByRole("button", { name: "위치로 바꾸기" }));

    await waitFor(() =>
      expect(
        (screen.getByLabelText("읽고 있는 장") as HTMLSelectElement).value,
      ).toBe("3"),
    );
    expect(actions.pageToPosition).toHaveBeenCalledWith(
      "7b0b7a52-3d5e-4c1b-9a51-0d6f3e2a1c11",
      143,
    );
    expect(screen.getByText(/이 장에서 읽은 위치: 25%/)).toBeDefined();
    expect(screen.getByText(/143쪽은 3장 · 25% 위치예요/)).toBeDefined();
  });

  test("쪽수를 쓸 수 없는 책은 오류 문구를 보여 준다", async () => {
    actions.pageToPosition.mockResolvedValue({
      ok: false,
      message: "쪽수를 확인해 주세요.",
    });
    renderForm();

    fireEvent.change(screen.getByLabelText("쪽수로 입력"), {
      target: { value: "9999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "위치로 바꾸기" }));

    await waitFor(() =>
      expect(screen.getByText("쪽수를 확인해 주세요.")).toBeDefined(),
    );
  });

  test("시작 쪽이 없는 책은 쪽수 입력을 숨긴다", () => {
    renderForm({ canUsePages: false });
    expect(screen.queryByLabelText("쪽수로 입력")).toBeNull();
  });

  test("목차 없는 책은 장 선택 없이 책 전체 %만 받는다", () => {
    renderForm({
      wholeBook: true,
      chapters: [{ number: 1, title: "책 전체" }],
      initial: { chapter: 1, pct: 60, finished: false },
    });
    expect(screen.queryByLabelText("읽고 있는 장")).toBeNull();
    expect(screen.getByText(/책 전체에서 읽은 위치: 60%/)).toBeDefined();
  });

  test("완독을 체크하면 위치 입력을 잠근다", () => {
    renderForm();
    fireEvent.click(screen.getByLabelText(/완독/));

    expect(
      (screen.getByLabelText("읽고 있는 장") as HTMLSelectElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/이 장에서 읽은 위치: 완독/)).toBeDefined();
  });
});
