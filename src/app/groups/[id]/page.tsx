import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ExchangeSection } from "@/components/exchange/exchange-section";
import { BookCover } from "@/components/groups/book-cover";
import { ConfirmAction } from "@/components/groups/confirm-action";
import {
  chaptersFromJson,
  GroupPreview,
} from "@/components/groups/group-preview";
import { InviteLink } from "@/components/groups/invite-link";
import { JoinForm } from "@/components/groups/join-form";
import { ProgressForm } from "@/components/groups/progress-form";
import { ReadingPlan } from "@/components/groups/reading-plan";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { isWholeBook } from "@/lib/books/chapters";
import { buildPageMap } from "@/lib/books/pages";
import { overallPercent, positionLabel } from "@/lib/books/progress";
import {
  buildCalendar,
  buildSchedule,
  periodLabel,
  todayInSeoul,
} from "@/lib/books/schedule";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

import { removeMember } from "./settings/actions";

export const metadata: Metadata = { title: "그룹 · 책갈피" };

// 회원에게 보이는 화면 갈래. 주소의 ?tab= 값으로 고른다.
const TABS = [
  ["feed", "인용과 감상"],
  ["progress", "진도 현황"],
  ["book", "책 정보"],
  ["info", "그룹 정보"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function GroupPage({
  params,
  searchParams,
}: PageProps<"/groups/[id]">) {
  return (
    <main className="flex w-full flex-1 flex-col">
      <Suspense
        fallback={
          <p className="text-muted-foreground mx-auto w-full max-w-6xl px-4 py-8 text-sm sm:px-8">
            불러오는 중…
          </p>
        }
      >
        <GroupDetail params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function GroupDetail({
  params,
  searchParams,
}: Pick<PageProps<"/groups/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const groupId = uuidSchema.safeParse(id);
  if (!groupId.success) notFound();

  const requested = (await searchParams).tab;
  const tab: Tab =
    TABS.map(([key]) => key).find((key) => key === requested) ?? "feed";

  const user = await requireUser(`/groups/${groupId.data}`);
  const supabase = await createClient();

  // RLS: 공개 그룹이거나 내가 회원인 그룹만 조회된다.
  const { data: group } = await supabase
    .from("groups")
    .select(
      "id, name, capacity, start_date, target_date, is_public, is_demo, invite_code, owner_id, books(title, author, translator, publisher, isbn, pages, source, cover_url, book_chapters(number, title, start_page))",
    )
    .eq("id", groupId.data)
    .maybeSingle();
  if (!group) notFound();

  // RLS: 회원이 아니면 빈 목록이 온다.
  const { data: members } = await supabase
    .from("memberships")
    .select(
      "user_id, role, joined_at, progress_chapter, progress_pct, finished_at, profiles(nickname)",
    )
    .eq("group_id", group.id)
    .order("joined_at");

  const memberList = members ?? [];
  const me = memberList.find((member) => member.user_id === user.id);
  const isOwner = group.owner_id === user.id;
  const book = group.books;
  const chapters = [...book.book_chapters].sort((a, b) => a.number - b.number);
  const chapterOptions = chapters.map(({ number, title }) => ({
    number,
    title,
  }));
  const wholeBook = isWholeBook(chapters);
  const pageMap = buildPageMap(chapters, book.pages);
  const period = periodLabel(group.start_date, group.target_date);
  // 읽는 기간이 정해져 있으면 오늘까지의 권장 진도를 계산한다(한국 날짜 기준).
  const today = todayInSeoul();
  const schedule = buildSchedule(
    group.start_date,
    group.target_date,
    today,
    book.pages,
  );

  // 회원이 아니면(공개 그룹) 입장 전 소개만 받아 온다. 리더 이름은 직접 조회할 수 없다.
  const { data: previewRows } = me
    ? { data: null }
    : await supabase.rpc("group_preview", { p_group_id: group.id });
  const preview = previewRows?.[0];

  const bookFacts = [
    ["제목", book.title],
    ["저자", book.author],
    ["역자", book.translator],
    ["출판사", book.publisher],
    // ISBN은 판본마다 달라서, 어떤 판을 기준으로 삼았는지 알려 준다.
    ["판본 (ISBN)", book.isbn],
    ["전체 쪽수", book.pages ? `${book.pages}쪽` : null],
    [
      "정보 출처",
      book.source === "kakao"
        ? "카카오 책 검색"
        : book.source === "nlk"
          ? "국립중앙도서관"
          : "그룹 리더가 직접 입력",
    ],
  ] as const;

  const bookInfo = (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">대표 도서</h2>
      {book.cover_url && (
        <BookCover url={book.cover_url} title={book.title} size="lg" />
      )}
      <dl className="bg-card divide-y rounded-xl border text-sm">
        {bookFacts.map(([label, value]) => (
          <div key={label} className="flex gap-3 px-3 py-2">
            <dt className="text-muted-foreground w-24 shrink-0">{label}</dt>
            <dd>{value || "정보 없음"}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-sm">
        그룹의 위치 기준이 되는 책이에요. 다른 판본이나 번역본을 읽어도 참여할
        수 있어요.
      </p>
    </section>
  );

  const tableOfContents = (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">목차</h2>
      {wholeBook ? (
        <p className="text-sm">
          목차 없이 만든 그룹이에요. 위치는 &ldquo;책 전체의 몇 %&rdquo;로
          나눠요. 판본이 다르면 같은 %라도 내용이 조금 어긋날 수 있어요.
        </p>
      ) : (
        <>
          <ol className="bg-card divide-y rounded-xl border">
            {chapters.map((chapter) => (
              <li
                key={chapter.number}
                className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
              >
                <span>
                  <span className="text-muted-foreground mr-2 tabular-nums">
                    {chapter.number}
                  </span>
                  {chapter.title}
                </span>
                {chapter.start_page && (
                  <span className="text-muted-foreground tabular-nums">
                    {chapter.start_page}쪽
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground text-sm">
            이 목차가 그룹의 위치 기준이에요. 다른 판본을 읽는다면 가장 가까운
            장으로 맞춰 주세요.
          </p>
        </>
      )}
    </section>
  );

  return (
    <>
      <div className="bg-card border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pt-6 sm:px-8">
          <header className="flex items-center gap-4">
            <BookCover url={book.cover_url} title={book.title} size="md" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="text-2xl font-semibold tracking-tight">
                {group.name}
              </h1>
              <p className="text-muted-foreground text-sm">
                {[
                  book.title,
                  book.author && `${book.author} 지음`,
                  me && `회원 ${memberList.length}/${group.capacity}명`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </header>
          {group.is_demo && me && (
            <p className="bg-highlight text-highlight-foreground rounded-lg px-4 py-3 text-sm leading-6">
              체험 그룹이에요. 서연·도윤은 예시 회원이고, 내 진도는 1장 60%예요.
              흐리게 잠긴 글은 아직 안 읽은 곳의 글이에요.{" "}
              <strong>내 진도 기록</strong>에서 2장 이상으로 올리면 열려요.
            </p>
          )}
          {me ? (
            <nav aria-label="그룹 화면" className="flex gap-1 overflow-x-auto">
              {TABS.map(([key, label]) => (
                <Link
                  key={key}
                  href={
                    key === "feed"
                      ? `/groups/${group.id}`
                      : `/groups/${group.id}?tab=${key}`
                  }
                  aria-current={tab === key ? "page" : undefined}
                  className={
                    tab === key
                      ? "border-primary shrink-0 border-b-[3px] px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
                      : "text-muted-foreground hover:text-foreground shrink-0 border-b-[3px] border-transparent px-4 py-2.5 text-sm whitespace-nowrap"
                  }
                >
                  {label}
                </Link>
              ))}
            </nav>
          ) : (
            <div className="pb-1" />
          )}
        </div>
      </div>

      <div
        className={`mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-8 ${
          me && tab === "feed" ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        {!me && preview && (
          <GroupPreview
            data={{
              name: preview.name,
              capacity: preview.capacity,
              memberCount: preview.member_count,
              startDate: preview.start_date,
              targetDate: preview.target_date,
              isPublic: preview.is_public,
              leaderNickname: preview.leader_nickname,
              book: {
                title: preview.book_title,
                author: preview.book_author,
                translator: preview.book_translator,
                publisher: preview.book_publisher,
                pages: preview.book_pages,
                coverUrl: preview.book_cover_url,
              },
              chapters: chaptersFromJson(preview.chapters),
            }}
          >
            <JoinForm groupId={group.id} />
          </GroupPreview>
        )}

        {me && (
          <>
            {tab === "feed" && (
              <ExchangeSection
                groupId={group.id}
                userId={user.id}
                isOwner={isOwner}
                bookTitle={book.title}
                chapters={chapterOptions}
                wholeBook={wholeBook}
                progress={{
                  chapter: me.progress_chapter,
                  pct: Number(me.progress_pct),
                  finished: Boolean(me.finished_at),
                }}
                members={memberList.map((member) => ({
                  id: member.user_id,
                  nickname: member.profiles?.nickname ?? "독자",
                  chapter: member.progress_chapter,
                  pct: Number(member.progress_pct),
                  finished: Boolean(member.finished_at),
                  isMe: member.user_id === user.id,
                }))}
                expectedPercent={schedule?.expectedPercent ?? null}
                pageMap={pageMap}
                progressForm={
                  <ProgressForm
                    groupId={group.id}
                    chapters={chapterOptions}
                    wholeBook={wholeBook}
                    canUsePages={chapters.every(
                      (chapter) => chapter.start_page,
                    )}
                    initial={{
                      chapter: me.progress_chapter,
                      pct: Number(me.progress_pct),
                      finished: Boolean(me.finished_at),
                    }}
                  />
                }
              />
            )}

            {tab === "progress" && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">읽는 기간</h2>
                <ReadingPlan
                  schedule={schedule}
                  period={period}
                  months={
                    schedule && group.start_date && group.target_date
                      ? buildCalendar(
                          group.start_date,
                          group.target_date,
                          today,
                        )
                      : []
                  }
                  isOwner={isOwner}
                />

                <h2 className="pt-4 text-lg font-semibold">
                  진도 현황 · 회원 {memberList.length}/{group.capacity}명
                </h2>
                <ul className="flex flex-col gap-3">
                  {schedule && (
                    <li className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium">오늘의 권장 진도</span>
                        <span className="text-muted-foreground tabular-nums">
                          {schedule.expectedPage !== null
                            ? schedule.expectedPage + "쪽 · "
                            : ""}
                          {Math.round(schedule.expectedPercent)}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label="오늘의 권장 진도"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(schedule.expectedPercent)}
                        className="bg-muted h-2 overflow-hidden rounded-full"
                      >
                        <div
                          className="bg-highlight-foreground h-full rounded-full"
                          style={{ width: schedule.expectedPercent + "%" }}
                        />
                      </div>
                    </li>
                  )}
                  {memberList.map((member) => {
                    const position = {
                      chapter: member.progress_chapter,
                      pct: Number(member.progress_pct),
                    };
                    const finished = Boolean(member.finished_at);
                    const percent = overallPercent(
                      position,
                      chapters.length,
                      finished,
                    );
                    return (
                      <li key={member.user_id} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span>
                            {member.profiles?.nickname ?? "독자"}
                            {member.role === "owner" ? " (리더)" : ""}
                            {member.user_id === user.id ? " · 나" : ""}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {positionLabel(position, wholeBook, finished)}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${member.profiles?.nickname ?? "독자"} 진도`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(percent)}
                          className="bg-muted h-2 overflow-hidden rounded-full"
                        >
                          <div
                            className="bg-foreground h-full rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-muted-foreground text-sm">
                  막대는 장마다 길이가 같다고 보고 어림한 값이에요.
                </p>
              </section>
            )}

            {tab === "book" && (
              <>
                {bookInfo}
                {tableOfContents}
              </>
            )}

            {tab === "info" && (
              <>
                <section className="flex flex-col gap-2 text-sm">
                  <h2 className="text-lg font-semibold">그룹</h2>
                  <p>
                    {group.is_public ? "공개 그룹" : "초대 전용 그룹"} · 정원{" "}
                    {group.capacity}명{period ? ` · ${period}` : ""}
                  </p>
                  {isOwner && (
                    <div className="flex flex-col gap-1 pt-1">
                      <div>
                        <Link
                          href={`/groups/${group.id}/settings`}
                          className={buttonVariants({ variant: "outline" })}
                        >
                          그룹 설정
                        </Link>
                      </div>
                      <p className="text-muted-foreground">
                        이름·정원·기간·공개 여부를 바꾸거나 회원을 관리하고
                        그룹을 삭제할 수 있어요.
                      </p>
                    </div>
                  )}
                </section>

                {!group.is_demo && (
                  <section className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold">초대 링크</h2>
                    <InviteLink code={group.invite_code} />
                    <p className="text-muted-foreground text-sm">
                      이 링크를 받은 사람은 로그인한 뒤 그룹에 들어올 수 있어요.
                    </p>
                  </section>
                )}

                {!isOwner && (
                  <section className="flex flex-col gap-2 border-t pt-6">
                    <div>
                      <ConfirmAction
                        action={removeMember}
                        fields={{ groupId: group.id, userId: user.id }}
                        label="그룹 나가기"
                        question="이 그룹에서 나갈까요? 내가 쓴 감상은 그룹에 남고, 진도 기록은 지워져요."
                        confirmLabel="나가기"
                      />
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
