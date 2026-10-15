"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  versionSummary,
  VERSIONS_SHOWN,
  type TocVersion,
} from "@/lib/books/versions";

type TocVersionPickerProps = {
  // 추천 순서로 정렬된 같은 ISBN의 목차 버전
  versions: TocVersion[];
  // 그대로 쓰려고 고른 버전 id("" = 고르지 않음)
  selected: string;
  // 바탕으로 고쳐 만들고 있는 버전 id("" = 아님)
  basedOn: string;
  // "새로 만들기"를 누르면 도서관 목차로 시작하는지
  libraryTocAvailable: boolean;
  onUse: (version: TocVersion) => void;
  onEditFrom: (version: TocVersion) => void;
  onFresh: () => void;
};

// 앞쪽 장 제목 몇 개로 목차를 미리 보여 준다.
function preview(version: TocVersion): string {
  const titles = version.chaptersText
    .split("\n")
    .map((line) => line.replace(/\s*\|\s*\d+$/, ""));
  const head = titles.slice(0, 4).join(" · ");
  return titles.length > 4 ? `${head} …` : head;
}

// 같은 ISBN으로 저장된 목차 버전 중 하나를 고르거나, 바탕으로 고치거나, 새로 만든다.
export function TocVersionPicker({
  versions,
  selected,
  basedOn,
  libraryTocAvailable,
  onUse,
  onEditFrom,
  onFresh,
}: TocVersionPickerProps) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? versions : versions.slice(0, VERSIONS_SHOWN);
  const hidden = versions.length - shown.length;
  const editing = versions.find((version) => version.id === basedOn);

  return (
    <section
      aria-label="저장된 목차"
      className="flex flex-col gap-3 rounded-lg border p-3 text-sm"
    >
      <p>
        이 책에 저장된 목차가 {versions.length}개 있어요. 다른 그룹이 쓰는
        목차를 고르면 입력할 필요가 없어요.
      </p>
      <ul className="flex flex-col gap-2">
        {shown.map((version, index) => {
          const isSelected = version.id === selected;
          return (
            <li
              key={version.id}
              className={`flex flex-col gap-2 rounded-lg border p-3 ${
                isSelected ? "border-primary bg-accent" : "bg-card"
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">
                  {index === 0 ? "추천 · " : ""}목차 {index + 1}
                </p>
                <p className="text-muted-foreground">
                  {versionSummary(version)}
                </p>
                <p className="text-muted-foreground line-clamp-1">
                  {preview(version)}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditFrom(version)}
                >
                  바탕으로 고쳐 만들기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  aria-pressed={isSelected}
                  onClick={() => onUse(version)}
                >
                  {isSelected ? "이 목차 쓰는 중" : "이 목차 쓰기"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowAll(true)}
          >
            다른 목차 {hidden}개 더 보기
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-muted-foreground">
          {selected
            ? "고른 목차를 그대로 써요. 책 정보와 목차는 고칠 수 없어요."
            : editing
              ? `목차 ${versions.indexOf(editing) + 1}번을 바탕으로 새 목차를 만들어요. 아래에서 고쳐 주세요.`
              : "새 목차를 만들어요. 아래에서 입력해 주세요."}
        </p>
        <Button
          type="button"
          size="sm"
          variant={!selected && !editing ? "default" : "outline"}
          onClick={onFresh}
        >
          {libraryTocAvailable ? "도서관 목차로 새로 만들기" : "새로 만들기"}
        </Button>
      </div>
    </section>
  );
}
