"use client";

import { useActionState, useState, useTransition } from "react";

import {
  createGroup,
  pickBook,
  searchBooks,
  type BookSearchResult,
} from "@/app/groups/actions";
import { Field } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseChapterLines } from "@/lib/books/chapters";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation/limits";

const EMPTY_BOOK = {
  isbn: "",
  title: "",
  author: "",
  translator: "",
  publisher: "",
  pages: "",
  chapters: "",
};

const INITIAL_GROUP = {
  name: "",
  capacity: String(LIMITS.capacityMax),
  startDate: "",
  targetDate: "",
  isPublic: false,
};

export function NewGroupForm() {
  const [state, formAction, pending] = useActionState(
    createGroup,
    EMPTY_FORM_STATE,
  );

  // 검색 결과로 채우거나 오류 뒤에도 입력을 지키기 위해 모든 칸을 직접 관리한다.
  const [book, setBook] = useState(EMPTY_BOOK);
  const [group, setGroup] = useState(INITIAL_GROUP);
  const [source, setSource] = useState<"nlk" | "manual">("manual");
  // 같은 ISBN의 책이 이미 등록돼 있을 때의 선택. ""는 해당 없음 또는 아직 고르지 않음
  const [choice, setChoice] = useState<"" | "reuse" | "own">("");

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<BookSearchResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  const errors = state.fieldErrors ?? {};
  // 등록된 목차를 그대로 쓰는 동안에는 책 정보를 고칠 수 없다.
  const existing = choice === "reuse";
  // 직접 입력한 ISBN이 이미 등록된 책이라고 서버가 알려 준 경우
  const conflictIsbn = state.values?.conflictIsbn;
  const mustChoose =
    choice === "" &&
    Boolean(conflictIsbn) &&
    book.isbn.replace(/[s-]/g, "").toUpperCase() === conflictIsbn;
  const chapterCount = parseChapterLines(book.chapters).length;

  function editBook(field: keyof typeof EMPTY_BOOK, value: string) {
    setBook((current) => ({ ...current, [field]: value }));
  }

  function runSearch() {
    setNotice(null);
    startSearch(async () => {
      setSearch(await searchBooks(query));
    });
  }

  function choose(isbn: string) {
    setNotice(null);
    startSearch(async () => {
      const result = await pickBook(isbn);
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      const { chaptersText, existing: saved, ...fields } = result.book;
      setBook({ ...fields, chapters: chaptersText });
      setSource("nlk");
      setChoice(saved ? "reuse" : "");
      setSearch(null);
      setNotice(
        saved
          ? null
          : chaptersText
            ? "책 정보와 목차를 불러왔어요. 목차가 실제 책과 맞는지 확인해 주세요."
            : "책 정보를 불러왔어요. 이 책은 목차 자료가 없어서 직접 입력해야 해요.",
      );
    });
  }

  function resetBook() {
    setBook(EMPTY_BOOK);
    setSource("manual");
    setChoice("");
    setNotice(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">1. 함께 읽을 책 찾기</h2>
        <div className="flex gap-2">
          <Input
            aria-label="책 제목 또는 ISBN"
            placeholder="책 제목 또는 ISBN"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runSearch();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={runSearch}
            disabled={searching}
          >
            {searching ? "찾는 중…" : "검색"}
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          국립중앙도서관 자료에서 찾아요. 없으면 아래에 직접 입력하면 돼요.
        </p>

        {search && !search.ok && (
          <p role="alert" className="text-destructive text-sm">
            {search.message}
          </p>
        )}
        {search?.ok && search.books.length === 0 && (
          <p className="text-sm">
            찾는 책이 없어요. 아래에 책 정보를 직접 입력해 주세요.
          </p>
        )}
        {search?.ok && search.books.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {search.books.map((found) => (
              <li key={found.isbn}>
                <button
                  type="button"
                  className="hover:bg-muted flex w-full flex-col gap-0.5 px-3 py-2 text-left"
                  onClick={() => choose(found.isbn)}
                  disabled={searching}
                >
                  <span className="font-medium">{found.title}</span>
                  <span className="text-muted-foreground text-sm">
                    {[found.author, found.publisher, found.year]
                      .filter(Boolean)
                      .join(" · ")}
                    {found.tocUrl ? " · 목차 있음" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {notice && (
          <p role="status" className="bg-muted rounded-lg p-3 text-sm">
            {notice}
          </p>
        )}
      </section>

      <form action={formAction} className="flex flex-col gap-8" noValidate>
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">2. 책 정보와 목차</h2>
            {(source === "nlk" || book.title) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetBook}
              >
                지우고 직접 입력
              </Button>
            )}
          </div>
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="bookChoice" value={choice} />
          {(choice !== "" || mustChoose) && (
            <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <p>
                {choice === "own"
                  ? "내 목차로 따로 만들어요. 아래 목차를 원하는 대로 고쳐 주세요. 따로 만든 책은 ISBN 없이 저장돼요."
                  : "이미 책갈피에 등록된 책이에요. 등록된 목차를 그대로 쓰거나, 내 목차로 따로 만들 수 있어요."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={choice === "reuse" ? "default" : "outline"}
                  onClick={() => choose(book.isbn)}
                  disabled={searching}
                >
                  등록된 목차 그대로 쓰기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={choice === "own" ? "default" : "outline"}
                  onClick={() => setChoice("own")}
                >
                  내 목차로 따로 만들기
                </Button>
              </div>
            </div>
          )}
          <Field
            name="title"
            label="책 제목"
            value={book.title}
            onChange={(event) => editBook("title", event.target.value)}
            readOnly={existing}
            maxLength={LIMITS.bookTitleMax}
            error={errors.title}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="author"
              label="저자"
              value={book.author}
              onChange={(event) => editBook("author", event.target.value)}
              readOnly={existing}
              error={errors.author}
            />
            <Field
              name="translator"
              label="역자"
              value={book.translator}
              onChange={(event) => editBook("translator", event.target.value)}
              readOnly={existing}
              error={errors.translator}
            />
            <Field
              name="publisher"
              label="출판사"
              value={book.publisher}
              onChange={(event) => editBook("publisher", event.target.value)}
              readOnly={existing}
              error={errors.publisher}
            />
            <Field
              name="pages"
              label="전체 쪽수"
              inputMode="numeric"
              value={book.pages}
              onChange={(event) => editBook("pages", event.target.value)}
              readOnly={existing}
              error={errors.pages}
            />
          </div>
          <Field
            name="isbn"
            label="ISBN (선택)"
            inputMode="numeric"
            value={book.isbn}
            onChange={(event) => editBook("isbn", event.target.value)}
            readOnly={existing || source === "nlk"}
            error={errors.isbn}
            hint="책 뒤표지 바코드 아래의 13자리 숫자예요."
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chapters">목차</Label>
            <Textarea
              id="chapters"
              name="chapters"
              rows={8}
              value={book.chapters}
              onChange={(event) => editBook("chapters", event.target.value)}
              readOnly={existing}
              aria-invalid={errors.chapters ? true : undefined}
              aria-describedby="chapters-hint"
              placeholder={
                "1장 어린 새 | 7\n2장 검은 숨 | 45\n3장 일곱 개의 뺨"
              }
            />
            {errors.chapters && (
              <p role="alert" className="text-destructive text-sm">
                {errors.chapters}
              </p>
            )}
            <p id="chapters-hint" className="text-muted-foreground text-sm">
              한 줄에 한 장씩 적어 주세요. 지금 {chapterCount}개 장이에요. 줄
              끝에 <code>| 7</code>처럼 시작 쪽을 붙이면 같은 책을 읽는 회원이
              쪽수로 진도를 입력할 수 있어요. 이 목차가 그룹 전체의 위치 기준이
              돼요.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">3. 그룹 정보</h2>
          <Field
            name="name"
            label="그룹 이름"
            value={group.name}
            onChange={(event) =>
              setGroup({ ...group, name: event.target.value })
            }
            maxLength={LIMITS.groupNameMax}
            error={errors.name}
            required
          />
          <Field
            name="capacity"
            label="정원"
            type="number"
            min={LIMITS.capacityMin}
            max={LIMITS.capacityMax}
            value={group.capacity}
            onChange={(event) =>
              setGroup({ ...group, capacity: event.target.value })
            }
            error={errors.capacity}
            hint={`리더를 포함해 ${LIMITS.capacityMin}~${LIMITS.capacityMax}명`}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="startDate"
              label="시작일 (선택)"
              type="date"
              value={group.startDate}
              onChange={(event) =>
                setGroup({ ...group, startDate: event.target.value })
              }
              error={errors.startDate}
            />
            <Field
              name="targetDate"
              label="목표 완독일 (선택)"
              type="date"
              value={group.targetDate}
              onChange={(event) =>
                setGroup({ ...group, targetDate: event.target.value })
              }
              error={errors.targetDate}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="isPublic"
              className="mt-0.5 size-4"
              checked={group.isPublic}
              onChange={(event) =>
                setGroup({ ...group, isPublic: event.target.checked })
              }
            />
            <span>
              공개 모집
              <span className="text-muted-foreground block">
                켜면 그룹 목록에 보이고 누구나 들어올 수 있어요. 끄면 초대
                링크를 받은 사람만 들어와요.
              </span>
            </span>
          </label>
        </section>

        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="text-destructive text-sm">
            입력한 내용을 다시 확인해 주세요.
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "만드는 중…" : "그룹 만들기"}
        </Button>
      </form>
    </div>
  );
}
