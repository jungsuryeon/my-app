import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepTimer",
  description: "반복·세트·휴식을 자동으로 진행하고 소리로 안내하는 운동 타이머",
};

// 모바일 화면 기준: 가로 폭에 맞추고 안전 영역(노치·홈 바)까지 채운다.
// 운동 중에는 화면이 흔들리거나 확대되지 않고 고정되어 있는 것이 좋아서 확대를 막는다(maximumScale: 1).
// 입력칸 글자도 16px 이상으로 두어 iPhone이 입력 때 저절로 확대하지 않게 한다(globals.css).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fff5ea",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
