import { overallPercent, positionLabel } from "@/lib/books/progress";

export type LineMember = {
  id: string;
  nickname: string;
  chapter: number;
  pct: number;
  finished: boolean;
  isMe: boolean;
};

type ProgressLineProps = {
  members: LineMember[];
  chapterCount: number;
  wholeBook: boolean;
};

// 회원을 구분하는 점 색. 나는 항상 대표색(초록)이고, 다른 회원은 순서대로 받는다.
// 색만으로 구분하지 않도록 아래 목록에 이름과 위치를 함께 적는다.
const OTHER_COLORS = [
  "#b4532a",
  "#2f6fa8",
  "#8a5a9e",
  "#a6791b",
  "#3c8c8c",
  "#9b3d5a",
  "#5e6b2e",
];

// 책 한 권을 한 줄로 펴고, 회원 모두가 어디쯤 읽고 있는지 점으로 찍는다.
// 위치는 장마다 길이가 같다고 본 어림값이다.
export function ProgressLine({
  members,
  chapterCount,
  wholeBook,
}: ProgressLineProps) {
  let otherIndex = 0;
  const dots = members.map((member) => ({
    ...member,
    color: member.isMe
      ? "var(--primary)"
      : OTHER_COLORS[otherIndex++ % OTHER_COLORS.length],
    percent: overallPercent(member, chapterCount, member.finished),
  }));
  const mine = dots.find((dot) => dot.isMe);
  // 장이 많으면 눈금이 겹치므로 8장까지만 장마다 눈금을 긋는다.
  const ticks =
    !wholeBook && chapterCount > 1 && chapterCount <= 8
      ? Array.from({ length: chapterCount - 1 }, (_, index) => index + 1)
      : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="px-2 pt-2 pb-1">
        <div className="bg-muted relative h-2 rounded-full" aria-hidden>
          {mine && (
            <div
              className="bg-primary/35 h-2 rounded-full"
              style={{ width: `${mine.percent}%` }}
            />
          )}
          {ticks.map((tick) => (
            <span
              key={tick}
              className="bg-card absolute top-0 h-2 w-0.5"
              style={{ left: `${(tick / chapterCount) * 100}%` }}
            />
          ))}
          {dots.map((dot) => (
            <span
              key={dot.id}
              className="border-card absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: `${dot.percent}%`, backgroundColor: dot.color }}
            />
          ))}
        </div>
        <div
          className="text-muted-foreground mt-2 flex justify-between text-xs"
          aria-hidden
        >
          <span>처음</span>
          <span>끝</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {dots.map((dot) => (
          <li key={dot.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: dot.color }}
                aria-hidden
              />
              <span
                className={dot.isMe ? "truncate font-semibold" : "truncate"}
              >
                {dot.nickname}
                {dot.isMe ? " · 나" : ""}
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {positionLabel(dot, wholeBook, dot.finished)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
