import { ReadingCalendar } from "@/components/groups/reading-calendar";
import type { CalendarMonth, Schedule } from "@/lib/books/schedule";

type ReadingPlanProps = {
  schedule: Schedule | null;
  period: string | null;
  months: CalendarMonth[];
  isOwner: boolean;
};

// 읽는 기간 요약(며칠째인지, 하루 권장 쪽수, 오늘까지의 권장 쪽)과 달력
export function ReadingPlan({
  schedule,
  period,
  months,
  isOwner,
}: ReadingPlanProps) {
  if (!schedule) {
    return (
      <p className="text-muted-foreground text-sm">
        {isOwner
          ? "그룹 정보 탭의 그룹 설정에서 시작일과 목표 완독일을 정하면 달력과 권장 진도가 보여요."
          : "리더가 시작일과 목표 완독일을 정하면 달력과 권장 진도가 보여요."}
      </p>
    );
  }

  const percent = Math.round(schedule.expectedPercent);

  return (
    <>
      <div className="bg-card flex flex-col gap-1 rounded-xl border p-4 text-sm">
        <p className="font-medium">
          {period} · 총 {schedule.totalDays}일
        </p>
        <p>
          {schedule.status === "before"
            ? "아직 시작 전이에요."
            : schedule.status === "after"
              ? "읽는 기간이 끝났어요."
              : `오늘은 ${schedule.totalDays}일 중 ${schedule.dayNumber}일째예요.`}
        </p>
        {schedule.pagesPerDay !== null && schedule.expectedPage !== null ? (
          <p>
            하루에 약 {schedule.pagesPerDay}쪽씩 읽으면 되고, 오늘까지{" "}
            {schedule.expectedPage}쪽(전체의 {percent}%)을 읽었으면 권장
            속도예요.
          </p>
        ) : (
          <p>
            오늘까지 전체의 {percent}%를 읽었으면 권장 속도예요. 책의 전체
            쪽수가 등록돼 있으면 하루 권장 쪽수도 알려 드려요.
          </p>
        )}
      </div>
      <ReadingCalendar months={months} />
    </>
  );
}
