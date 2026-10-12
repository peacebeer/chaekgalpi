import { z } from "zod";

import { boundedText, optionalText } from "./common";
import { LIMITS } from "./limits";

export const nicknameSchema = boundedText(
  1,
  LIMITS.nicknameMax,
  `닉네임을 1~${LIMITS.nicknameMax}자로 입력해 주세요.`,
);

export const profileSchema = z.object({
  nickname: nicknameSchema,
  region: optionalText(
    LIMITS.regionMax,
    `지역은 ${LIMITS.regionMax}자까지 입력할 수 있어요.`,
  ),
});

export type ProfileInput = z.infer<typeof profileSchema>;
