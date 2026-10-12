import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">책갈피</h1>
      <p className="text-muted-foreground leading-7">
        같은 책을 읽는 소그룹이 읽은 위치마다 감상과 인용을 나눠요. 아직 읽지
        않은 곳의 이야기는 그 자리에 닿을 때까지 열리지 않아요.
      </p>
      <div className="flex gap-2">
        <Link href="/groups/new" className={buttonVariants({ size: "lg" })}>
          그룹 만들기
        </Link>
        <Link
          href="/groups"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          그룹 둘러보기
        </Link>
      </div>
    </main>
  );
}
