import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { LIMITS } from "@/lib/validation/limits";

const POINTS = [
  [
    "각자의 속도로",
    "모임 시간을 맞출 필요가 없어요. 읽은 만큼 진도를 기록하면 돼요.",
  ],
  [
    "스포일러 없이",
    "아직 읽지 않은 곳의 인용과 감상은 내 진도가 닿을 때까지 열리지 않아요.",
  ],
  [
    "어떤 판본이든",
    "종이책, 전자책, 도서관 책 모두 괜찮아요. 위치는 장과 %로 맞춰요.",
  ],
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-12 sm:px-8 lg:py-20">
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <h1 className="text-primary text-lg font-semibold">책갈피</h1>
          <p className="text-3xl leading-snug font-semibold tracking-tight sm:text-4xl">
            같은 책을 읽고,
            <br />
            읽은 자리마다 생각을 나눠요
          </p>
          <p className="text-muted-foreground leading-7">
            소그룹이 한 권을 함께 읽으며 마음에 남은 문장과 감상을 주고받는 교환
            독서 공간이에요. 책 본문은 싣지 않고, 각자 구한 책으로 읽어요.
          </p>
          <div className="flex flex-wrap gap-2">
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
          <p className="text-muted-foreground/80 text-xs">
            저작권 보호를 위해 인용은 카드 한 장에{" "}
            {LIMITS.quoteTextMax.toLocaleString("ko-KR")}자, 그룹 전체에{" "}
            {LIMITS.groupQuoteLimit.toLocaleString("ko-KR")}자까지로 제한해요.
          </p>
        </div>

        {/* 서비스가 어떻게 보이는지 알려 주는 예시. 지어낸 문장이다. */}
        <div aria-hidden className="flex flex-col gap-3">
          <figure className="bg-card overflow-hidden rounded-xl border">
            <div className="bg-accent flex flex-col gap-3 px-6 pt-5 pb-6">
              <figcaption className="flex items-center gap-2 text-sm">
                <span className="bg-primary text-primary-foreground rounded-md px-2">
                  인용
                </span>
                2장 · 40%
              </figcaption>
              <span className="font-quote text-primary -mb-3 h-7 text-6xl leading-none">
                “
              </span>
              <blockquote className="font-quote text-xl leading-loose">
                책을 고르는 사람의 손끝은 늘 조금 망설인다. 그 망설임이 좋아서
                나는 서점 문을 닫지 못했다.
              </blockquote>
            </div>
            <div className="flex gap-3 px-6 py-5">
              <span className="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                민
              </span>
              <p className="leading-7">
                망설임을 좋아한다는 말이 오래 남았어요. 요즘은 뭐든 빨리
                고르라고만 하니까요.
              </p>
            </div>
          </figure>
          <div className="border-input flex flex-col gap-3 rounded-xl border border-dashed p-5">
            <div className="flex flex-col gap-2 blur-[2px]">
              <div className="bg-muted h-3 w-11/12 rounded" />
              <div className="bg-muted h-3 w-8/12 rounded" />
            </div>
            <p className="text-sm">
              아직 읽지 않은 곳에 인용 카드 2개, 감상 5개가 있어요. 진도가
              닿으면 열려요.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {POINTS.map(([title, body]) => (
          <div
            key={title}
            className="bg-card flex flex-col gap-2 rounded-xl border p-5"
          >
            <h2 className="font-semibold">{title}</h2>
            <p className="text-muted-foreground text-sm leading-6">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
