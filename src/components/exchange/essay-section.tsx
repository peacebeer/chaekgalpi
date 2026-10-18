import { EssayEditor } from "@/components/exchange/essay-editor";
import { placeLabel, type PageMap } from "@/lib/books/pages";
import {
  buildEssayOutline,
  essayDraft,
  isEmptyOutline,
} from "@/lib/exchange/essay";
import { createClient } from "@/lib/supabase/server";

type EssaySectionProps = {
  groupId: string;
  userId: string;
  book: { title: string; author: string | null };
  wholeBook: boolean;
  pageMap: PageMap | null;
  finished: boolean;
};

// 감상문 도우미: 내가 남긴 인용과 감상을 감상문 뼈대에 배치한 초안을 보여 준다(AI 없이).
export async function EssaySection({
  groupId,
  userId,
  book,
  wholeBook,
  pageMap,
  finished,
}: EssaySectionProps) {
  const supabase = await createClient();
  const [{ data: quotes }, { data: notes }] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, chapter, pct, text, created_by, locked_at, created_at")
      .eq("group_id", groupId),
    supabase
      .from("notes")
      .select(
        "id, chapter, pct, kind, body, quote_id, parent_id, author_id, hidden_at, created_at, reactions(user_id)",
      )
      .eq("group_id", groupId)
      .eq("author_id", userId),
  ]);

  const outline = buildEssayOutline({
    userId,
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
  });
  const draft = essayDraft(outline, book, (position) =>
    placeLabel(position, wholeBook, pageMap),
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">감상문 도우미</h2>
        <p className="text-muted-foreground text-sm leading-6">
          내가 이 그룹에 남긴 인용과 감상을 감상문 뼈대(도입 → 인상 깊은 장면 →
          생각의 변화 → 맺음)에 맞춰 모았어요. 인상 깊은 장면은 공감을 많이 받은
          글부터 골랐어요. 고쳐 쓴 뒤 복사해서 쓰세요.
        </p>
        <p className="text-muted-foreground text-sm">
          모은 글: 장면 {outline.scenes.length}개 · 생각{" "}
          {outline.intro.length + outline.journey.length}개 · 정리{" "}
          {outline.closing.length}개
        </p>
        {isEmptyOutline(outline) && (
          <p className="bg-muted rounded-lg p-3 text-sm leading-6">
            아직 이 그룹에 남긴 글이 없어요. 인용과 감상 탭에서 마음에 남은
            문장과 생각을 남기면 여기에 모여요.
          </p>
        )}
        {!finished && !isEmptyOutline(outline) && (
          <p className="bg-highlight text-highlight-foreground rounded-lg px-4 py-3 text-sm leading-6">
            아직 완독 전이에요. 다 읽은 뒤 &lsquo;책 전체&rsquo; 글로 정리를
            남기면 맺음 단락이 채워져요.
          </p>
        )}
      </div>
      {/* 글이 새로 생기면 초안도 새로 만든다 */}
      <EssayEditor key={draft} draft={draft} />
    </section>
  );
}
