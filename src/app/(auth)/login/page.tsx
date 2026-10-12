import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "로그인 · 책갈피" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
      {/* 폼이 주소의 ?next= 값을 읽으므로 Suspense 안에 둔다 */}
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
