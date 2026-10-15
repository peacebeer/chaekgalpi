import type { ReactNode } from "react";

import {
  deleteNote,
  deleteQuote,
  setNoteHidden,
  toggleLike,
  updateNote,
  updateQuote,
} from "@/app/groups/[id]/exchange-actions";
import { ActionGroup } from "@/components/action-group";
import { CollapsibleNav } from "@/components/exchange/collapsible-nav";
import { Composer } from "@/components/exchange/composer";
import { EditForm } from "@/components/exchange/edit-form";
import { NoteForm } from "@/components/exchange/note-form";
import type { PickerProgress } from "@/components/exchange/position-picker";
import { ToolPanels } from "@/components/exchange/tool-panels";
import { ConfirmAction } from "@/components/groups/confirm-action";
import {
  ProgressLine,
  type LineMember,
} from "@/components/groups/progress-line";
import { Button } from "@/components/ui/button";
import { positionToPage, type PageMap } from "@/lib/books/pages";
import { positionLabel } from "@/lib/books/progress";
import {
  buildFeed,
  kindLabel,
  lockedLabel,
  type FeedNote,
  type FeedThread,
  type LockedCount,
} from "@/lib/exchange/feed";
import { createClient } from "@/lib/supabase/server";

type ExchangeSectionProps = {
  groupId: string;
  userId: string;
  isOwner: boolean;
  bookTitle: string;
  chapters: { number: number; title: string }[];
  wholeBook: boolean;
  progress: PickerProgress;
  // 진도선에 찍을 회원들(지금 그룹에 있는 회원만)
  members: LineMember[];
  // 읽는 기간이 정해져 있을 때 오늘까지의 권장 진도(0~100)
  expectedPercent: number | null;
  // "진도 기록" 버튼을 누르면 펼쳐질 입력 칸
  progressForm: ReactNode;
  // 쪽수로 위치를 주고받을 수 있으면 그 정보(없으면 장 + %)
  pageMap: PageMap | null;
};

const FORMER_MEMBER = "나간 회원";
const CARD = "bg-card rounded-xl border";
// 수정·삭제·답글·숨기기 같은 보조 버튼 묶음: 줄의 남은 폭을 차지하고 오른쪽 끝에 붙인다.
// 눌러서 펼쳐지는 입력 칸·확인 칸은 이 묶음 안에서 버튼 아래 줄에 놓여, 버튼이 움직이지 않는다.
const ACTIONS = "flex min-w-0 flex-1 flex-wrap items-start justify-end gap-1";

// 이름 첫 글자를 넣은 동그라미
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`bg-secondary text-secondary-foreground flex shrink-0 items-center justify-center rounded-full font-semibold ${
        small ? "size-7 text-xs" : "size-9 text-sm"
      }`}
    >
      {Array.from(name)[0] ?? "?"}
    </span>
  );
}

