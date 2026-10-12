// DB 함수·트리거가 던지는 영어 키와 Postgres 오류 코드를 화면 문구로 바꾼다.
// 표의 출처는 AGENTS.md "DB 오류 키 → 화면 문구". 문구는 이 파일에서만 고친다.

const QUOTE_LENGTH = "인용문을 1~300자로 입력해 주세요.";
const POSITION_INVALID = "위치를 다시 선택해 주세요.";
const CANNOT_REPLY = "이 글에는 답할 수 없어요.";

export const ERROR_MESSAGES = {
  not_authenticated: "로그인이 필요해요.",
  not_member: "이 그룹의 회원만 할 수 있어요.",
  not_owner: "그룹 리더만 할 수 있어요.",
  group_not_found: "그룹을 찾을 수 없어요. 초대 코드를 확인해 주세요.",
  group_full: "그룹 정원이 가득 찼어요.",
  quote_empty: QUOTE_LENGTH,
  quote_too_long: QUOTE_LENGTH,
  body_required: "인용과 함께 감상을 적어 주세요.",
  quote_limit_exceeded:
    "이 그룹의 인용 한도(10,000자)를 넘어서 등록할 수 없어요.",
  quote_locked: "다른 회원의 감상이 달린 카드는 오타 수정만 할 수 있어요.",
  quote_position_immutable: "인용 카드의 위치는 바꿀 수 없어요.",
  position_invalid: POSITION_INVALID,
  chapter_not_found: POSITION_INVALID,
  position_ahead_of_progress:
    "아직 읽지 않은 위치예요. 진도를 먼저 기록해 주세요.",
  progress_out_of_range: "목차에 없는 장이에요.",
  page_invalid: "쪽수를 확인해 주세요.",
  page_mapping_unavailable:
    "이 책은 쪽수 입력을 지원하지 않아요. 장과 위치를 골라 주세요.",
  note_parent_invalid: CANNOT_REPLY,
  note_quote_invalid: CANNOT_REPLY,
  reply_depth_exceeded: CANNOT_REPLY,
  "42501": "권한이 없어요.",
  "23505": "이미 처리됐어요.",
} as const;

// Supabase Auth가 돌려주는 error.code → 화면 문구
export const AUTH_ERROR_MESSAGES = {
  invalid_credentials: "이메일 또는 비밀번호가 맞지 않아요.",
  email_not_confirmed:
    "이메일 인증이 아직 끝나지 않았어요. 받은 메일의 링크를 눌러 주세요.",
  user_already_exists: "이미 가입한 이메일이에요. 로그인해 주세요.",
  email_exists: "이미 가입한 이메일이에요. 로그인해 주세요.",
  weak_password: "더 길고 추측하기 어려운 비밀번호로 정해 주세요.",
  email_address_invalid: "이메일 주소를 확인해 주세요.",
  over_email_send_rate_limit:
    "메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.",
  over_request_rate_limit: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
  signup_disabled: "지금은 새로 가입할 수 없어요.",
  provider_disabled: "이 로그인 방법은 아직 준비 중이에요.",
  // /auth/callback에서 로그인 마무리에 실패했을 때 쓰는 우리 쪽 키
  auth_callback_failed:
    "로그인을 마치지 못했어요. 링크를 연 브라우저가 처음과 같은지 확인하고 다시 시도해 주세요.",
} as const;

export type AuthErrorKey = keyof typeof AUTH_ERROR_MESSAGES;

export type ErrorKey = keyof typeof ERROR_MESSAGES;

export const DEFAULT_ERROR_MESSAGE =
  "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";

function isErrorKey(value: unknown): value is ErrorKey {
  return typeof value === "string" && Object.hasOwn(ERROR_MESSAGES, value);
}

export function toAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown }).code
      : error;
  if (typeof code === "string" && Object.hasOwn(AUTH_ERROR_MESSAGES, code)) {
    return AUTH_ERROR_MESSAGES[code as AuthErrorKey];
  }
  return DEFAULT_ERROR_MESSAGE;
}

// Supabase(PostgREST) 오류는 { code, message } 모양이다.
// raise exception '키' 는 message에, RLS 거부·중복은 code에 담겨 온다.
export function toErrorMessage(error: unknown): string {
  if (isErrorKey(error)) return ERROR_MESSAGES[error];

  if (typeof error === "object" && error !== null) {
    const { message, code } = error as { message?: unknown; code?: unknown };
    const key = typeof message === "string" ? message.trim() : message;
    if (isErrorKey(key)) return ERROR_MESSAGES[key];
    if (isErrorKey(code)) return ERROR_MESSAGES[code];
  }

  return DEFAULT_ERROR_MESSAGE;
}
