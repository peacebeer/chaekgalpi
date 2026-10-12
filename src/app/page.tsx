export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">책갈피</h1>
      <p className="text-muted-foreground">
        같은 책을 읽는 소그룹이 읽은 위치마다 감상과 인용을 나눠요. 아직 읽지
        않은 곳의 이야기는 그 자리에 닿을 때까지 열리지 않아요.
      </p>
    </main>
  );
}
