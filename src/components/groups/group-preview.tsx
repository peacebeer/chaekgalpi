import type { ReactNode } from "react";

import { BookCover } from "@/components/groups/book-cover";
import { isWholeBook } from "@/lib/books/chapters";
import { periodLabel } from "@/lib/books/schedule";

export type GroupPreviewData = {
  name: string;
  capacity: number;
  memberCount: number;
  startDate: string | null;
  targetDate: string | null;
  isPublic: boolean;
  leaderNickname: string | null;
  book: {
    title: string;
    author: string | null;
    translator: string | null;
    publisher: string | null;
    pages: number | null;
    coverUrl: string | null;
  };
  chapters: { number: number; title: string }[];
};

// DB 함수 group_preview가 돌려준 목차(JSON)를 화면에서 쓰는 모양으로 바꾼다.
export function chaptersFromJson(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = item as { number?: unknown; title?: unknown };
    return typeof row?.number === "number" && typeof row.title === "string"
      ? [{ number: row.number, title: row.title }]
      : [];
  });
}

// 입장하기 전에 보여 주는 그룹 소개: 리더, 읽는 기간, 책, 목차
export function GroupPreview({
  data,
  children,
}: {
  data: GroupPreviewData;
  // 입장 버튼
  children: ReactNode;
}) {
  const { book } = data;
  const full = data.memberCount >= data.capacity;
  const facts = [
    ["리더", data.leaderNickname ?? "정보 없음"],
    [
      "읽는 기간",
      periodLabel(data.startDate, data.targetDate) ?? "정하지 않음",
    ],
    [
      "회원",
      `${data.memberCount}/${data.capacity}명${full ? " (가득 참)" : ""}`,
    ],
    ["모집", data.isPublic ? "공개 모집" : "초대 전용"],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-card flex flex-col gap-5 rounded-xl border p-5">
        <div className="flex items-start gap-4">
          <BookCover url={book.coverUrl} title={book.title} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">
              {data.name}
            </h2>
            <p className="font-medium">{book.title}</p>
            <p className="text-muted-foreground text-sm">
              {[
                book.author,
                book.translator && `${book.translator} 옮김`,
                book.publisher,
                book.pages && `${book.pages}쪽`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <dl className="divide-y rounded-lg border text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="flex gap-3 px-3 py-2">
              <dt className="text-muted-foreground w-20 shrink-0">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {children}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">목차</h2>
        {isWholeBook(data.chapters) || data.chapters.length === 0 ? (
          <p className="text-sm">
            목차 없이 만든 그룹이에요. 위치는 &ldquo;책 전체의 몇 %&rdquo;로
            나눠요.
          </p>
        ) : (
          <ol className="bg-card divide-y rounded-lg border text-sm">
            {data.chapters.map((chapter) => (
              <li key={chapter.number} className="px-3 py-2">
                <span className="text-muted-foreground mr-2 tabular-nums">
                  {chapter.number}
                </span>
                {chapter.title}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
