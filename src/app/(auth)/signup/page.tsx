import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "가입 · 책갈피" };

export default function SignupPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:px-8 sm:py-10">
      <div className="bg-card flex flex-col gap-6 rounded-xl border p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">가입</h1>
        <Suspense>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </main>
  );
}
