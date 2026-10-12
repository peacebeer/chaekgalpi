import { z } from "zod";

import { boundedText, optionalDateSchema, uuidSchema } from "./common";
import { LIMITS } from "./limits";

const CAPACITY_MESSAGE = `정원은 ${LIMITS.capacityMin}~${LIMITS.capacityMax}명으로 정해 주세요.`;

export const groupSchema = z
  .object({
    bookId: uuidSchema,
    name: boundedText(
      1,
      LIMITS.groupNameMax,
      `그룹 이름을 1~${LIMITS.groupNameMax}자로 입력해 주세요.`,
    ),
    capacity: z
      .number(CAPACITY_MESSAGE)
      .int(CAPACITY_MESSAGE)
      .min(LIMITS.capacityMin, CAPACITY_MESSAGE)
      .max(LIMITS.capacityMax, CAPACITY_MESSAGE)
      .default(LIMITS.capacityMax),
    startDate: optionalDateSchema,
    targetDate: optionalDateSchema,
    isPublic: z.boolean().default(false),
  })
  .refine(
    // YYYY-MM-DD는 문자열 비교가 곧 날짜 비교다.
    ({ startDate, targetDate }) =>
      !startDate || !targetDate || targetDate >= startDate,
    {
      path: ["targetDate"],
      message: "목표 완독일은 시작일과 같거나 그 뒤여야 해요.",
    },
  );

export type GroupInput = z.infer<typeof groupSchema>;

// groups.invite_code 기본값: md5 앞 10자(소문자 16진수)
export const inviteCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[0-9a-f]{10}$/, "초대 코드를 확인해 주세요.");

// rpc('join_group')은 초대 코드나 공개 그룹 id 중 하나를 받는다.
export const joinGroupSchema = z.union([
  z.object({ inviteCode: inviteCodeSchema }),
  z.object({ groupId: uuidSchema }),
]);

export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
