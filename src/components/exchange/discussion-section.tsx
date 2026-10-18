import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { placeLabel, type PageMap } from "@/lib/books/pages";
import {
  buildDiscussion,
  type DiscussionMember,
  type DiscussionNote,
} from "@/lib/exchange/discussion";
import { createClient } from "@/lib/supabase/server";

type DiscussionSectionProps = {
  groupId: string;
  chapters: { number: number; title: string }[];
  wholeBook: boolean;
  members: DiscussionMember[];
  range: { from: number; to: number };
  pageMap: PageMap | null;
};

const CARD = "bg-card flex flex-col gap-3 rounded-xl border p-5";
const FORMER_MEMBER = "나간 회원";

function Block({
  title,
  hint,
  empty,
  children,
}: {
  title: string;
  hint: string;
  empty: string | null;
  children: ReactNode;
}) {
  return (
    <section className={CARD}>
      <div className="flex flex-col gap-0.5">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{hint}</p>
      </div>
      {empty ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        children
      )}
    </section>
  );
}

// 토론 준비: 고른 장 범위에서 나온 이야기 거리를 모아 보여 준다(AI 없이 계산).
// 글은 내 권한(RLS)으로 읽으므로 내가 아직 안 읽은 곳의 글은 처음부터 들어오지 않는다.
export async function DiscussionSection({
  groupId,
  chapters,
  wholeBook,
  members,
  range,
  pageMap,
}: DiscussionSectionProps) {
  const supabase = await createClient();
  const [{ data: quotes }, { data: notes }, { data: locked }] =
    await Promise.all([
      supabase
        .from("quotes")
        .select("id, chapter, pct, text, created_by, locked_at, created_at")
        .eq("group_id", groupId),
      supabase
        .from("notes")
        .select(
          "id, chapter, pct, kind, body, quote_id, parent_id, author_id, hidden_at, created_at, reactions(user_id)",
        )
        .eq("group_id", groupId),
      supabase.rpc("locked_counts", { p_group_id: groupId }),
    ]);

  const discussion = buildDiscussion({
    quotes: (quotes ?? []).map((row) => ({
      id: row.id,
      chapter: row.chapter,
      pct: Number(row.pct),
      text: row.text,
      createdBy: row.created_by,
      locked: Boolean(row.locked_at),
      createdAt: row.created_at,
    })),
    notes: (notes ?? []).map((row) => ({
      id: row.id,
      chapter: row.chapter,
      pct: row.pct === null ? null : Number(row.pct),
      kind: row.kind,
      body: row.body,
      quoteId: row.quote_id,
      parentId: row.parent_id,
      authorId: row.author_id,
      hidden: Boolean(row.hidden_at),
      createdAt: row.created_at,
      likedBy: row.reactions.map((reaction) => reaction.user_id),
    })),
    members,
    chapterCount: chapters.length,
    from: range.from,
    to: range.to,
  });

  // 책 전체 글의 잠긴 개수는 장 없이(null) 온다.
  const lockedInRange = (locked ?? [])
    .filter((row) =>
      (row.chapter as number | null) === null
        ? range.to === chapters.length
        : row.chapter >= range.from && row.chapter <= range.to,
    )
    .reduce((sum, row) => sum + Number(row.quotes) + Number(row.notes), 0);

  const nicknames = new Map(
    members.map((member) => [member.id, member.nickname]),
  );
  const nameOf = (id: string | null) =>
    (id && nicknames.get(id)) || FORMER_MEMBER;
  const where = (item: { chapter: number | null; pct: number | null }) =>
    placeLabel(item, wholeBook, pageMap);
  const feedLink = (anchor: string) => `/groups/${groupId}#${anchor}`;
  const notReady = discussion.participation.filter((item) => !item.readThrough);
  const busiest = Math.max(
    1,
    ...discussion.chapters.map((item) => item.quotes + item.notes),
  );
  const rangeName = wholeBook
    ? "책 전체"
    : range.from === range.to
      ? `${range.from}장`
      : `${range.from}~${range.to}장`;
  // "1~3장을" / "책 전체를"
  const rangeObject = `${rangeName}${wholeBook ? "를" : "을"}`;

  const noteItem = (item: DiscussionNote, meta: string) => (
    <li key={item.id}>
      <Link
        href={feedLink(`note-${item.id}`)}
        className="hover:bg-accent -mx-2 flex flex-col gap-1 rounded-lg px-2 py-2"
      >
        <span className="line-clamp-2">{item.body}</span>
        <span className="text-muted-foreground text-xs">
          {nameOf(item.authorId)} · {where(item)} · {meta}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">토론 준비 도우미</h2>
        {!wholeBook && (
          <form
            method="get"
            className="bg-card flex flex-wrap items-end gap-2 rounded-xl border p-4"
          >
            <input type="hidden" name="tab" value="discuss" />
            {(
              [
                ["from", "시작 장", range.from],
                ["to", "끝 장", range.to],
              ] as const
            ).map(([name, label, value]) => (
              <label key={name} className="flex flex-col gap-1 text-sm">
                {label}
                <select
                  name={name}
                  defaultValue={value}
                  className="border-input h-9 max-w-48 rounded-lg border bg-transparent px-2"
                >
                  {chapters.map((chapter) => (
                    <option key={chapter.number} value={chapter.number}>
                      {chapter.number}. {chapter.title}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <Button type="submit" variant="outline">
              이 범위로 보기
            </Button>
          </form>
        )}
        <p className="text-muted-foreground text-sm leading-6">
          {rangeName}에서 나온 이야기를 모았어요. 모임에서 무엇을 이야기할지
          고를 때 써 보세요.
          {lockedInRange > 0 &&
            ` 내가 아직 읽지 않은 곳의 글 ${lockedInRange}개는 빠져 있어요.`}
        </p>
        {notReady.length > 0 && (
          <p className="bg-highlight text-highlight-foreground rounded-lg px-4 py-3 text-sm leading-6">
            {notReady.map((item) => item.member.nickname).join(", ")} 님은 아직{" "}
            {rangeObject} 다 읽지 않았어요. 토론에서 뒷부분 이야기는 조심해
            주세요.
          </p>
        )}
      </section>

      <Block
        title="답을 기다리는 질문"
        hint="아직 답글이 없는 질문이에요. 모임에서 함께 이야기하기 좋아요."
        empty={
          discussion.openQuestions.length === 0
            ? "답을 기다리는 질문이 없어요."
            : null
        }
      >
        <ul className="flex flex-col">
          {discussion.openQuestions.map((item) => noteItem(item, "질문"))}
        </ul>
      </Block>

      <Block
        title="공감을 많이 받은 감상"
        hint="좋아요가 많은 감상이에요. 왜 공감했는지 이야기를 시작해 보세요."
        empty={
          discussion.likedNotes.length === 0
            ? "아직 좋아요를 받은 감상이 없어요."
            : null
        }
      >
        <ul className="flex flex-col">
          {discussion.likedNotes.map((item) =>
            noteItem(
              item,
              `좋아요 ${item.likes}${item.replies ? ` · 답글 ${item.replies}` : ""}`,
            ),
          )}
        </ul>
      </Block>

      <Block
        title="이야기가 많은 문장"
        hint="감상이 많이 달린 인용 카드예요."
        empty={
          discussion.busyQuotes.length === 0
            ? "아직 감상이 달린 인용 카드가 없어요."
            : null
        }
      >
        <ul className="flex flex-col">
          {discussion.busyQuotes.map((item) => (
            <li key={item.id}>
              <Link
                href={feedLink(`quote-${item.id}`)}
                className="hover:bg-accent -mx-2 flex flex-col gap-1 rounded-lg px-2 py-2"
              >
                <span className="font-quote line-clamp-2">“{item.text}”</span>
                <span className="text-muted-foreground text-xs">
                  {nameOf(item.createdBy)} · {where(item)} · 감상 {item.talk}개
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Block>

      {!wholeBook && (
        <Block
          title="장별 이야기 양"
          hint="글이 많이 모인 장일수록 막대가 길어요."
          empty={null}
        >
          <ul className="flex flex-col gap-2 text-sm">
            {discussion.chapters.map((item) => {
              const total = item.quotes + item.notes;
              return (
                <li key={item.chapter} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate">
                    {item.chapter}.{" "}
                    {chapters.find((c) => c.number === item.chapter)?.title}
                  </span>
                  <span className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <span
                      className="bg-primary block h-full rounded-full"
                      style={{ width: `${(total / busiest) * 100}%` }}
                    />
                  </span>
                  <span className="text-muted-foreground w-24 shrink-0 text-right tabular-nums">
                    카드 {item.quotes} · 글 {item.notes}
                  </span>
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      <Block
        title="회원별 참여"
        hint={`${rangeName}에 남긴 글 수와 읽은 정도예요.`}
        empty={null}
      >
        <ul className="flex flex-col gap-1 text-sm">
          {discussion.participation.map((item) => (
            <li key={item.member.id} className="flex justify-between gap-3">
              <span>{item.member.nickname}</span>
              <span className="text-muted-foreground tabular-nums">
                글 {item.posts}개 ·{" "}
                {item.readThrough ? "범위 다 읽음" : "아직 읽는 중"}
              </span>
            </li>
          ))}
        </ul>
      </Block>
    </div>
  );
}
