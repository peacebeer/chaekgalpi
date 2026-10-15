import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { TocVersion } from "@/lib/books/versions";

import { TocVersionPicker } from "./toc-version-picker";

afterEach(cleanup);

function version(index: number): TocVersion {
  return {
    id: `v${index}`,
    title: "소년이 온다",
    author: "한강",
    translator: "",
    publisher: "창비",
    pages: "215",
    coverUrl: "",
    chaptersText: `${index}번 목차 첫 장 | 7\n둘째 장 | 45`,
    chapterCount: 2,
    hasStartPages: true,
    groupCount: 5 - index,
    fromLibrary: index === 1,
  };
}

const versions = [1, 2, 3, 4, 5].map(version);

function renderPicker(selected = "v1", basedOn = "") {
  const handlers = { onUse: vi.fn(), onEditFrom: vi.fn(), onFresh: vi.fn() };
  render(
    <TocVersionPicker
      versions={versions}
      selected={selected}
      basedOn={basedOn}
      libraryTocAvailable
      {...handlers}
    />,
  );
  return handlers;
}

describe("저장된 목차 고르기", () => {
  test("추천 순서로 3개만 보여 주고 나머지는 더 보기로 접는다", () => {
    renderPicker();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("추천 · 목차 1")).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: "다른 목차 2개 더 보기" }),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /더 보기/ })).toBeNull();
  });

  test("고른 목차는 쓰는 중으로 표시하고, 다른 목차를 고르거나 고쳐 만들 수 있다", () => {
    const handlers = renderPicker();
    expect(
      screen.getByRole("button", { name: "이 목차 쓰는 중" }),
    ).toBeDefined();
    expect(screen.getByText(/그대로 써요/)).toBeDefined();

    fireEvent.click(screen.getAllByRole("button", { name: "이 목차 쓰기" })[0]);
    expect(handlers.onUse).toHaveBeenCalledWith(versions[1]);

    fireEvent.click(
      screen.getAllByRole("button", { name: "바탕으로 고쳐 만들기" })[2],
    );
    expect(handlers.onEditFrom).toHaveBeenCalledWith(versions[2]);

    fireEvent.click(
      screen.getByRole("button", { name: "도서관 목차로 새로 만들기" }),
    );
    expect(handlers.onFresh).toHaveBeenCalled();
  });

  test("고쳐 만드는 중이면 어느 목차를 바탕으로 하는지 알려 준다", () => {
    renderPicker("", "v2");
    expect(
      screen.getByText(/목차 2번을 바탕으로 새 목차를 만들어요/),
    ).toBeDefined();
  });
});
