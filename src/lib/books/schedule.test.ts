import { describe, expect, test } from "vitest";

import {
  buildCalendar,
  buildSchedule,
  periodLabel,
  todayInSeoul,
} from "./schedule";

describe("todayInSeoul", () => {
  test("한국 시간으로 날짜를 낸다", () => {
    // UTC로는 12일 밤이지만 한국은 13일 아침
    expect(todayInSeoul(new Date("2026-10-12T22:30:00Z"))).toBe("2026-10-13");
  });
});

describe("periodLabel", () => {
  test("한쪽만 있어도 표시하고, 둘 다 없으면 null이다", () => {
    expect(periodLabel("2026-11-01", "2026-11-30")).toBe(
      "2026-11-01 ~ 2026-11-30",
    );
    expect(periodLabel("2026-11-01", null)).toBe("2026-11-01 ~ 완독일 미정");
    expect(periodLabel(null, null)).toBe(null);
  });
});

describe("buildSchedule", () => {
  test("기간 중에는 며칠째인지와 권장 비율·쪽수를 계산한다", () => {
    // 11월 1일~30일(30일), 300쪽 → 하루 10쪽. 10일이면 10일째, 100쪽
    expect(
      buildSchedule("2026-11-01", "2026-11-30", "2026-11-10", 300),
    ).toEqual({
      totalDays: 30,
      dayNumber: 10,
      status: "during",
      expectedPercent: 33.3,
      pagesPerDay: 10,
      expectedPage: 100,
    });
  });

  test("시작일 당일이 1일째, 완독일 당일에 100%가 된다", () => {
    expect(
      buildSchedule("2026-11-01", "2026-11-30", "2026-11-01", null),
    ).toMatchObject({ dayNumber: 1, status: "during" });
    expect(
      buildSchedule("2026-11-01", "2026-11-30", "2026-11-30", 300),
    ).toMatchObject({ expectedPercent: 100, expectedPage: 300 });
  });

  test("시작 전과 끝난 뒤를 구분한다", () => {
    expect(
      buildSchedule("2026-11-01", "2026-11-30", "2026-10-20", 300),
    ).toMatchObject({ status: "before", dayNumber: 0, expectedPage: 0 });
    expect(
      buildSchedule("2026-11-01", "2026-11-30", "2026-12-05", 300),
    ).toMatchObject({ status: "after", dayNumber: 30, expectedPercent: 100 });
  });

  test("하루 권장 쪽수는 올림한다(끝에 몰리지 않게)", () => {
    expect(
      buildSchedule("2026-11-01", "2026-11-07", "2026-11-01", 200)?.pagesPerDay,
    ).toBe(29);
  });

  test("전체 쪽수를 모르면 쪽수 항목은 null이다", () => {
    expect(
      buildSchedule("2026-11-01", "2026-11-30", "2026-11-10", null),
    ).toMatchObject({ pagesPerDay: null, expectedPage: null });
  });

  test("날짜가 하나라도 없거나 거꾸로면 일정을 만들지 않는다", () => {
    expect(buildSchedule(null, "2026-11-30", "2026-11-10", 300)).toBe(null);
    expect(buildSchedule("2026-11-01", null, "2026-11-10", 300)).toBe(null);
    expect(buildSchedule("2026-11-30", "2026-11-01", "2026-11-10", 300)).toBe(
      null,
    );
  });
});

describe("buildCalendar", () => {
  test("기간이 걸친 달을 모두 그리고 기간·오늘·시작·끝을 표시한다", () => {
    const months = buildCalendar("2026-10-28", "2026-11-03", "2026-11-01");
    expect(months.map((month) => month.label)).toEqual([
      "2026년 10월",
      "2026년 11월",
    ]);

    const days = months.flatMap((month) => month.weeks.flat()).filter(Boolean);
    expect(days.filter((day) => day!.inPeriod).map((day) => day!.date)).toEqual(
      [
        "2026-10-28",
        "2026-10-29",
        "2026-10-30",
        "2026-10-31",
        "2026-11-01",
        "2026-11-02",
        "2026-11-03",
      ],
    );
    expect(days.find((day) => day!.isToday)?.date).toBe("2026-11-01");
    expect(days.find((day) => day!.isStart)?.date).toBe("2026-10-28");
    expect(days.find((day) => day!.isTarget)?.date).toBe("2026-11-03");
  });

  test("주는 일요일부터 시작하고 7칸씩이다", () => {
    // 2026년 11월 1일은 일요일
    const [november] = buildCalendar("2026-11-01", "2026-11-30", "2026-11-10");
    expect(november.weeks[0][0]?.day).toBe(1);
    expect(november.weeks.every((week) => week.length === 7)).toBe(true);
    expect(november.weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  test("너무 긴 기간은 정해 둔 달 수까지만 그린다", () => {
    expect(
      buildCalendar("2026-01-01", "2028-12-31", "2026-01-01", 3),
    ).toHaveLength(3);
  });
});
