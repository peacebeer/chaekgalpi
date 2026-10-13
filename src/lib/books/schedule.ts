// 읽는 기간(시작일~목표 완독일)과 오늘 날짜로 권장 진도를 계산한다.
// 날짜는 모두 "YYYY-MM-DD" 글자로 다룬다(시간대 때문에 하루가 밀리지 않게).

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

// 한국 시간 기준 오늘 날짜
export function todayInSeoul(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    now,
  );
}

export function periodLabel(
  start: string | null,
  target: string | null,
): string | null {
  if (!start && !target) return null;
  return `${start ?? "시작일 미정"} ~ ${target ?? "완독일 미정"}`;
}

export type Schedule = {
  // 시작일과 완독일을 모두 포함한 날 수
  totalDays: number;
  // 오늘이 기간의 며칠째인지(시작 전 0, 끝난 뒤 totalDays)
  dayNumber: number;
  status: "before" | "during" | "after";
  // 오늘까지 읽었어야 하는 비율(0~100)
  expectedPercent: number;
  // 전체 쪽수를 알 때만: 하루 권장 쪽수와 오늘까지의 권장 쪽
  pagesPerDay: number | null;
  expectedPage: number | null;
};

// 시작일과 목표 완독일이 모두 있을 때만 일정을 만든다.
export function buildSchedule(
  start: string | null,
  target: string | null,
  today: string,
  pages: number | null,
): Schedule | null {
  if (!start || !target || target < start) return null;

  const totalDays = Math.round((toUtc(target) - toUtc(start)) / DAY_MS) + 1;
  const elapsed = Math.round((toUtc(today) - toUtc(start)) / DAY_MS) + 1;
  const dayNumber = Math.min(Math.max(elapsed, 0), totalDays);
  const expectedPercent = Math.round((dayNumber / totalDays) * 1000) / 10;

  return {
    totalDays,
    dayNumber,
    status: elapsed < 1 ? "before" : elapsed > totalDays ? "after" : "during",
    expectedPercent,
    pagesPerDay: pages ? Math.ceil(pages / totalDays) : null,
    expectedPage: pages ? Math.round((pages * dayNumber) / totalDays) : null,
  };
}

export type CalendarDay = {
  date: string;
  day: number;
  inPeriod: boolean;
  isToday: boolean;
  isStart: boolean;
  isTarget: boolean;
};

export type CalendarMonth = {
  // "2026년 11월"
  label: string;
  // 일요일부터 시작하는 주. 그 달이 아닌 칸은 null
  weeks: (CalendarDay | null)[][];
};

// 기간이 걸친 달들을 달력 모양으로 만든다. 너무 길면 앞에서부터 maxMonths달만 그린다.
export function buildCalendar(
  start: string,
  target: string,
  today: string,
  maxMonths = 12,
): CalendarMonth[] {
  const months: CalendarMonth[] = [];
  const [startYear, startMonth] = start.split("-").map(Number);
  const [targetYear, targetMonth] = target.split("-").map(Number);
  const pad = (value: number) => String(value).padStart(2, "0");

  for (
    let year = startYear, month = startMonth;
    (year < targetYear || (year === targetYear && month <= targetMonth)) &&
    months.length < maxMonths;
    month === 12 ? ((year += 1), (month = 1)) : (month += 1)
  ) {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells: (CalendarDay | null)[] = Array.from(
      { length: firstWeekday },
      () => null,
    );

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${pad(month)}-${pad(day)}`;
      cells.push({
        date,
        day,
        inPeriod: date >= start && date <= target,
        isToday: date === today,
        isStart: date === start,
        isTarget: date === target,
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (CalendarDay | null)[][] = [];
    for (let index = 0; index < cells.length; index += 7) {
      weeks.push(cells.slice(index, index + 7));
    }
    months.push({ label: `${year}년 ${month}월`, weeks });
  }

  return months;
}
