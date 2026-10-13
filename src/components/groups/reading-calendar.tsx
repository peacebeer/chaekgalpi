import type { CalendarMonth } from "@/lib/books/schedule";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 읽는 기간을 달력에 칠해 보여 준다. 오늘은 테두리로, 시작일과 완독일은 진한 색으로 표시한다.
export function ReadingCalendar({ months }: { months: CalendarMonth[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {months.map((month) => (
          <table
            key={month.label}
            className="bg-card w-full table-fixed border-separate border-spacing-1 rounded-xl border p-3 text-center text-sm"
          >
            <caption className="pb-2 text-left font-semibold">
              {month.label}
            </caption>
            <thead>
              <tr>
                {WEEKDAYS.map((weekday) => (
                  <th
                    key={weekday}
                    scope="col"
                    className="text-muted-foreground pb-1 text-xs font-normal"
                  >
                    {weekday}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {month.weeks.map((week, index) => (
                <tr key={index}>
                  {week.map((day, column) =>
                    day ? (
                      <td
                        key={day.date}
                        aria-current={day.isToday ? "date" : undefined}
                        className={[
                          "h-8 rounded-md tabular-nums",
                          day.isStart || day.isTarget
                            ? "bg-primary text-primary-foreground font-semibold"
                            : day.inPeriod
                              ? "bg-accent"
                              : "text-muted-foreground",
                          day.isToday
                            ? "outline-foreground font-semibold outline-2 outline-offset-1"
                            : "",
                        ].join(" ")}
                      >
                        {day.day}
                        {(day.isToday || day.isStart || day.isTarget) && (
                          <span className="sr-only">
                            {[
                              day.isToday && "오늘",
                              day.isStart && "시작일",
                              day.isTarget && "목표 완독일",
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
                      </td>
                    ) : (
                      <td key={`empty-${column}`} />
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <span className="bg-primary size-3 rounded-sm" aria-hidden />
          시작일·목표 완독일
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-accent size-3 rounded-sm border" aria-hidden />
          읽는 기간
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="outline-foreground size-3 rounded-sm outline-2"
            aria-hidden
          />
          오늘
        </li>
      </ul>
    </div>
  );
}
