import { expect, test } from "@playwright/test";

// 로그인 없이 확인할 수 있는 범위. 그룹 생성·입장 흐름은 M6에서 로컬 Supabase로 다룬다.

for (const path of ["/groups", "/groups/new"]) {
  test(`로그인하지 않고 ${path}에 가면 로그인 화면으로 보낸다`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page).toHaveURL(
      new RegExp(`/login\\?next=${encodeURIComponent(path)}$`),
    );
  });
}

test("초대 링크로 오면 로그인 뒤 같은 초대 화면으로 돌아오게 한다", async ({
  page,
}) => {
  await page.goto("/join/A1B2C3D4E5");
  await expect(page).toHaveURL(/\/login\?next=%2Fjoin%2Fa1b2c3d4e5$/);
});

test("잘못된 초대 코드는 로그인 전에 안내한다", async ({ page }) => {
  await page.goto("/join/not-a-code");
  await expect(page.getByText("초대 링크가 올바르지 않아요.")).toBeVisible();
});

test("첫 화면에서 그룹 만들기로 갈 수 있다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "그룹 만들기" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fgroups%2Fnew$/);
});
