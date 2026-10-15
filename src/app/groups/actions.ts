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
import { sameToc, toTocVersions, type TocVersion } from "@/lib/books/versions";
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
  source: "nlk" | "kakao" | "manual";
  // 목차를 국립중앙도서관 자료에서 그대로 가져왔는지
  tocFromLibrary: boolean;
};

export type PickBookResult =
  | {
      ok: true;
      // 외부 자료(카카오·국립중앙도서관)로 채운 책 정보. "새로 만들기"의 출발점
      book: PickedBook;
      // 같은 ISBN으로 이미 저장된 목차 버전(추천 순서)
      versions: TocVersion[];
    }
  | { ok: false; message: string };

async function loadVersions(
  supabase: SupabaseServerClient,
  isbn: string,
): Promise<TocVersion[]> {
  const { data } = await supabase.rpc("toc_versions", { p_isbn: isbn });
  return toTocVersions(data ?? []);
}

// 국립중앙도서관이 이 ISBN에 대해 주는 목차(정리된 줄 형식). 없거나 실패하면 null
async function libraryToc(isbn: string): Promise<string | null> {
  try {
    const [found] = await searchNlk(isbn);
    if (!found) return null;
    const toc = found.tocText ?? (await fetchNlkToc(found.tocUrl));
    return toc ? formatChapterLines(parseChapterLines(toc)) : null;
  } catch {
    return null;
  }
}

// 검색 결과에서 고른 책의 정보와 목차를 불러온다. 값은 서버가 ISBN으로 다시 조회해서 얻는다.
// 책 정보와 표지는 카카오에서, 목차와 전체 쪽수는 국립중앙도서관에서 가져오고,
// 같은 ISBN으로 저장된 목차 버전도 함께 돌려준다.
export async function pickBook(isbn: string): Promise<PickBookResult> {
  await requireUser("/groups/new");

  const parsed = isbnSchema.safeParse(isbn);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const [versions, kakao, nlk] = await Promise.all([
    loadVersions(supabase, parsed.data),
    hasKakaoKey()
      ? searchKakao(parsed.data, { isbnOnly: true }).catch(() => null)
      : null,
    searchNlk(parsed.data).catch(() => null),
  ]);
  const fromKakao =
    kakao?.books.find((book) => book.isbn === parsed.data) ?? kakao?.books[0];
  const fromNlk = nlk?.[0];
  const top = versions[0];
  if (!fromKakao && !fromNlk && !top) {
    return { ok: false, message: SEARCH_FAILED };
  }

  // 응답에 목차 글이 있으면 그것을 쓰고, 없으면 목차 파일을 읽는다.
  const toc = fromNlk
    ? (fromNlk.tocText ?? (await fetchNlkToc(fromNlk.tocUrl)))
    : null;
  const chaptersText = toc ? formatChapterLines(parseChapterLines(toc)) : "";

  return {
    ok: true,
    book: {
      isbn: parsed.data,
      title: fromKakao?.title ?? fromNlk?.title ?? top?.title ?? "",
      author: fromKakao?.author || fromNlk?.author || top?.author || "",
      translator:
        fromKakao?.translator || fromNlk?.translator || top?.translator || "",
      publisher:
        fromKakao?.publisher || fromNlk?.publisher || top?.publisher || "",
      pages: fromNlk?.pages ? String(fromNlk.pages) : "",
      coverUrl: fromKakao?.coverUrl ?? top?.coverUrl ?? "",
      chaptersText,
      source: fromKakao ? "kakao" : fromNlk ? "nlk" : "manual",
      tocFromLibrary: chaptersText !== "",
    },
    versions,
  };
}

// 고른 목차 버전이 실제로 쓸 수 있는 책(목차가 있는 행)인지 확인한다.
async function usableVersion(
  supabase: SupabaseServerClient,
  bookId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("books")
    .select("id, book_chapters(number)")
    .eq("id", bookId)
    .maybeSingle();
  return Boolean(data && data.book_chapters.length > 0);
}

// 입력한 책 정보와 목차를 새 목차 버전으로 저장한다.
// 같은 ISBN에 장 제목·시작 쪽·전체 쪽수가 똑같은 버전이 있으면 새로 만들지 않고 그것을 쓴다.
async function saveVersion(
  supabase: SupabaseServerClient,
  book: BookInput,
  basedOn: string | null,
  checkLibrary: boolean,
): Promise<{ bookId: string } | { error: unknown }> {
  if (book.isbn) {
    const versions = await loadVersions(supabase, book.isbn);
    const same = versions.find((version) => sameToc(version, book));
    if (same) return { bookId: same.id };
  }

  // 도서관 목차를 그대로 쓴 것인지는 서버가 다시 받아 와 비교해서 정한다.
  const fromLibrary =
    checkLibrary &&
    book.isbn !== null &&
    (await libraryToc(book.isbn)) === formatChapterLines(book.chapters);

  const { data, error } = await supabase
    .from("books")
    .insert({
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      translator: book.translator,
      publisher: book.publisher,
      pages: book.pages,
      source: book.source,
      cover_url: book.coverUrl,
      based_on: basedOn,
      toc_source: fromLibrary ? "nlk" : "member",
    })
    .select("id")
    .single();
  if (error) return { error };

  const { error: chapterError } = await supabase.from("book_chapters").insert(
    book.chapters.map((chapter) => ({
      book_id: data.id,
      number: chapter.number,
      title: chapter.title,
      start_page: chapter.startPage,
    })),
  );
  if (chapterError) return { error: chapterError };

  return { bookId: data.id };
}

export async function createGroup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/groups/new");
  if (user.isAnonymous) {
    return {
      error:
        "체험 중에는 그룹을 만들 수 없어요. 가입하면 내 그룹을 만들 수 있어요.",
    };
  }

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
  // 저장된 목차 버전을 골랐으면 그것을 쓰고, 아니면 입력한 목차를 새 버전으로 저장한다.
  const picked = uuidSchema.safeParse(textOf(formData, "bookVersion"));
  const basedOn = uuidSchema.safeParse(textOf(formData, "basedOn"));
  let resolved: { bookId: string } | { error: unknown };
  if (picked.success) {
    if (!(await usableVersion(supabase, picked.data))) {
      return { error: "고른 목차를 찾을 수 없어요. 책을 다시 골라 주세요." };
    }
    resolved = { bookId: picked.data };
  } else {
    resolved = await saveVersion(
      supabase,
      book.data,
      basedOn.success ? basedOn.data : null,
      textOf(formData, "tocFromLibrary") === "1",
    );
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