// 교환 독서 화면의 본문: 함께 읽는 진도와 목차(옆 칸), 글 남기기와 인용·감상 목록(가운데).
// 여기서 읽는 행은 모두 RLS를 통과한 것(내 진도 이하)뿐이다. 잠긴 글은 개수만 따로 받는다.
export async function ExchangeSection({
  groupId,
  userId,
  isOwner,
  bookTitle,
  chapters,
  wholeBook,
  progress,
  members,
  expectedPercent,
  progressForm,
  pageMap,
}: ExchangeSectionProps) {
  const supabase = await createClient();
  const [{ data: quotes }, { data: notes }, { data: locked }, { data: usage }] =
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
      supabase.rpc("quote_usage", { p_group_id: groupId }),
    ]);

  const feed = buildFeed(
    (quotes ?? []).map((row) => ({
      id: row.id,
      chapter: row.chapter,
      pct: Number(row.pct),
      text: row.text,
      createdBy: row.created_by,
      locked: Boolean(row.locked_at),
      createdAt: row.created_at,
    })),
    (notes ?? []).map((row) => ({
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
  );

  const lockedCounts: LockedCount[] = (locked ?? []).map((row) => ({
    chapter: row.chapter,
    quotes: Number(row.quotes),
    notes: Number(row.notes),
  }));
  const lockedByChapter = new Map(
    lockedCounts.map((row) => [row.chapter, row]),
  );
  const quota = usage?.[0]
    ? { used: usage[0].used, limit: usage[0].quote_limit }
    : null;

  // 열린 글이 있는 장과 잠긴 글만 있는 장을 함께, 장 순서대로 보여 준다.
  const sectionKeys = [
    ...new Set([
      ...feed.map((section) => section.chapter),
      ...lockedCounts.map((row) => row.chapter),
    ]),
  ].sort((a, b) => (a ?? Infinity) - (b ?? Infinity));
  const threadsByChapter = new Map(
    feed.map((section) => [section.chapter, section.threads]),
  );
  const chapterTitle = new Map(
    chapters.map((chapter) => [chapter.number, chapter.title]),
  );
  const nicknames = new Map(
    members.map((member) => [member.id, member.nickname]),
  );
  const nameOf = (id: string | null) =>
    (id && nicknames.get(id)) || FORMER_MEMBER;

  const renderNote = (note: FeedNote, isReply = false) => {
    const liked = note.likedBy.includes(userId);
    const mine = note.authorId === userId;
    const name = nameOf(note.authorId);
    const tagged = note.kind === "question" || note.kind === "summary";

    return (
      <li
        key={note.id}
        id={`note-${note.id}`}
        className={
          isReply
            ? "bg-background flex scroll-mt-4 gap-2.5 rounded-lg p-3"
            : "flex scroll-mt-4 gap-3"
        }
      >
        <Avatar name={name} small={isReply} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
            <span className="text-foreground font-semibold">{name}</span>
            {isReply ? (
              <span>답글</span>
            ) : (
              <span
                className={
                  tagged
                    ? "bg-highlight text-highlight-foreground rounded-md px-2"
                    : undefined
                }
              >
                {kindLabel(note.kind)}
              </span>
            )}
            {note.hidden && (
              <span>리더가 숨긴 글(다른 회원에게는 안 보여요)</span>
            )}
          </p>
          <p className="leading-7 whitespace-pre-wrap">{note.body}</p>

          {/* 위쪽 맞춤: 오른쪽 묶음이 아래로 펼쳐져도 좋아요가 따라 내려가지 않는다 */}
          <div className="flex flex-wrap items-start gap-2">
            <form action={toggleLike}>
              <input type="hidden" name="noteId" value={note.id} />
              <input type="hidden" name="liked" value={String(liked)} />
              <Button
                type="submit"
                size="sm"
                variant={liked ? "default" : "outline"}
                aria-pressed={liked}
                aria-label={liked ? "좋아요 취소" : "좋아요"}
              >
                ♥ {note.likedBy.length}
              </Button>
            </form>
            {note.likedBy.length > 0 && (
              <span className="text-muted-foreground py-1 text-sm">
                {note.likedBy.map((id) => nameOf(id)).join(", ")}
              </span>
            )}
            {/* 좋아요를 뺀 버튼은 모양을 맞춰 오른쪽 가장자리에 모은다 */}
            <ActionGroup className={ACTIONS}>
              {!isReply && (
                <NoteForm
                  groupId={groupId}
                  target={{ parentId: note.id }}
                  label="답글"
                  placeholder="답글을 적어 주세요"
                />
              )}
              {mine && (
                <>
                  <EditForm
                    action={updateNote}
                    fields={{ noteId: note.id }}
                    name="body"
                    initial={note.body}
                    label="수정"
                  />
                  <ConfirmAction
                    action={deleteNote}
                    fields={{ noteId: note.id }}
                    triggerVariant="ghost"
                    label="삭제"
                    question={
                      note.replies.length > 0
                        ? `이 글을 지울까요? 달린 답글 ${note.replies.length}개도 함께 지워져요.`
                        : "이 글을 지울까요? 되돌릴 수 없어요."
                    }
                    confirmLabel="삭제"
                  />
                </>
              )}
              {isOwner && (
                <form action={setNoteHidden}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <input
                    type="hidden"
                    name="hidden"
                    value={String(!note.hidden)}
                  />
                  <Button type="submit" size="sm" variant="ghost">
                    {note.hidden ? "다시 보이기" : "숨기기"}
                  </Button>
                </form>
              )}
            </ActionGroup>
          </div>

          {note.replies.length > 0 && (
            <ul className="flex flex-col gap-2 pt-1">
              {note.replies.map((reply) => renderNote(reply, true))}
            </ul>
          )}
        </div>
      </li>
    );
  };

  const renderThread = (thread: FeedThread, chapter: number | null) => {
    const where =
      chapter === null
        ? "책 전체"
        : pageMap
          ? `${wholeBook ? "" : `${chapter}장 · `}${positionToPage(pageMap, { chapter, pct: thread.pct })}쪽`
          : positionLabel({ chapter, pct: thread.pct }, wholeBook);

    if (thread.type === "note") {
      return (
        <li key={thread.id} className={`${CARD} flex flex-col gap-3 p-5`}>
          <p className="text-muted-foreground text-sm">{where}</p>
          <ul className="flex flex-col gap-5">{renderNote(thread.note)}</ul>
        </li>
      );
    }

    const isCreator = thread.createdBy === userId;
    // 등록자는 잠기기 전에는 자유롭게 고친다. 잠긴 뒤와 리더는 오타 수정만.
    const typoOnly = thread.locked || !isCreator;
    const noteCount = thread.notes.reduce(
      (sum, note) => sum + 1 + note.replies.length,
      0,
    );

    return (
      <li
        key={thread.id}
        id={`quote-${thread.id}`}
        className={`${CARD} scroll-mt-4 overflow-hidden`}
      >
        <figure className="bg-accent flex flex-col gap-3 px-6 pt-5 pb-6">
          <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="bg-primary text-primary-foreground rounded-md px-2">
              인용
            </span>
            <span>
              『{bookTitle}』 {where} · {nameOf(thread.createdBy)} 님이 옮김
            </span>
          </figcaption>
          <span
            aria-hidden
            className="font-quote text-primary -mb-3 h-7 text-6xl leading-none select-none"
          >
            “
          </span>
          <blockquote className="font-quote text-xl leading-loose whitespace-pre-wrap sm:text-[1.375rem]">
            {thread.text}
          </blockquote>
          {(isCreator || isOwner) && (
            <ActionGroup className={ACTIONS}>
              <EditForm
                action={updateQuote}
                fields={{ quoteId: thread.id }}
                name="text"
                initial={thread.text}
                label="인용문 수정"
                hint={
                  typoOnly
                    ? isCreator
                      ? "다른 회원의 감상이 달린 카드라 오타 수정(10자 이내)만 할 수 있어요."
                      : "다른 회원이 옮긴 문장이라 오타 수정(10자 이내)만 할 수 있어요."
                    : undefined
                }
              />
              {isCreator && !thread.locked && (
                <ConfirmAction
                  action={deleteQuote}
                  fields={{ quoteId: thread.id }}
                  triggerVariant="ghost"
                  label="카드 삭제"
                  question="이 인용 카드와 내 감상을 지울까요? 되돌릴 수 없어요."
                  confirmLabel="삭제"
                />
              )}
              {isOwner && (thread.locked || !isCreator) && (
                <ConfirmAction
                  action={deleteQuote}
                  fields={{ quoteId: thread.id, asLeader: "true" }}
                  triggerVariant="ghost"
                  label="카드 내리기 (리더)"
                  question={`이 인용 카드를 내릴까요? 카드에 달린 감상·답글 ${noteCount}개도 함께 지워지고 되돌릴 수 없어요.`}
                  confirmLabel="내리기"
                />
              )}
            </ActionGroup>
          )}
        </figure>
        <div className="flex flex-col gap-5 px-6 py-5">
          <ul className="flex flex-col gap-5">
            {thread.notes.map((note) => renderNote(note))}
          </ul>
          <div>
            <NoteForm
              groupId={groupId}
              target={{ quoteId: thread.id }}
              variant="outline"
              label="이 문장에 감상 남기기"
              placeholder="이 문장을 읽고 든 생각"
            />
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="text-muted-foreground text-sm font-semibold">
            함께 읽는 진도
          </h2>
          <ProgressLine
            members={members}
            chapterCount={chapters.length}
            wholeBook={wholeBook}
            expectedPercent={expectedPercent}
          />
          <ToolPanels
            panels={[
              { id: "progress", label: "내 진도 기록", content: progressForm },
            ]}
          />
        </section>

        {!wholeBook && (
          <CollapsibleNav
            title="목차"
            summary={`${chapters.length}개 장`}
            className={`${CARD} flex flex-col gap-1 p-3`}
          >
            {chapters.map((chapter) => {
              const open = threadsByChapter.get(chapter.number)?.length ?? 0;
              const lockedHere = lockedByChapter.get(chapter.number);
              const lockedTotal = lockedHere
                ? lockedHere.quotes + lockedHere.notes
                : 0;
              const current = chapter.number === progress.chapter;
              const label = (
                <>
                  <span className="min-w-0 truncate">
                    <span className="mr-1.5 tabular-nums">
                      {chapter.number}
                    </span>
                    {chapter.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {open > 0 ? `글 ${open}` : ""}
                    {open > 0 && lockedTotal > 0 ? " · " : ""}
                    {lockedTotal > 0 ? `잠김 ${lockedTotal}` : ""}
                  </span>
                </>
              );
              const rowClass = `flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm ${
                current ? "bg-accent font-medium" : ""
              }`;

              // 글이 있는 장만 그 자리로 건너뛸 수 있다.
              return open > 0 || lockedTotal > 0 ? (
                <a
                  key={chapter.number}
                  href={`#chapter-${chapter.number}`}
                  aria-current={current ? "location" : undefined}
                  className={`${rowClass} hover:bg-accent`}
                >
                  {label}
                </a>
              ) : (
                <div
                  key={chapter.number}
                  className={`${rowClass} text-muted-foreground`}
                >
                  {label}
                </div>
              );
            })}
          </CollapsibleNav>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className={`${CARD} p-4`}>
          <ToolPanels
            panels={[
              {
                id: "compose",
                label: "글 남기기",
                content: (
                  <Composer
                    // 진도를 저장하면 고를 수 있는 위치가 달라지므로 새로 만든다.
                    key={`${progress.chapter}-${progress.pct}-${progress.finished}`}
                    groupId={groupId}
                    chapters={chapters}
                    wholeBook={wholeBook}
                    progress={progress}
                    quota={quota}
                    pageMap={pageMap}
                  />
                ),
              },
            ]}
            hint="마음에 남은 문장이나 생각을 남겨 보세요."
          />
        </div>

        <section className="flex flex-col gap-8">
          <h2 className="sr-only">인용과 감상</h2>
          {sectionKeys.length === 0 && (
            <p className="text-muted-foreground text-sm">
              아직 글이 없어요. 위의 &ldquo;글 남기기&rdquo;로 마음에 남은
              문장이나 생각을 처음으로 남겨 보세요.
            </p>
          )}
          {sectionKeys.map((chapter) => {
            const threads = threadsByChapter.get(chapter) ?? [];
            const lockedHere = lockedByChapter.get(chapter);
            const heading =
              chapter === null
                ? "책 전체"
                : wholeBook
                  ? "책 전체 흐름"
                  : `${chapter}장 ${chapterTitle.get(chapter) ?? ""}`.trim();

            return (
              <div key={chapter ?? "whole"} className="flex flex-col gap-3">
                <h3
                  id={chapter === null ? "chapter-whole" : `chapter-${chapter}`}
                  className="text-muted-foreground scroll-mt-4 text-sm font-semibold"
                >
                  {heading}
                </h3>
                {threads.length > 0 && (
                  <ul className="flex flex-col gap-4">
                    {threads.map((thread) => renderThread(thread, chapter))}
                  </ul>
                )}
                {lockedHere && (
                  <div
                    className="border-input flex flex-col gap-3 rounded-xl border border-dashed p-5"
                    data-locked
                  >
                    {/* 흐린 줄은 장식이다. 잠긴 글의 내용은 서버에서도 받지 않는다. */}
                    <div aria-hidden className="flex flex-col gap-2 blur-[2px]">
                      <div className="bg-muted h-3 w-11/12 rounded" />
                      <div className="bg-muted h-3 w-8/12 rounded" />
                      <div className="bg-muted h-3 w-10/12 rounded" />
                    </div>
                    <p className="text-sm">
                      {chapter === null
                        ? `완독하면 열리는 글: ${lockedLabel(lockedHere)}`
                        : `아직 읽지 않은 곳에 ${lockedLabel(lockedHere)}가 있어요. 진도가 닿으면 열려요.`}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
