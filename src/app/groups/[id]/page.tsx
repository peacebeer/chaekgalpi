import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ExchangeSection } from "@/components/exchange/exchange-section";
import { ConfirmAction } from "@/components/groups/confirm-action";
import { InviteLink } from "@/components/groups/invite-link";
import { JoinForm } from "@/components/groups/join-form";
import { ProgressForm } from "@/components/groups/progress-form";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { isWholeBook } from "@/lib/books/chapters";
import { overallPercent, positionLabel } from "@/lib/books/progress";
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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-8">
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">불러오는 중…</p>}
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
      "id, name, capacity, start_date, target_date, is_public, invite_code, owner_id, books(title, author, translator, publisher, isbn, pages, source, book_chapters(number, title, start_page))",
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
  const period = [group.start_date, group.target_date].some(Boolean)
    ? `${group.start_date ?? "시작일 미정"} ~ ${group.target_date ?? "완독일 미정"}`
    : null;

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
      book.source === "nlk" ? "국립중앙도서관" : "그룹 리더가 직접 입력",
    ],
  ] as const;

  const bookInfo = (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">대표 도서</h2>
      <dl className="divide-y rounded-lg border text-sm">
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
          <ol className="divide-y rounded-lg border">
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
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
        <p className="text-sm">
          <span className="font-medium">{book.title}</span>
          <span className="text-muted-foreground">
            {[book.author, book.translator && `${book.translator} 옮김`]
              .filter(Boolean)
              .map((text) => ` · ${text}`)
              .join("")}
          </span>
        </p>
      </header>

      {!me && (
        <>
          <section className="flex flex-col gap-3 rounded-lg border p-4">
            <p className="text-sm">
              공개 그룹이에요. 정원은 {group.capacity}명이고, 입장하면 회원과
              감상을 볼 수 있어요.
            </p>
            <JoinForm groupId={group.id} />
          </section>
          {bookInfo}
          {tableOfContents}
        </>
      )}

      {me && (
        <>
          <nav
            aria-label="그룹 화면"
            className="flex gap-1 overflow-x-auto border-b"
          >
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
                    ? "border-foreground -mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap"
                    : "text-muted-foreground hover:text-foreground -mb-px shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap"
                }
              >
                {label}
              </Link>
            ))}
          </nav>

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
              nicknames={Object.fromEntries(
                memberList.map((member) => [
                  member.user_id,
                  member.profiles?.nickname ?? "독자",
                ]),
              )}
              progressForm={
                <ProgressForm
                  groupId={group.id}
                  chapters={chapterOptions}
                  wholeBook={wholeBook}
                  canUsePages={chapters.every((chapter) => chapter.start_page)}
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
              <h2 className="text-lg font-semibold">
                진도 현황 · 회원 {memberList.length}/{group.capacity}명
              </h2>
              <ul className="flex flex-col gap-3">
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
                      이름·정원·기간·공개 여부를 바꾸거나 회원을 관리하고 그룹을
                      삭제할 수 있어요.
                    </p>
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">초대 링크</h2>
                <InviteLink code={group.invite_code} />
                <p className="text-muted-foreground text-sm">
                  이 링크를 받은 사람은 로그인한 뒤 그룹에 들어올 수 있어요.
                </p>
              </section>

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
    </>
  );
}
