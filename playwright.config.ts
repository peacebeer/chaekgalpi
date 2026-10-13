import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// 로컬에서는 .env.local의 값(Supabase 주소·키, E2E 계정)을 테스트와 개발 서버가 함께 쓴다.
// CI에는 이 파일이 없고, 워크플로가 환경 변수로 넣어 준다.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // 모바일 우선: 책을 읽다 휴대폰으로 메모하는 사용 패턴
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // 값이 없을 때 쓰는 자리표시자(로컬 Supabase 기본 주소). 실제 키가 아니다.
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "e2e-placeholder",
    },
  },
});
