"use client";

import { useActionState } from "react";

import { joinGroup } from "@/app/groups/actions";
import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE } from "@/lib/form-state";

// 초대 코드 또는 공개 그룹 id 중 하나를 넘긴다.
type JoinFormProps = { inviteCode: string } | { groupId: string };

export function JoinForm(props: JoinFormProps) {
  const [state, formAction, pending] = useActionState(
    joinGroup,
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {"inviteCode" in props ? (
        <input type="hidden" name="inviteCode" value={props.inviteCode} />
      ) : (
        <input type="hidden" name="groupId" value={props.groupId} />
      )}
      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "입장하는 중…" : "그룹에 입장하기"}
      </Button>
    </form>
  );
}
