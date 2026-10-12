import { expect, test } from "@playwright/test";

test("첫 화면에 서비스 이름이 보인다", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "책갈피" }),
  ).toBeVisible();
});
