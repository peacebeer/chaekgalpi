import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  images: {
    // 책 표지: 카카오 책 검색이 주는 썸네일 주소만 허용한다.
    remotePatterns: [{ protocol: "https", hostname: "**.kakaocdn.net" }],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
