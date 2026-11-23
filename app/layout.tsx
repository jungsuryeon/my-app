import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepTimer",
  description: "반복·세트·휴식을 자동으로 진행하고 소리로 안내하는 운동 타이머",
};

// iPhone 화면 기준: 가로 폭에 맞추고, 안전 영역(노치·홈 바)까지 채우며, 입력 시 확대되지 않게 한다.
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
