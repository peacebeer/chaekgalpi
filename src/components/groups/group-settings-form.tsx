"use client";

import { useActionState, useState } from "react";

import { updateGroup } from "@/app/groups/[id]/settings/actions";
import { Field } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation/limits";

type GroupSettingsFormProps = {
  groupId: string;
  memberCount: number;
  initial: {
    name: string;
    capacity: number;
    startDate: string;
    targetDate: string;
    isPublic: boolean;
  };
};

export function GroupSettingsForm({
  groupId,
  memberCount,
  initial,
}: GroupSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateGroup,
    EMPTY_FORM_STATE,
  );
  // 오류 뒤에도 입력을 지키기 위해 직접 관리한다.
  const [group, setGroup] = useState({
    ...initial,
    capacity: String(initial.capacity),
  });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="groupId" value={groupId} />
      <Field
        name="name"
        label="그룹 이름"
        value={group.name}
        onChange={(event) => setGroup({ ...group, name: event.target.value })}
        maxLength={LIMITS.groupNameMax}
        error={errors.name}
        required
      />
      <Field
        name="capacity"
        label="정원"
        type="number"
        min={Math.max(LIMITS.capacityMin, memberCount)}
        max={LIMITS.capacityMax}
        value={group.capacity}
        onChange={(event) =>
          setGroup({ ...group, capacity: event.target.value })
        }
        error={errors.capacity}
        hint={`${LIMITS.capacityMin}~${LIMITS.capacityMax}명. 지금 회원은 ${memberCount}명이에요.`}
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
            켜면 그룹 목록에 보이고 누구나 들어올 수 있어요. 끄면 초대 링크를
            받은 사람만 들어와요. 이미 들어온 회원은 그대로 남아요.
          </span>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm">
          {state.notice}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "저장하는 중…" : "저장"}
      </Button>
    </form>
  );
}
