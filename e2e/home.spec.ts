import { expect, test } from "@playwright/test";

test("첫 화면에 서비스 이름이 보인다", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "책갈피" }),
  ).toBeVisible();
});

test("맨 아래 링크로 이용약관과 개인정보처리방침을 볼 수 있다", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "개인정보처리방침" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "개인정보처리방침" }),
  ).toBeVisible();
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "이용약관" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "이용약관" }),
  ).toBeVisible();
});
