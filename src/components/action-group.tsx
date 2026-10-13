"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";

type Group = {
  openId: string | null;
  setOpenId: (id: string | null) => void;
};

const GroupContext = createContext<Group | null>(null);

// 버튼 묶음. 안에 든 펼침 칸(수정, 답글, 삭제 확인 등)은 한 번에 하나만 열린다.
// 다른 버튼을 누르면 먼저 열려 있던 칸은 닫혀서, 칸이 아래로 쌓이지 않는다.
export function ActionGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <GroupContext value={{ openId, setOpenId }}>
      <div className={className}>{children}</div>
    </GroupContext>
  );
}

// 펼침 칸 하나의 열림 상태. ActionGroup 안에 있으면 묶음이 관리하고, 밖에 있으면 혼자 기억한다.
export function usePanel(): [boolean, (open: boolean) => void] {
  const id = useId();
  const group = useContext(GroupContext);
  const [alone, setAlone] = useState(false);

  if (!group) return [alone, setAlone];
  return [group.openId === id, (open) => group.setOpenId(open ? id : null)];
}
