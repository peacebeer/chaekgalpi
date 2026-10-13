"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import {
  formatChapterLines,
  parseChapterLines,
  wholeBookChapters,
} from "@/lib/books/chapters";
import { toErrorMessage } from "@/lib/errors";
import { fieldErrorsOf, textOf, type FormState } from "@/lib/form-state";
import { hasKakaoKey, searchKakao } from "@/lib/kakao/client";
import { safeCoverUrl } from "@/lib/kakao/parse";
import { fetchNlkToc, searchNlk } from "@/lib/nlk/client";
import { createClient } from "@/lib/supabase/server";
import { bookSchema, isbnSchema, type BookInput } from "@/lib/validation/book";
import { uuidSchema } from "@/lib/validation/common";
import { groupDetailsSchema, inviteCodeSchema } from "@/lib/validation/group";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const SEARCH_FAILED =
  "도서 검색에 연결하지 못했어요. 아래 버튼으로 책 정보를 직접 입력해 주세요.";

const searchQuerySchema = z
  .string()
  .trim()
  .min(1, "책 제목, 저자, 출판사 또는 ISBN을 입력해 주세요.")
  .max(100, "검색어가 너무 길어요.");

export type BookSearchItem = {
  isbn: string;
  title: string;
  author: string;
  translator: string;
  publisher: string;
  year: string;
  coverUrl: string | null;
};

export type BookSearchResult =
  | {
      ok: true;
      books: BookSearchItem[];
      // 조건에 맞는 전체 건수. 알 수 없으면 null
      total: number | null;
      // 다음 쪽이 있으면 그 번호, 없으면 null
      nextPage: number | null;
    }
  | { ok: false; message: string };

// 책 검색. 카카오 책 검색(제목·저자·출판사·ISBN을 한 번에, 정확도순)을 쓰고,
// 카카오를 쓸 수 없으면 국립중앙도서관 검색(제목·ISBN)으로 넘어간다. 로그인한 사용자만 쓸 수 있다.
export async function searchBooks(
  query: string,
  page = 1,
): Promise<BookSearchResult> {
  await requireUser("/groups/new");

  const parsed = searchQuerySchema.safeParse(query);
  const parsedPage = z.number().int().min(1).max(50).safeParse(page);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const pageNo = parsedPage.success ? parsedPage.data : 1;

  if (hasKakaoKey()) {
    try {
      const result = await searchKakao(parsed.data, { page: pageNo });
      return {
        ok: true,
        books: result.books,
        total: result.total,
        nextPage: result.isEnd ? null : pageNo + 1,
      };
    } catch {
      // 아래 도서관 검색으로 넘어간다.
    }
  }

  // 도서관 검색은 한 번에 20건만 가져오고 다음 쪽을 지원하지 않는다.
  if (pageNo > 1) return { ok: true, books: [], total: null, nextPage: null };
  try {
    const books = await searchNlk(parsed.data);
    return {
      ok: true,
      books: books.map((book) => ({
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        translator: book.translator,
        publisher: book.publisher,
        year: book.year,
        coverUrl: null,
      })),
      total: null,
      nextPage: null,
    };
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
  coverUrl: string;
  chaptersText: string;
  source: "nlk" | "kakao";
  // 이미 책갈피에 등록된 책이면 등록된 목차를 그대로 쓴다.
  existing: boolean;
};

export type PickBookResult =
  { ok: true; book: PickedBook } | { ok: false; message: string };

async function findUsableBook(supabase: SupabaseServerClient, isbn: string) {
  const { data } = await supabase
    .from("books")
    .select(
      "id, isbn, title, author, translator, publisher, pages, cover_url, source, created_by, book_chapters(number, title, start_page)",
    )
    .eq("isbn", isbn)
    .maybeSingle();
  return data;
}

// 검색 결과에서 고른 책의 정보와 목차를 불러온다. 값은 서버가 ISBN으로 다시 조회해서 얻는다.
// 책 정보와 표지는 카카오에서, 목차와 전체 쪽수는 국립중앙도서관에서 가져온다.
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
        coverUrl: saved.cover_url ?? "",
        chaptersText: formatChapterLines(
          chapters.map((chapter) => ({
            title: chapter.title,
            startPage: chapter.start_page,
          })),
        ),
        source: saved.source === "kakao" ? "kakao" : "nlk",
        existing: true,
      },
    };
  }

  const [kakao, nlk] = await Promise.allSettled([
    hasKakaoKey()
      ? searchKakao(parsed.data, { isbnOnly: true })
      : Promise.reject(new Error("no kakao key")),
    searchNlk(parsed.data),
  ]);
  const fromKakao =
    kakao.status === "fulfilled"
      ? (kakao.value.books.find((book) => book.isbn === parsed.data) ??
        kakao.value.books[0])
      : undefined;
  const fromNlk = nlk.status === "fulfilled" ? nlk.value[0] : undefined;
  if (!fromKakao && !fromNlk) return { ok: false, message: SEARCH_FAILED };

  // 응답에 목차 글이 있으면 그것을 쓰고, 없으면 목차 파일을 읽는다.
  const toc = fromNlk
    ? (fromNlk.tocText ?? (await fetchNlkToc(fromNlk.tocUrl)))
    : null;

  return {
    ok: true,
    book: {
      isbn: parsed.data,
      title: fromKakao?.title ?? fromNlk?.title ?? "",
      author: fromKakao?.author || fromNlk?.author || "",
      translator: fromKakao?.translator || fromNlk?.translator || "",
      publisher: fromKakao?.publisher || fromNlk?.publisher || "",
      pages: fromNlk?.pages ? String(fromNlk.pages) : "",
      coverUrl: fromKakao?.coverUrl ?? "",
      chaptersText: toc ? formatChapterLines(parseChapterLines(toc)) : "",
      source: fromKakao ? "kakao" : "nlk",
      existing: false,
    },
  };
}

