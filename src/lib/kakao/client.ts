import { kakaoResponseSchema, toKakaoBooks, type KakaoBook } from "./parse";

// 카카오 책 검색 API. 서버에서만 부른다(REST API 키를 헤더에 싣는다).
// 제목·저자·출판사·ISBN을 한 검색어로 찾고, 정확도순으로 돌려준다.
// 실패하면 예외를 던지고, 부르는 쪽이 도서관 검색이나 "직접 입력"으로 넘긴다.
const ENDPOINT = "https://dapi.kakao.com/v3/search/book";
const TIMEOUT_MS = 8000;

export const KAKAO_PAGE_SIZE = 20;
// 카카오가 허용하는 마지막 쪽
const MAX_PAGE = 50;

export type KakaoSearchResult = {
  books: KakaoBook[];
  // 조건에 맞는 전체 건수(카카오가 보여 줄 수 있는 범위 안에서)
  total: number;
  // 더 가져올 쪽이 없는지
  isEnd: boolean;
};

export function hasKakaoKey(): boolean {
  return Boolean(process.env.KAKAO_REST_API_KEY);
}

export async function searchKakao(
  query: string,
  options: { page?: number; isbnOnly?: boolean } = {},
): Promise<KakaoSearchResult> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error("KAKAO_REST_API_KEY is not set");

  const page = Math.min(Math.max(options.page ?? 1, 1), MAX_PAGE);
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    query,
    page: String(page),
    size: String(KAKAO_PAGE_SIZE),
    sort: "accuracy",
    ...(options.isbnOnly ? { target: "isbn" } : {}),
  }).toString();

  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Kakao responded ${response.status}`);

  const { meta, documents } = kakaoResponseSchema.parse(await response.json());
  return {
    books: toKakaoBooks(documents),
    total: meta.pageable_count,
    isEnd: meta.is_end || page >= MAX_PAGE,
  };
}
