import type { ReactNode } from "react";

import {
  deleteNote,
  deleteQuote,
  setNoteHidden,
  toggleLike,
  updateNote,
  updateQuote,
} from "@/app/groups/[id]/exchange-actions";
import { Composer } from "@/components/exchange/composer";
import { EditForm } from "@/components/exchange/edit-form";
import { NoteForm } from "@/components/exchange/note-form";
import type { PickerProgress } from "@/components/exchange/position-picker";
import { ToolPanels } from "@/components/exchange/tool-panels";
import { ConfirmAction } from "@/components/groups/confirm-action";
import { Button } from "@/components/ui/button";
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
  // 회원 id → 닉네임 (지금 그룹에 있는 회원만)
  nicknames: Record<string, string>;
  // "내 진도" 버튼을 누르면 펼쳐질 입력 칸
  progressForm: ReactNode;
};

const FORMER_MEMBER = "나간 회원";

// 교환 독서 화면의 본문: 접어 둔 보조 기능(내 진도, 글 남기기)과 인용·감상 목록.
// 여기서 읽는 행은 모두 RLS를 통과한 것(내 진도 이하)뿐이다. 잠긴 글은 개수만 따로 받는다.
export async function ExchangeSection({
  groupId,
  userId,
  isOwner,
  bookTitle,
  chapters,
  wholeBook,
  progress,
  nicknames,
  progressForm,
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
  const nameOf = (id: string | null) => (id && nicknames[id]) || FORMER_MEMBER;

  const renderNote = (note: FeedNote, isReply = false) => {
    const liked = note.likedBy.includes(userId);
    const mine = note.authorId === userId;
    return (
      <li
        key={note.id}
        id={`note-${note.id}`}
        className={
          isReply
            ? "scroll-mt-4 border-l pl-3"
            : "flex scroll-mt-4 flex-col gap-2"
        }
      >
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">
            {nameOf(note.authorId)}
            {isReply ? " · 답글" : ` · ${kindLabel(note.kind)}`}
            {note.hidden ? " · 리더가 숨긴 글(다른 회원에게는 안 보여요)" : ""}
          </p>
          <p className="leading-7 whitespace-pre-wrap">{note.body}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            <span className="text-muted-foreground text-sm">
              {note.likedBy.map((id) => nameOf(id)).join(", ")}
            </span>
          )}
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
              <input type="hidden" name="hidden" value={String(!note.hidden)} />
              <Button type="submit" size="sm" variant="ghost">
                {note.hidden ? "다시 보이기" : "숨기기"}
              </Button>
            </form>
          )}
        </div>

        {note.replies.length > 0 && (
          <ul className="flex flex-col gap-3 pt-1">
            {note.replies.map((reply) => renderNote(reply, true))}
          </ul>
        )}
      </li>
    );
  };

  const renderThread = (thread: FeedThread, chapter: number | null) => {
    const where =
      chapter === null
        ? "책 전체"
        : positionLabel({ chapter, pct: thread.pct }, wholeBook);

    if (thread.type === "note") {
      return (
        <li key={thread.id} className="rounded-lg border p-4">
          <p className="text-muted-foreground mb-2 text-sm">{where}</p>
          <ul className="flex flex-col gap-4">{renderNote(thread.note)}</ul>
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
        className="flex scroll-mt-4 flex-col gap-4 rounded-lg border p-4"
      >
        <figure className="flex flex-col gap-2">
          <blockquote className="border-l-2 pl-3 leading-7 whitespace-pre-wrap">
            {thread.text}
          </blockquote>
          <figcaption className="text-muted-foreground text-sm">
            『{bookTitle}』 {where} · {nameOf(thread.createdBy)} 님이 옮김
          </figcaption>
          {(isCreator || isOwner) && (
            <div className="flex flex-wrap items-start gap-2">
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
                  label="카드 삭제"
                  question="이 인용 카드와 내 감상을 지울까요? 되돌릴 수 없어요."
                  confirmLabel="삭제"
                />
              )}
              {isOwner && (thread.locked || !isCreator) && (
                <ConfirmAction
                  action={deleteQuote}
                  fields={{ quoteId: thread.id, asLeader: "true" }}
                  label="카드 내리기 (리더)"
                  question={`이 인용 카드를 내릴까요? 카드에 달린 감상·답글 ${noteCount}개도 함께 지워지고 되돌릴 수 없어요.`}
                  confirmLabel="내리기"
                />
              )}
            </div>
          )}
        </figure>
        <ul className="flex flex-col gap-4">
          {thread.notes.map((note) => renderNote(note))}
        </ul>
        <div>
          <NoteForm
            groupId={groupId}
            target={{ quoteId: thread.id }}
            label="이 문장에 감상 남기기"
            placeholder="이 문장을 읽고 든 생각"
          />
        </div>
      </li>
    );
  };

  return (
    <>
      <ToolPanels
        panels={[
          {
            id: "progress",
            label: `내 진도 · ${positionLabel(progress, wholeBook, progress.finished)}`,
            content: progressForm,
          },
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
              />
            ),
          },
        ]}
      />

      <section className="flex flex-col gap-6">
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
              <h3 className="font-medium">{heading}</h3>
              {threads.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {threads.map((thread) => renderThread(thread, chapter))}
                </ul>
              )}
              {lockedHere && (
                <div
                  className="relative overflow-hidden rounded-lg border p-4"
                  data-locked
                >
                  {/* 흐린 줄은 장식이다. 잠긴 글의 내용은 서버에서도 받지 않는다. */}
                  <div aria-hidden className="flex flex-col gap-2 blur-sm">
                    <div className="bg-muted h-3 w-11/12 rounded" />
                    <div className="bg-muted h-3 w-8/12 rounded" />
                    <div className="bg-muted h-3 w-10/12 rounded" />
                  </div>
                  <p className="mt-3 text-sm">
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
    </>
  );
}
