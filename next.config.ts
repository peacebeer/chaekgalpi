import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 개발 서버 화면 왼쪽 아래의 Next.js 표시를 끈다.
  devIndicators: false,
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
