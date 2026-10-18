import { expect, test } from "@playwright/test";

// 가입 없이 체험하기: 익명 로그인 → 예시 글이 채워진 체험 그룹 → 진도를 올리면 잠긴 글이 열린다.
// Supabase에서 익명 로그인을 켜야 해서 E2E_DEMO=1일 때만 돈다(CI의 로컬 Supabase는 켜져 있다).
const SECOND_CHAPTER_QUOTE = "비가 오면 사람들은 책을 사러 오지 않고";

test.skip(process.env.E2E_DEMO !== "1", "E2E_DEMO=1일 때만 실행");

test("체험하기로 들어가 진도를 올리면 잠긴 글이 열린다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "가입 없이 체험하기" }).click();
  await page.waitForURL(/\/groups\/[0-9a-f-]{36}$/);

  await expect(page.getByText("체험 중")).toBeVisible();
  await expect(page.getByText(/체험 그룹이에요/)).toBeVisible();
  await expect(page.getByText(/문을 열기 전 십 분/)).toBeVisible();
  // 2장 카드는 내 진도(1장 60%)보다 뒤라 내용이 아예 내려오지 않는다.
  expect(await page.content()).not.toContain(SECOND_CHAPTER_QUOTE);

  // 토론 준비: 내가 읽은 범위(1장)의 이야기 거리만 모인다.
  await page.getByRole("link", { name: "토론 준비" }).click();
  await expect(
    page.getByRole("heading", { name: "토론 준비 도우미" }),
  ).toBeVisible();
  await expect(page.getByText(/서점 이름이 왜 끝까지/)).toBeVisible();
  await expect(
    page.getByText("체험 독자 (나) 님은 아직 1장을", { exact: false }),
  ).toBeVisible();
  expect(await page.content()).not.toContain(SECOND_CHAPTER_QUOTE);
  // 감상문 도우미: 아직 내 글이 없으면 무엇을 하면 되는지 알려 준다.
  await page.getByRole("link", { name: "감상문" }).click();
  await expect(
    page.getByRole("heading", { name: "감상문 도우미" }),
  ).toBeVisible();
  await expect(page.getByText(/아직 이 그룹에 남긴 글이 없어요/)).toBeVisible();
  await expect(page.getByLabel("감상문 초안")).toHaveValue(/을 읽고/);
  await page.getByRole("link", { name: "인용과 감상" }).click();

  // 진도를 2장 50%로 올린다. 막대는 fill로 채울 수 없어 값을 넣고 input 이벤트를 보낸다.
  await page.getByRole("button", { name: "내 진도 기록" }).click();
  const panel = page.locator("#tool-progress");
  await panel.getByLabel("읽고 있는 장").selectOption("2");
  await panel.locator('input[type="range"]').evaluate((element) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, "50");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await panel.getByRole("button", { name: "진도 저장" }).click();
  await expect(panel.getByText("진도를 저장했어요")).toBeVisible();
  // 저장한 뒤에도 고른 값이 그대로 보여야 한다(폼 자동 초기화로 1장으로 돌아가던 문제).
  await expect(panel.getByLabel("읽고 있는 장")).toHaveValue("2");

  await expect(page.getByText(SECOND_CHAPTER_QUOTE)).toBeVisible();

  // 완독을 저장하면 체크가 유지되고, 풀어서 다시 저장하면 풀린 채로 남는다.
  const finished = panel.getByRole("checkbox");
  await finished.check();
  await panel.getByRole("button", { name: "진도 저장" }).click();
  await expect(panel.getByText(/완독을 기록했어요/)).toBeVisible();
  await expect(finished).toBeChecked();
  await finished.uncheck();
  await panel.getByRole("button", { name: "진도 저장" }).click();
  await expect(panel.getByText("진도를 저장했어요")).toBeVisible();
  await expect(finished).not.toBeChecked();

  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("link", { name: "로그인" })).toBeVisible();
});
