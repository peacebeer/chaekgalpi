// DB 제약(supabase/migrations)과 같은 숫자. DB를 바꾸면 여기도 함께 바꾼다.
export const LIMITS = {
  nicknameMax: 30,
  regionMax: 30,
  bookTitleMax: 200,
  bookPersonMax: 200,
  publisherMax: 100,
  chapterTitleMax: 200,
  groupNameMax: 50,
  capacityMin: 3,
  capacityMax: 8,
  quoteTextMax: 300,
  groupQuoteLimit: 10_000,
  noteBodyMax: 2000,
} as const;
