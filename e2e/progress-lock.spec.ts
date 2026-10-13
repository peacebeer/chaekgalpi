import { expect, test, type Locator, type Page } from "@playwright/test";

import { e2eAccounts, type E2EAccount } from "./accounts";

// 책갈피의 핵심 흐름:
// A 그룹 생성 → B 초대 입장 → A가 2장에 카드 등록 → 1장을 읽는 B에게는 흐림 → B 진도 2장 → 카드 보임
const accounts = e2eAccounts();

async function login(page: Page, account: E2EAccount) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(account.email);
  await page.getByLabel("비밀번호").fill(account.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
}

// 막대(range)는 fill로 채울 수 없어, 값을 넣고 React가 알아채도록 input 이벤트를 보낸다.
async function setSlider(slider: Locator, value: number) {
  await slider.evaluate((element, next) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function saveProgress(page: Page, chapter: string, pct: number) {
  const panel = page.locator("#tool-progress");
  if (!(await panel.isVisible())) {
    await page.getByRole("button", { name: /^내 진도/ }).click();
  }
  await panel.getByLabel("읽고 있는 장").selectOption(chapter);
  await setSlider(panel.locator('input[type="range"]'), pct);
  await panel.getByRole("button", { name: "진도 저장" }).click();
  await expect(panel.getByText("진도를 저장했어요")).toBeVisible();
}

// 테스트가 만든 그룹을 지운다(회원·카드·감상도 함께 지워진다). 리더로 로그인한 화면에서 부른다.
async function deleteGroup(page: Page, groupPath: string) {
  await page.goto(`${groupPath}/settings`);
  await page.getByRole("button", { name: "그룹 삭제" }).click();
  await page.getByRole("button", { name: "영구 삭제" }).click();
  await page.waitForURL(/\/groups$/);
}

test.describe("진도 잠금 흐름", () => {
  test.skip(
    !accounts,
    "E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD / E2E_USER_B_EMAIL / E2E_USER_B_PASSWORD 가 없어 건너뜀",
  );
  test.setTimeout(120_000);

  test("아직 읽지 않은 장의 인용 카드는 진도가 닿을 때까지 보이지 않는다", async ({
    browser,
  }, testInfo) => {
    // 같은 계정으로 모바일·데스크톱이 동시에 돌아도 겹치지 않게 이름에 표시를 붙인다.
    const tag = `${testInfo.project.name}-${Date.now()}`;
    const groupName = `E2E 그룹 ${tag}`;
    const quoteText = `E2E 인용문 ${tag} 아무도 모르는 2장의 문장`;
    const noteText = `E2E 감상 ${tag}`;

    // 돌릴 때마다 책이 쌓이지 않도록 정해 둔 가짜 ISBN의 책 한 권을 다시 쓴다.
    // (책은 지울 권한이 없게 설계돼 있어 테스트가 치울 수 없다.)
    const isbn =
      testInfo.project.name === "mobile" ? "9790000000011" : "9790000000028";
    let groupPath: string | null = null;

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await login(pageA, accounts!.a);
      await login(pageB, accounts!.b);

      // A: 목차 3장짜리 책으로 그룹을 만든다 -------------------------------------
      await pageA.goto("/groups/new");
      await pageA.getByRole("button", { name: "검색 없이 직접 입력" }).click();
      await pageA
        .getByLabel("책 제목")
        .fill(`E2E 책 (${testInfo.project.name})`);
      await pageA.getByLabel("ISBN (선택)").fill(isbn);
      await pageA.getByLabel(/^목차/).fill("처음\n가운데\n끝");
      await pageA.getByRole("button", { name: "다음" }).click();
      await pageA.getByLabel("그룹 이름").fill(groupName);
      await pageA.getByRole("button", { name: "그룹 만들기" }).click();

      // 두 번째 실행부터는 같은 ISBN의 책이 이미 있어 되묻는다. 등록된 책을 그대로 쓴다.
      const created = pageA.getByRole("heading", { level: 1, name: groupName });
      const reuse = pageA.getByRole("button", {
        name: "등록된 목차 그대로 쓰기",
      });
      await expect(created.or(reuse)).toBeVisible();
      if (await reuse.isVisible()) {
        await reuse.click();
        await expect(pageA.getByLabel("책 제목")).toHaveAttribute("readonly");
        await pageA.getByRole("button", { name: "다음" }).click();
        await pageA.getByRole("button", { name: "그룹 만들기" }).click();
      }
      await expect(created).toBeVisible();
      await pageA.waitForURL(/\/groups\/[0-9a-f-]{36}$/);
      const groupUrl = new URL(pageA.url()).pathname;
      groupPath = groupUrl;

      // A: 초대 링크를 얻는다 ------------------------------------------------------
      await pageA.getByRole("link", { name: "그룹 정보" }).click();
      await pageA.waitForURL(/tab=info/);
      const inviteLink = await pageA
        .getByRole("textbox", { name: "초대 링크" })
        .inputValue();
      expect(inviteLink).toMatch(/\/join\/[0-9a-f]{10}$/);

      // B: 초대 링크로 입장한다 (진도는 1장 0%에서 시작) ------------------------------
      await pageB.goto(new URL(inviteLink).pathname);
      await pageB.getByRole("button", { name: "그룹에 입장하기" }).click();
      await expect(
        pageB.getByRole("heading", { level: 1, name: groupName }),
      ).toBeVisible();

      // A: 진도를 2장 50%로 옮기고, 2장에 인용 카드를 등록한다 -------------------------
      await pageA.goto(groupUrl);
      await saveProgress(pageA, "2", 50);
      await pageA.getByRole("button", { name: "글 남기기" }).click();
      const composer = pageA.locator("#tool-compose");
      await composer.getByLabel("인용문").fill(quoteText);
      await composer.getByLabel("내 감상 (필수)").fill(noteText);
      await composer.getByRole("button", { name: "인용 카드 등록" }).click();
      await expect(composer.getByText("인용 카드를 등록했어요.")).toBeVisible();
      await expect(pageA.getByText(quoteText)).toBeVisible();

      // B: 1장을 읽는 중이라 카드가 보이지 않고, 개수만 흐리게 보인다 -------------------
      await pageB.goto(groupUrl);
      await expect(
        pageB.getByText("인용 카드 1개, 감상 1개가 있어요"),
      ).toBeVisible();
      await expect(pageB.getByText(quoteText)).toHaveCount(0);
      // 화면에 안 보이는 데 그치지 않고, 받은 페이지 어디에도 내용이 없어야 한다.
      const lockedHtml = await pageB.content();
      expect(lockedHtml).not.toContain(quoteText);
      expect(lockedHtml).not.toContain(noteText);

      // B: 진도를 2장 60%로 옮기면 카드와 감상이 열린다 -------------------------------
      await saveProgress(pageB, "2", 60);
      await expect(pageB.getByText(quoteText)).toBeVisible();
      await expect(pageB.getByText(noteText)).toBeVisible();
      await expect(pageB.locator("[data-locked]")).toHaveCount(0);
    } finally {
      // 실패해도 만든 그룹은 남기지 않는다. 정리 실패가 원래 오류를 가리지 않게 한다.
      if (groupPath) {
        await deleteGroup(pageA, groupPath).catch((error) => {
          console.warn(`E2E 그룹을 지우지 못했다: ${groupPath}`, error);
        });
      }
      await contextA.close();
      await contextB.close();
    }
  });
});
