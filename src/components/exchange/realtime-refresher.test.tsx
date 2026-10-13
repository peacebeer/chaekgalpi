import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { RealtimeRefresher } from "./realtime-refresher";

const GROUP_ID = "7b0b7a52-3d5e-4c1b-9a51-0d6f3e2a1c11";

type Binding = {
  filter: { event: string; table: string; filter?: string };
  handler: () => void;
};

const mocks = vi.hoisted(() => {
  const state = {
    bindings: [] as Binding[],
    onStatus: (() => {}) as (status: string) => void,
    removed: 0,
  };
  const channel = {
    on(_type: string, filter: Binding["filter"], handler: () => void) {
      state.bindings.push({ filter, handler });
      return channel;
    },
    subscribe(callback: (status: string) => void) {
      state.onStatus = callback;
      return channel;
    },
  };
  return {
    state,
    refresh: vi.fn(),
    channelName: vi.fn(() => channel),
    removeChannel: vi.fn(() => {
      state.removed += 1;
      return Promise.resolve("ok");
    }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: mocks.channelName,
    removeChannel: mocks.removeChannel,
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.state.bindings = [];
  mocks.state.removed = 0;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("RealtimeRefresher", () => {
  test("이 그룹의 카드·감상·진도와 좋아요, 삭제 신호를 구독한다", () => {
    render(<RealtimeRefresher groupId={GROUP_ID} />);

    expect(mocks.channelName).toHaveBeenCalledWith(`group-${GROUP_ID}`);
    const summary = mocks.state.bindings.map(
      ({ filter }) => `${filter.event} ${filter.table} ${filter.filter ?? "-"}`,
    );
    expect(summary).toEqual([
      `* quotes group_id=eq.${GROUP_ID}`,
      `* notes group_id=eq.${GROUP_ID}`,
      `* memberships group_id=eq.${GROUP_ID}`,
      "* reactions -",
      "DELETE quotes -",
      "DELETE notes -",
    ]);
  });

  test("변경이 연달아 와도 한 번만 다시 불러온다", () => {
    render(<RealtimeRefresher groupId={GROUP_ID} />);
    const [quotes, notes] = mocks.state.bindings;

    quotes.handler();
    notes.handler();
    notes.handler();
    expect(mocks.refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  test("연결 상태를 알려 준다", () => {
    render(<RealtimeRefresher groupId={GROUP_ID} />);
    expect(screen.getByRole("status").textContent).toContain("연결 중");

    act(() => mocks.state.onStatus("SUBSCRIBED"));
    expect(screen.getByRole("status").textContent).toContain("실시간 반영 중");

    act(() => mocks.state.onStatus("CHANNEL_ERROR"));
    expect(screen.getByRole("status").textContent).toContain("끊겼어요");
  });

  test("화면을 떠나면 구독을 끊고 예약된 새로고침을 취소한다", () => {
    const { unmount } = render(<RealtimeRefresher groupId={GROUP_ID} />);
    mocks.state.bindings[0].handler();
    unmount();

    vi.advanceTimersByTime(1000);
    expect(mocks.state.removed).toBe(1);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
