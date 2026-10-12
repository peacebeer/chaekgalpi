"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { formatChapterLines, parseChapterLines } from "@/lib/books/chapters";
import { toErrorMessage } from "@/lib/errors";
import { fieldErrorsOf, textOf, type FormState } from "@/lib/form-state";
import { fetchNlkToc, searchNlk } from "@/lib/nlk/client";
import type { NlkBook } from "@/lib/nlk/parse";
import { createClient } from "@/lib/supabase/server";
import { bookSchema, isbnSchema, type BookInput } from "@/lib/validation/book";
import { uuidSchema } from "@/lib/validation/common";
import { groupDetailsSchema, inviteCodeSchema } from "@/lib/validation/group";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const SEARCH_FAILED =
  "도서 검색에 연결하지 못했어요. 아래에 책 정보를 직접 입력해 주세요.";

const searchQuerySchema = z
  .string()
  .trim()
  .min(1, "책 제목이나 ISBN을 입력해 주세요.")
  .max(100, "검색어가 너무 길어요.");

export type BookSearchResult =
  { ok: true; books: NlkBook[] } | { ok: false; message: string };

// 국립중앙도서관 검색. 로그인한 사용자만 쓸 수 있다.
export async function searchBooks(query: string): Promise<BookSearchResult> {
  await requireUser("/groups/new");

  const parsed = searchQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  try {
    return { ok: true, books: await searchNlk(parsed.data) };
  } catch {
    return { ok: false, message: SEARCH_FAILED };
  }
}

export type PickedBook = {
  isbn: string;
  title: string;
  author: string;
  translator: string;
  publisher: string;
  pages: string;
  chaptersText: string;
  // 이미 책갈피에 등록된 책이면 등록된 목차를 그대로 쓴다.
  existing: boolean;
};

export type PickBookResult =
  { ok: true; book: PickedBook } | { ok: false; message: string };

async function findUsableBook(supabase: SupabaseServerClient, isbn: string) {
  const { data } = await supabase
    .from("books")
    .select(
      "id, isbn, title, author, translator, publisher, pages, created_by, book_chapters(number, title, start_page)",
    )
    .eq("isbn", isbn)
    .maybeSingle();
  return data;
}

// 검색 결과에서 고른 책의 정보와 목차를 불러온다. 주소는 서버가 다시 조회해서 얻는다.
export async function pickBook(isbn: string): Promise<PickBookResult> {
  await requireUser("/groups/new");

  const parsed = isbnSchema.safeParse(isbn);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const saved = await findUsableBook(supabase, parsed.data);
  if (saved && saved.book_chapters.length > 0) {
    const chapters = [...saved.book_chapters].sort(
      (a, b) => a.number - b.number,
    );
    return {
      ok: true,
      book: {
        isbn: parsed.data,
        title: saved.title,
        author: saved.author ?? "",
        translator: saved.translator ?? "",
        publisher: saved.publisher ?? "",
        pages: saved.pages ? String(saved.pages) : "",
        chaptersText: formatChapterLines(
          chapters.map((chapter) => ({
            title: chapter.title,
            startPage: chapter.start_page,
          })),
        ),
        existing: true,
      },
    };
  }

  try {
    const [found] = await searchNlk(parsed.data);
    if (!found) return { ok: false, message: SEARCH_FAILED };

    const toc = await fetchNlkToc(found.tocUrl);
    return {
      ok: true,
      book: {
        isbn: found.isbn,
        title: found.title,
        author: found.author,
        translator: found.translator,
        publisher: found.publisher,
        pages: found.pages ? String(found.pages) : "",
        chaptersText: toc ? formatChapterLines(parseChapterLines(toc)) : "",
        existing: false,
      },
    };
  } catch {
    return { ok: false, message: SEARCH_FAILED };
  }
}

