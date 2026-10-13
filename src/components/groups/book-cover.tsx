import Image from "next/image";

type BookCoverProps = {
  // 표지 이미지 주소(카카오 이미지 서버). 없으면 책 제목을 넣은 책등 모양을 그린다.
  url: string | null | undefined;
  title: string;
  size?: "sm" | "md" | "lg";
};

// 카카오 표지 썸네일의 비율(120×174)에 맞춘 크기
const SIZES = {
  sm: { width: 40, height: 58, text: "text-[0.5rem]" },
  md: { width: 56, height: 81, text: "text-[0.625rem]" },
  lg: { width: 96, height: 139, text: "text-xs" },
} as const;

export function BookCover({ url, title, size = "md" }: BookCoverProps) {
  const { width, height, text } = SIZES[size];

  if (url) {
    return (
      <Image
        src={url}
        // 바로 옆에 제목이 글자로 있으므로 장식으로 둔다.
        alt=""
        width={width}
        height={height}
        // 이미 작은 썸네일이라 다시 줄이지 않는다.
        unoptimized
        className="bg-muted shrink-0 rounded-sm border object-cover"
        style={{ width, height }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`bg-primary text-primary-foreground flex shrink-0 items-end rounded-sm p-1 leading-tight ${text}`}
      style={{ width, height }}
    >
      <span className="line-clamp-3">{title}</span>
    </div>
  );
}
