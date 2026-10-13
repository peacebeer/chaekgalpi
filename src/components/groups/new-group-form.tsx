"use client";

import { useActionState, useState, useTransition } from "react";

import {
  createGroup,
  pickBook,
  searchBooks,
  type BookSearchResult,
} from "@/app/groups/actions";
import { Field } from "@/components/auth/field";
import { BookCover } from "@/components/groups/book-cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseChapterLines } from "@/lib/books/chapters";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation/limits";

const EMPTY_BOOK = {
  isbn: "",
  title: "",
  author: "",
  translator: "",
  publisher: "",
  pages: "",
  coverUrl: "",
  chapters: "",
};

const INITIAL_GROUP = {
  name: "",
  capacity: String(LIMITS.capacityMax),
  startDate: "",
  targetDate: "",
  isPublic: false,
};

// 목차 칸 아래에 보여 주는 시작 쪽 표기 예시. lib/books/chapters.ts가 읽는 형식과 맞춘다.
const PAGE_FORMATS = [
  ["어린 새 | 7", "제목 뒤에 | 와 쪽수"],
  ["어린 새 7p", "쪽수 뒤에 p"],
  ["어린 새 7쪽", "쪽수 뒤에 쪽"],
  ["어린 새 p.7", "쪽수 앞에 p."],
  ["어린 새", "쪽수 없이 제목만"],
] as const;

const STEPS = ["책 찾기", "책 정보와 목차", "그룹 정보"] as const;
type Step = 1 | 2 | 3;

// 서버가 돌려준 오류가 2단계(책) 칸의 것인지
const BOOK_FIELDS = new Set([...Object.keys(EMPTY_BOOK), "source"]);

