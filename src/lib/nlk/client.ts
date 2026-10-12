import {
  nlkResponseSchema,
  safeTocUrl,
  toNlkBooks,
  type NlkBook,
} from "./parse";

// 국립중앙도서관 ISBN 서지정보 API. 서버에서만 부른다(인증키가 주소에 들어간다).
// 실패하면 예외를 던지고, 부르는 쪽이 "직접 입력" 흐름으로 넘긴다.
const ENDPOINT = "https://www.nl.go.kr/seoji/SearchApi.do";
const TIMEOUT_MS = 8000;
const TOC_MAX_BYTES = 100_000;

// 잘못 읽힌 글자 자리에 들어가는 문자(U+FFFD)
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);

const ISBN_QUERY = /^[0-9X]{10}([0-9]{3})?$/;

export async function searchNlk(query: string): Promise<NlkBook[]> {
  const key = process.env.NLK_API_KEY;
  if (!key) throw new Error("NLK_API_KEY is not set");

  const compact = query.replace(/[\s-]/g, "").toUpperCase();
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    cert_key: key,
    result_style: "json",
    page_no: "1",
    page_size: "20",
    ...(ISBN_QUERY.test(compact) ? { isbn: compact } : { title: query }),
  }).toString();

  // 인증키가 들어 있으므로 url을 로그나 오류 메시지에 싣지 않는다.
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`NLK responded ${response.status}`);

  const { docs } = nlkResponseSchema.parse(await response.json());
  return toNlkBooks(docs);
}

// 목차 파일(텍스트)을 읽는다. 없거나 읽지 못하면 null.
export async function fetchNlkToc(
  tocUrl: string | null,
): Promise<string | null> {
  const url = tocUrl && safeTocUrl(tocUrl);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > TOC_MAX_BYTES) return null;

    // 대부분 UTF-8이고, 깨지면 오래된 파일의 EUC-KR로 다시 읽는다.
    const utf8 = new TextDecoder("utf-8").decode(bytes);
    return utf8.includes(REPLACEMENT_CHAR)
      ? new TextDecoder("euc-kr").decode(bytes)
      : utf8;
  } catch {
    return null;
  }
}
