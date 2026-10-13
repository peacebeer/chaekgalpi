import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type NotificationKind = "quote_note" | "reply" | "like";

export type Notification = {
  // 목록에서 쓰는 고유 키
  id: string;
  kind: NotificationKind;
  // 일어난 시각(ISO)
  at: string;
  actorId: string | null;
  groupId: string;
  // 눌렀을 때 갈 곳(그룹 화면의 해당 글)
  href: string;
  // 내 글(또는 내 인용문)의 앞부분
  target: string;
  // 상대가 쓴 글의 앞부분(좋아요는 없음)
  excerpt: string | null;
};

// 마지막으로 알림을 확인한 시각을 담는 쿠키. 기기(브라우저)마다 따로 기억한다.
export const SEEN_COOKIE = "notif_seen";

const MY_ITEMS_LIMIT = 100;
const SNIPPET_LENGTH = 60;

export function snippet(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > SNIPPET_LENGTH
    ? `${flat.slice(0, SNIPPET_LENGTH)}…`
    : flat;
}

type ReplyRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  group_id: string;
  parent_id: string | null;
  quote_id: string | null;
};

// 알림 세 종류를 한 목록으로 합쳐 최신순으로 정리한다.
export function mergeNotifications(input: {
  myNotes: { id: string; body: string; group_id: string }[];
  myQuotes: { id: string; text: string; group_id: string }[];
  replies: ReplyRow[];
  quoteNotes: ReplyRow[];
  likes: { note_id: string; user_id: string; created_at: string }[];
  limit: number;
}): Notification[] {
  const noteById = new Map(input.myNotes.map((note) => [note.id, note]));
  const quoteById = new Map(input.myQuotes.map((quote) => [quote.id, quote]));
  const items: Notification[] = [];

  for (const reply of input.replies) {
    const parent = reply.parent_id ? noteById.get(reply.parent_id) : undefined;
    if (!parent) continue;
    items.push({
      id: `reply-${reply.id}`,
      kind: "reply",
      at: reply.created_at,
      actorId: reply.author_id,
      groupId: reply.group_id,
      href: `/groups/${reply.group_id}#note-${reply.id}`,
      target: snippet(parent.body),
      excerpt: snippet(reply.body),
    });
  }

  for (const note of input.quoteNotes) {
    const quote = note.quote_id ? quoteById.get(note.quote_id) : undefined;
    if (!quote) continue;
    items.push({
      id: `quote-note-${note.id}`,
      kind: "quote_note",
      at: note.created_at,
      actorId: note.author_id,
      groupId: note.group_id,
      href: `/groups/${note.group_id}#note-${note.id}`,
      target: snippet(quote.text),
      excerpt: snippet(note.body),
    });
  }

  for (const like of input.likes) {
    const note = noteById.get(like.note_id);
    if (!note) continue;
    items.push({
      id: `like-${like.note_id}-${like.user_id}`,
      kind: "like",
      at: like.created_at,
      actorId: like.user_id,
      groupId: note.group_id,
      href: `/groups/${note.group_id}#note-${note.id}`,
      target: snippet(note.body),
      excerpt: null,
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, input.limit);
}

export function countUnseen(items: Notification[], seenAt: string | null) {
  if (!seenAt) return items.length;
  const seen = Date.parse(seenAt);
  if (Number.isNaN(seen)) return items.length;
  return items.filter((item) => Date.parse(item.at) > seen).length;
}

// 나에게 온 소식: 내 인용 카드에 달린 감상, 내 글에 달린 답글, 내 글에 눌린 좋아요.
// 별도 테이블 없이 지금 있는 글에서 계산한다. RLS가 적용되어 내가 볼 수 있는 것만 나온다.
export async function getNotifications(
  supabase: SupabaseServerClient,
  userId: string,
  limit = 30,
): Promise<Notification[]> {
  const [{ data: myNotes }, { data: myQuotes }] = await Promise.all([
    supabase
      .from("notes")
      .select("id, body, group_id")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(MY_ITEMS_LIMIT),
    supabase
      .from("quotes")
      .select("id, text, group_id")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(MY_ITEMS_LIMIT),
  ]);

  const noteIds = (myNotes ?? []).map((note) => note.id);
  const quoteIds = (myQuotes ?? []).map((quote) => quote.id);
  const columns =
    "id, body, created_at, author_id, group_id, parent_id, quote_id";

  const [replies, quoteNotes, likes] = await Promise.all([
    noteIds.length === 0
      ? null
      : supabase
          .from("notes")
          .select(columns)
          .in("parent_id", noteIds)
          .neq("author_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit),
    quoteIds.length === 0
      ? null
      : supabase
          .from("notes")
          .select(columns)
          .in("quote_id", quoteIds)
          .is("parent_id", null)
          .neq("author_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit),
    noteIds.length === 0
      ? null
      : supabase
          .from("reactions")
          .select("note_id, user_id, created_at")
          .in("note_id", noteIds)
          .neq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit),
  ]);

  return mergeNotifications({
    myNotes: myNotes ?? [],
    myQuotes: myQuotes ?? [],
    replies: replies?.data ?? [],
    quoteNotes: quoteNotes?.data ?? [],
    likes: likes?.data ?? [],
    limit,
  });
}