export function NewGroupForm() {
  const [step, setStep] = useState<Step>(1);

  // 검색 결과로 채우거나 단계를 오가도 입력을 지키기 위해 모든 칸을 직접 관리한다.
  const [book, setBook] = useState(EMPTY_BOOK);
  const [group, setGroup] = useState(INITIAL_GROUP);
  const [source, setSource] = useState<"nlk" | "kakao" | "manual">("manual");
  // 같은 ISBN의 책이 이미 등록돼 있을 때의 선택. ""는 해당 없음 또는 아직 고르지 않음
  const [choice, setChoice] = useState<"" | "reuse" | "own">("");

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<BookSearchResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  // 2단계에서 "다음"을 눌렀을 때의 안내
  const [titleMissing, setTitleMissing] = useState(false);
  const [confirmNoChapters, setConfirmNoChapters] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await createGroup(prev, formData);
      // 책 쪽에 문제가 있으면 그 단계로 돌아가서 보여 준다.
      const bookProblem =
        Boolean(result.values?.conflictIsbn) ||
        Object.keys(result.fieldErrors ?? {}).some((key) =>
          BOOK_FIELDS.has(key),
        );
      if (bookProblem) setStep(2);
      return result;
    },
    EMPTY_FORM_STATE,
  );

  const errors = state.fieldErrors ?? {};
  // 등록된 목차를 그대로 쓰는 동안에는 책 정보를 고칠 수 없다.
  const existing = choice === "reuse";
  // 직접 입력한 ISBN이 이미 등록된 책이라고 서버가 알려 준 경우
  const conflictIsbn = state.values?.conflictIsbn;
  const mustChoose =
    choice === "" &&
    Boolean(conflictIsbn) &&
    book.isbn.replace(/[\s-]/g, "").toUpperCase() === conflictIsbn;
  const parsedChapters = parseChapterLines(book.chapters);
  const chapterCount = parsedChapters.length;

  function editBook(field: keyof typeof EMPTY_BOOK, value: string) {
    setBook((current) => ({ ...current, [field]: value }));
    if (field === "title") setTitleMissing(false);
    if (field === "chapters") setConfirmNoChapters(false);
  }

  function runSearch() {
    setPickError(null);
    startSearch(async () => {
      setSearch(await searchBooks(query));
    });
  }

  // 다음 쪽을 가져와 지금 목록 뒤에 붙인다.
  function loadMore() {
    if (!search?.ok || !search.nextPage) return;
    const shown = search.books;
    const page = search.nextPage;
    startSearch(async () => {
      const more = await searchBooks(query, page);
      if (!more.ok) {
        setPickError(more.message);
        return;
      }
      const seen = new Set(shown.map((item) => item.isbn));
      setSearch({
        ...more,
        books: [...shown, ...more.books.filter((item) => !seen.has(item.isbn))],
      });
    });
  }

  function choose(isbn: string) {
    setPickError(null);
    startSearch(async () => {
      const result = await pickBook(isbn);
      if (!result.ok) {
        setPickError(result.message);
        return;
      }
      const {
        chaptersText,
        existing: saved,
        source: pickedFrom,
        ...fields
      } = result.book;
      setBook({ ...fields, chapters: chaptersText });
      setSource(pickedFrom);
      setChoice(saved ? "reuse" : "");
      setSearch(null);
      setTitleMissing(false);
      setConfirmNoChapters(false);
      setNotice(
        saved
          ? null
          : chaptersText
            ? "책 정보와 목차를 불러왔어요. 목차가 실제 책과 맞는지 확인해 주세요."
            : "책 정보를 불러왔어요. 이 책은 목차 자료가 없어요.",
      );
      setStep(2);
    });
  }

  function enterManually() {
    setBook(EMPTY_BOOK);
    setSource("manual");
    setChoice("");
    setNotice(null);
    setPickError(null);
    setTitleMissing(false);
    setConfirmNoChapters(false);
    setStep(2);
  }

  function leaveBookStep() {
    if (!book.title.trim()) {
      setTitleMissing(true);
      return;
    }
    // 목차가 없으면 한 번 알리고, 다시 누르면 넘어간다.
    if (chapterCount === 0 && !confirmNoChapters) {
      setConfirmNoChapters(true);
      return;
    }
    setStep(3);
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex gap-2 text-sm" aria-label="진행 단계">
        {STEPS.map((label, index) => {
          const current = index + 1 === step;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={
                current
                  ? "bg-foreground text-background rounded-full px-3 py-1"
                  : "text-muted-foreground bg-muted rounded-full px-3 py-1"
              }
            >
              {index + 1}. {label}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">1. 함께 읽을 책 찾기</h2>
          <div className="flex gap-2">
            <Input
              aria-label="책 제목, 저자, 출판사 또는 ISBN"
              placeholder="책 제목, 저자, 출판사 또는 ISBN"
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
            제목, 저자, 출판사 어느 것으로든 찾을 수 있어요. 책을 고르면 다음
            단계로 넘어가요.
          </p>

          {search && !search.ok && (
            <p role="alert" className="text-destructive text-sm">
              {search.message}
            </p>
          )}
          {search?.ok && search.books.length === 0 && (
            <p className="text-sm">
              찾는 책이 없어요. 아래 버튼으로 책 정보를 직접 입력해 주세요.
            </p>
          )}
          {search?.ok && search.books.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-sm" role="status">
                {search.total !== null
                  ? `검색 결과 ${search.total.toLocaleString("ko-KR")}건 중 ${search.books.length}건`
                  : `검색 결과 ${search.books.length}건`}
              </p>
              {/* 결과가 길어도 화면이 끝없이 늘어나지 않게 이 칸 안에서 스크롤한다 */}
              <ul
                aria-label="검색 결과"
                className="bg-card max-h-[28rem] divide-y overflow-y-auto rounded-lg border"
              >
                {search.books.map((found) => (
                  <li key={found.isbn}>
                    <button
                      type="button"
                      className="hover:bg-accent flex w-full items-center gap-3 px-3 py-2 text-left"
                      onClick={() => choose(found.isbn)}
                      disabled={searching}
                    >
                      <BookCover
                        url={found.coverUrl}
                        title={found.title}
                        size="sm"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium">{found.title}</span>
                        <span className="text-muted-foreground text-sm">
                          {[
                            found.author,
                            found.translator && `${found.translator} 옮김`,
                            found.publisher,
                            found.year,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {search.nextPage && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadMore}
                  disabled={searching}
                >
                  {searching ? "불러오는 중…" : "더 보기"}
                </Button>
              )}
            </div>
          )}
          {pickError && (
            <p role="alert" className="text-destructive text-sm">
              {pickError}
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={enterManually}>
              검색 없이 직접 입력
            </Button>
            {book.title && (
              <Button type="button" onClick={() => setStep(2)}>
                다음
              </Button>
            )}
          </div>
        </section>
      )}

      <form
        action={formAction}
        // 단계가 바뀌어도 입력값이 함께 제출되도록 지우지 않고 숨기기만 한다.
        hidden={step === 1}
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          // 입력 칸에서 Enter를 눌러도 마지막 단계 전에는 제출하지 않는다.
          if (step !== 3) event.preventDefault();
        }}
        noValidate
      >
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="bookChoice" value={choice} />
        <input type="hidden" name="coverUrl" value={book.coverUrl} />

        <section hidden={step !== 2} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">2. 책 정보와 목차</h2>
          <p className="bg-muted rounded-lg p-3 text-sm">
            책 정보와 목차는 그룹을 만든 뒤에는 수정할 수 없어요. 감상이 목차의
            위치에 묶이기 때문이에요. 지금 한 번만 확인해 주세요.
          </p>
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}

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
            error={
              errors.title ??
              (titleMissing ? "책 제목을 입력해 주세요." : undefined)
            }
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
            readOnly={existing || source !== "manual"}
            error={errors.isbn}
            hint="책 뒤표지 바코드 아래의 13자리 숫자예요."
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chapters">목차 (선택, 권장)</Label>
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
            <div
              id="chapters-hint"
              className="bg-muted flex flex-col gap-2 rounded-lg p-3 text-sm"
            >
              <p>
                한 줄에 한 장씩 적어 주세요. 이 목차가 그룹 전체의 위치 기준이
                돼요.
              </p>
              <p className="font-medium">시작 쪽 적는 방법 (선택)</p>
              <ul className="flex flex-col gap-1">
                {PAGE_FORMATS.map(([example, meaning]) => (
                  <li key={example} className="flex flex-wrap gap-x-2">
                    <code className="bg-background rounded px-1.5">
                      {example}
                    </code>
                    <span className="text-muted-foreground">→ {meaning}</span>
                  </li>
                ))}
              </ul>
              <p>
                <span className="font-medium">주의:</span>{" "}
                <code>어린 새 7</code>처럼 <code>|</code>, <code>p</code>,{" "}
                <code>쪽</code> 표시 없이 숫자만 붙이면 쪽수인지 제목의 일부인지
                추측해서 읽기 때문에 틀릴 수 있어요. 위 형식 중 하나로 적는 것이
                정확해요.
              </p>
              <p className="text-muted-foreground">
                시작 쪽을 모든 장에 적으면 같은 책을 읽는 회원이 쪽수로 진도를
                입력할 수 있어요.
              </p>
            </div>
            {chapterCount > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">
                  이렇게 저장돼요 ({chapterCount}개 장)
                </p>
                <ol
                  aria-label="목차 미리 보기"
                  className="max-h-56 divide-y overflow-y-auto rounded-lg border text-sm"
                >
                  {parsedChapters.map((chapter) => (
                    <li
                      key={chapter.number}
                      className="flex items-baseline justify-between gap-3 px-3 py-1.5"
                    >
                      <span>
                        <span className="text-muted-foreground mr-2 tabular-nums">
                          {chapter.number}
                        </span>
                        {chapter.title}
                      </span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {chapter.startPage
                          ? `${chapter.startPage}쪽`
                          : "쪽수 없음"}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="text-muted-foreground text-sm">
                  제목과 쪽수가 잘못 나뉘었으면 그 줄을 <code>제목 | 쪽수</code>{" "}
                  형식으로 고쳐 주세요.
                </p>
              </div>
            )}
          </div>

          {confirmNoChapters && (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-lg border p-3 text-sm"
            >
              <p className="font-medium">목차 없이 진행할까요?</p>
              <p>
                목차가 없으면 책 전체를 하나로 보고 &ldquo;책 전체의 몇
                %&rdquo;로만 위치를 나눠요. 판본이 다르면 같은 %라도 내용이
                어긋나서, 아직 읽지 않은 내용이 보이는 스포일러가 생기기 쉬워요.
                장 제목만이라도 적는 것을 권장해요.
              </p>
              <p className="text-muted-foreground">
                그대로 진행하려면 다음을 한 번 더 눌러 주세요.
              </p>
            </div>
          )}

          <div className="flex justify-between gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              이전
            </Button>
            <Button type="button" onClick={leaveBookStep}>
              {confirmNoChapters ? "목차 없이 다음" : "다음"}
            </Button>
          </div>
        </section>

        <section hidden={step !== 3} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">3. 그룹 정보</h2>
          <p className="text-muted-foreground text-sm">
            {book.title}
            {chapterCount > 0
              ? ` · 목차 ${chapterCount}개 장`
              : " · 목차 없음(책 전체 %로 위치 표시)"}
          </p>
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
          <p className="text-muted-foreground text-sm">
            그룹 정보는 만든 뒤에도 그룹 설정에서 바꿀 수 있어요.
          </p>

          <div className="flex justify-between gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(2)}
              disabled={pending}
            >
              이전
            </Button>
            {step === 3 && (
              <Button type="submit" disabled={pending}>
                {pending ? "만드는 중…" : "그룹 만들기"}
              </Button>
            )}
          </div>
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
      </form>
    </div>
  );
}