// 같은 ISBN의 책이 이미 등록돼 있을 때: 등록된 목차를 그대로 쓸지, 내 목차로 따로 등록할지
type BookChoice = "reuse" | "own" | "";

const BOOK_CONFLICT =
  "이 ISBN의 책은 이미 책갈피에 등록돼 있어요. 등록된 목차를 쓸지, 내 목차로 따로 만들지 골라 주세요.";

// 대표 도서를 정한다: 같은 ISBN으로 등록된 책이 있으면 고른 대로 재사용하거나 따로 등록한다.
async function resolveBookId(
  supabase: SupabaseServerClient,
  userId: string,
  book: BookInput,
  choice: BookChoice,
): Promise<{ bookId: string } | { error: unknown } | { conflictIsbn: string }> {
  let isbn = book.isbn;
  let bookId: string | null = null;

  if (isbn) {
    const saved = await findUsableBook(supabase, isbn);
    if (saved && saved.book_chapters.length > 0) {
      if (choice === "reuse") return { bookId: saved.id };
      // 고르지 않았으면 입력한 목차를 말없이 버리지 않고 되묻는다.
      if (choice !== "own") return { conflictIsbn: isbn };
      // 내 목차로 따로 등록: ISBN은 책 한 권에만 붙을 수 있어 비워 둔다.
      isbn = null;
    } else if (saved && saved.created_by === userId) {
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
        cover_url: book.coverUrl,
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
  const pageCount = pages === "" ? null : Number(pages);
  // 목차는 선택이다. 비워 두면 책 전체를 한 장으로 둔다.
  const typedChapters = parseChapterLines(textOf(formData, "chapters"));
  const noChapters = typedChapters.length === 0;
  const book = bookSchema.safeParse({
    // 목차 없는 책이 그 ISBN의 대표 목차로 다른 그룹에 제안되지 않도록 ISBN 없이 저장한다.
    isbn: noChapters ? "" : textOf(formData, "isbn"),
    title: textOf(formData, "title"),
    author: textOf(formData, "author"),
    translator: textOf(formData, "translator"),
    publisher: textOf(formData, "publisher"),
    pages: pageCount,
    source: textOf(formData, "source"),
    // 카카오 이미지 서버의 주소가 아니면 버린다.
    coverUrl: safeCoverUrl(textOf(formData, "coverUrl")),
    chapters: noChapters
      ? wholeBookChapters(
          Number.isInteger(pageCount) && Number(pageCount) > 0
            ? pageCount
            : null,
        )
      : typedChapters,
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
  const choiceInput = textOf(formData, "bookChoice");
  const choice: BookChoice =
    choiceInput === "reuse" || choiceInput === "own" ? choiceInput : "";
  const resolved = await resolveBookId(supabase, user.id, book.data, choice);
  if ("conflictIsbn" in resolved) {
    return {
      error: BOOK_CONFLICT,
      values: { conflictIsbn: resolved.conflictIsbn },
    };
  }
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
