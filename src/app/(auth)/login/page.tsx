import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "로그인 · 책갈피" };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:px-8 sm:py-10">
      <div className="bg-card flex flex-col gap-6 rounded-xl border p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        {/* 폼이 주소의 ?next= 값을 읽으므로 Suspense 안에 둔다 */}
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </main>
  );
}
