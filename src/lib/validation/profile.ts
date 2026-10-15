import { z } from "zod";

import { boundedText } from "./common";
import { LIMITS } from "./limits";

export const nicknameSchema = boundedText(
  1,
  LIMITS.nicknameMax,
  `닉네임을 1~${LIMITS.nicknameMax}자로 입력해 주세요.`,
);

export const profileSchema = z.object({
  nickname: nicknameSchema,
});

export type ProfileInput = z.infer<typeof profileSchema>;
