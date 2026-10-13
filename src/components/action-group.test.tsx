import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { ActionGroup } from "./action-group";
import { ConfirmAction } from "./groups/confirm-action";

afterEach(cleanup);

const noop = async () => ({});

function Pair() {
  return (
    <>
      <ConfirmAction
        action={noop}
        fields={{}}
        label="카드 삭제"
        question="카드를 지울까요?"
        confirmLabel="삭제"
      />
      <ConfirmAction
        action={noop}
        fields={{}}
        label="카드 내리기"
        question="카드를 내릴까요?"
        confirmLabel="내리기"
      />
    </>
  );
}

describe("ActionGroup", () => {
  test("묶음 안에서는 한 번에 하나만 열린다", () => {
    render(
      <ActionGroup>
        <Pair />
      </ActionGroup>,
    );

    fireEvent.click(screen.getByRole("button", { name: "카드 삭제" }));
    expect(screen.getByText("카드를 지울까요?")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "카드 내리기" }));
    expect(screen.getByText("카드를 내릴까요?")).toBeDefined();
    expect(screen.queryByText("카드를 지울까요?")).toBeNull();
  });

  test("열린 버튼을 다시 누르면 닫힌다", () => {
    render(
      <ActionGroup>
        <Pair />
      </ActionGroup>,
    );

    const trigger = screen.getByRole("button", { name: "카드 삭제" });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger);
    expect(screen.queryByText("카드를 지울까요?")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("서로 다른 묶음은 따로 열린다", () => {
    render(
      <>
        <ActionGroup>
          <ConfirmAction
            action={noop}
            fields={{}}
            label="첫째"
            question="첫째 질문"
            confirmLabel="확인"
          />
        </ActionGroup>
        <ActionGroup>
          <ConfirmAction
            action={noop}
            fields={{}}
            label="둘째"
            question="둘째 질문"
            confirmLabel="확인"
          />
        </ActionGroup>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "첫째" }));
    fireEvent.click(screen.getByRole("button", { name: "둘째" }));
    expect(screen.getByText("첫째 질문")).toBeDefined();
    expect(screen.getByText("둘째 질문")).toBeDefined();
  });

  test("묶음 밖에서도 혼자 열리고 닫힌다", () => {
    render(<Pair />);
    fireEvent.click(screen.getByRole("button", { name: "카드 삭제" }));
    expect(screen.getByText("카드를 지울까요?")).toBeDefined();
  });
});
