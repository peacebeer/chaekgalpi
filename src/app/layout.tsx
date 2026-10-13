import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_KR, Nanum_Myeongjo } from "next/font/google";
import "./globals.css";

import { SiteHeader } from "@/components/site-header";

// globals.css의 @theme이 --font-sans / --font-quote-family / --font-geist-mono를 읽는다.
// 한글 글꼴은 글자 묶음별로 나눠 필요한 부분만 내려받는다(미리 불러오지 않는다).
const bodyFont = IBM_Plex_Sans_KR({
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  preload: false,
});

// 인용문에 쓰는 명조체
const quoteFont = Nanum_Myeongjo({
  variable: "--font-quote-family",
  weight: ["400", "700"],
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "책갈피",
  description:
    "같은 책을 읽는 소그룹이 읽은 위치마다 감상과 인용을 나누는 독서 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${bodyFont.variable} ${quoteFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
