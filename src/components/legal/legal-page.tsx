import type { ReactNode } from "react";

import { SITE } from "@/lib/site";

type LegalPageProps = {
  title: string;
  summary: string;
  children: ReactNode;
};

// 이용약관·개인정보처리방침 같은 긴 글 화면의 공통 틀
export function LegalPage({ title, summary, children }: LegalPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">
          시행일: {SITE.policyDate}
        </p>
        <p className="bg-accent rounded-lg p-4 text-sm leading-6">{summary}</p>
      </header>
      <div className="bg-card flex flex-col gap-8 rounded-xl border p-6 text-sm leading-7 sm:p-8 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_section]:flex [&_section]:flex-col [&_section]:gap-2">
        {children}
      </div>
    </main>
  );
}