// 대표 도서를 정한다: 같은 ISBN으로 등록된 책이 있으면 재사용하고, 없으면 새로 등록한다.
async function resolveBookId(
  supabase: SupabaseServerClient,
  userId: string,
  book: BookInput,
): Promise<{ bookId: string } | { error: unknown }> {
  let isbn = book.isbn;
  let bookId: string | null = null;

  if (isbn) {
    const saved = await findUsableBook(supabase, isbn);
    if (saved && saved.book_chapters.length > 0) return { bookId: saved.id };
    if (saved && saved.created_by === userId) {
      // 내가 등록하다가 목차 저장에 실패했던 책: 목차만 이어서 넣는다.
      bookId = saved.id;
    } else if (saved) {
      // 남이 등록했지만 목차가 없어 쓸 수 없는 책: ISBN 없이 따로 등록한다.
      isbn = null;
    }
  }

  if (!bookId) {
    const { data, error } = await supabase
      .from("books")
      .insert({
        isbn,
        title: book.title,
        author: book.author,
        translator: book.translator,
        publisher: book.publisher,
        pages: book.pages,
        source: book.source,
      })
      .select("id")
      .single();
    if (error) return { error };
    bookId = data.id;
  }

  const { error } = await supabase.from("book_chapters").insert(
    book.chapters.map((chapter) => ({
      book_id: bookId,
      number: chapter.number,
      title: chapter.title,
      start_page: chapter.startPage,
    })),
  );
  if (error) return { error };

  return { bookId };
}

export async function createGroup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/groups/new");

  const pages = textOf(formData, "pages").trim();
  const book = bookSchema.safeParse({
    isbn: textOf(formData, "isbn"),
    title: textOf(formData, "title"),
    author: textOf(formData, "author"),
    translator: textOf(formData, "translator"),
    publisher: textOf(formData, "publisher"),
    pages: pages === "" ? null : Number(pages),
    source: textOf(formData, "source") === "nlk" ? "nlk" : "manual",
    chapters: parseChapterLines(textOf(formData, "chapters")),
  });
  const group = groupDetailsSchema.safeParse({
    name: textOf(formData, "name"),
    capacity: Number(textOf(formData, "capacity")),
    startDate: textOf(formData, "startDate"),
    targetDate: textOf(formData, "targetDate"),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!book.success || !group.success) {
    return {
      fieldErrors: {
        ...(book.success ? {} : fieldErrorsOf(book.error)),
        ...(group.success ? {} : fieldErrorsOf(group.error)),
      },
    };
  }

  const supabase = await createClient();
  const resolved = await resolveBookId(supabase, user.id, book.data);
  if ("error" in resolved) return { error: toErrorMessage(resolved.error) };

  // 리더 가입은 DB 트리거가 처리한다. 방금 만든 행은 가입이 끝난 뒤에야 보이므로
  // insert에서 바로 돌려받지 않고 다시 조회한다.
  const { error } = await supabase.from("groups").insert({
    book_id: resolved.bookId,
    name: group.data.name,
    capacity: group.data.capacity,
    start_date: group.data.startDate,
    target_date: group.data.targetDate,
    is_public: group.data.isPublic,
  });
  if (error) return { error: toErrorMessage(error) };

  const { data: created } = await supabase
    .from("groups")
    .select("id")
    .eq("owner_id", user.id)
    .eq("book_id", resolved.bookId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  redirect(created ? `/groups/${created.id}` : "/groups");
}

// 초대 코드(비공개·공개 모두) 또는 공개 그룹 id로 입장한다.
export async function joinGroup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = inviteCodeSchema.safeParse(textOf(formData, "inviteCode"));
  const groupId = uuidSchema.safeParse(textOf(formData, "groupId"));
  if (!code.success && !groupId.success) {
    return { error: toErrorMessage("group_not_found") };
  }

  await requireUser(
    code.success ? `/join/${code.data}` : `/groups/${groupId.data}`,
  );

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "join_group",
    code.success ? { p_invite_code: code.data } : { p_group_id: groupId.data },
  );
  if (error || !data) return { error: toErrorMessage(error) };

  redirect(`/groups/${data}`);
}
