import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // tsconfig.json의 "@/*" 경로를 그대로 쓴다.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    // E2E(Playwright)는 `npm run test:e2e`로 따로 돌린다.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
