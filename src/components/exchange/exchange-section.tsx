import { setNoteHidden, toggleLike } from "@/app/groups/[id]/exchange-actions";
import { Composer } from "@/components/exchange/composer";
import { NoteForm } from "@/components/exchange/note-form";
import type { PickerProgress } from "@/components/exchange/position-picker";
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
};

const FORMER_MEMBER = "나간 회원";

// 그룹의 인용 카드·감상 목록과 글쓰기 칸.
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
}: ExchangeSectionProps) {
  const supabase = await createClient();
  const [{ data: quotes }, { data: notes }, { data: locked }] =
    await Promise.all([
      supabase
        .from("quotes")
        .select("id, chapter, pct, text, created_by, created_at")
        .eq("group_id", groupId),
      supabase
        .from("notes")
        .select(
          "id, chapter, pct, kind, body, quote_id, parent_id, author_id, hidden_at, created_at, reactions(user_id)",
        )
        .eq("group_id", groupId),
      supabase.rpc("locked_counts", { p_group_id: groupId }),
    ]);

  const feed = buildFeed(
    (quotes ?? []).map((row) => ({
      id: row.id,
      chapter: row.chapter,
      pct: Number(row.pct),
      text: row.text,
      createdBy: row.created_by,
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
    return (
      <li
        key={note.id}
        className={isReply ? "border-l pl-3" : "flex flex-col gap-2"}
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
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">글 남기기</h2>
        <Composer
          // 진도를 저장하면 고를 수 있는 위치가 달라지므로 새로 만든다.
          key={`${progress.chapter}-${progress.pct}-${progress.finished}`}
          groupId={groupId}
          chapters={chapters}
          wholeBook={wholeBook}
          progress={progress}
        />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">인용과 감상</h2>
        {sectionKeys.length === 0 && (
          <p className="text-muted-foreground text-sm">
            아직 글이 없어요. 읽다가 마음에 남은 문장이나 생각을 처음으로 남겨
            보세요.
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
