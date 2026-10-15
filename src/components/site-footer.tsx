import Link from "next/link";

import { SITE } from "@/lib/site";

const LINK = "hover:text-foreground underline-offset-4 hover:underline";

// 모든 화면 맨 아래의 운영 정보 링크
export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t text-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <nav aria-label="운영 정보" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/terms" className={LINK}>
            이용약관
          </Link>
          <Link
            href="/privacy"
            className={`${LINK} text-foreground font-medium`}
          >
            개인정보처리방침
          </Link>
          <a
            href={SITE.contactUrl}
            className={LINK}
            target="_blank"
            rel="noreferrer"
          >
            문의
          </a>
          <a
            href={SITE.sourceUrl}
            className={LINK}
            target="_blank"
            rel="noreferrer"
          >
            소스 코드
          </a>
        </nav>
        <p className="text-xs">
          © 2026 {SITE.name} · 비상업 개인 프로젝트 · 책 본문은 싣지 않아요.
        </p>
      </div>
    </footer>
  );
}
