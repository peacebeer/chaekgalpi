import { expect, test } from "@playwright/test";

// 실제 계정이 필요 없는 범위만 확인한다. 로그인 성공 흐름은 M6에서 로컬 Supabase로 다룬다.

test("로그인하지 않고 프로필에 가면 로그인 화면으로 보내고 돌아올 곳을 기억한다", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("머리글에 로그인 버튼이 보인다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("빈 로그인 폼을 내면 칸마다 안내가 뜬다", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("이메일 주소를 확인해 주세요.")).toBeVisible();
  await expect(page.getByText("비밀번호를 입력해 주세요.")).toBeVisible();
});

test("가입할 때 짧은 비밀번호를 거부하고 입력한 값은 남긴다", async ({
  page,
}) => {
  await page.goto("/signup?next=%2Fjoin%2Fa1b2c3d4e5");
  await page.getByLabel("닉네임").fill("지은");
  await page.getByLabel("이메일").fill("jieun@example.com");
  await page.getByLabel("비밀번호").fill("1234567");
  await page.getByRole("button", { name: "가입하기" }).click();

  await expect(
    page.getByText("비밀번호는 8자 이상으로 정해 주세요."),
  ).toBeVisible();
  await expect(page.getByLabel("닉네임")).toHaveValue("지은");
  await expect(page.getByLabel("이메일")).toHaveValue("jieun@example.com");
  // 돌아갈 곳이 로그인 링크에도 이어진다.
  await expect(
    page.getByRole("link", { name: "로그인" }).last(),
  ).toHaveAttribute("href", "/login?next=%2Fjoin%2Fa1b2c3d4e5");
});
