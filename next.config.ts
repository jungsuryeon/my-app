import type { NextConfig } from "next";

// 보안 헤더. CSP는 nonce를 쓰지 않는 방식이다(cacheComponents와 맞지 않음).
// 개발 서버(dev)는 React가 eval을 쓰므로 운영 빌드에만 CSP를 붙인다.
const isProd = process.env.NODE_ENV === "production";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js가 넣는 인라인 스크립트
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://static.exercisedb.dev", // 운동 GIF만 외부 허용
  "connect-src 'self'", // 앱은 같은 서버의 /api만 부른다(ExerciseDB는 서버가 대신 조회)
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // 다른 사이트의 iframe에 넣지 못하게(클릭재킹 방지)
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  ...(isProd ? [{ key: "Content-Security-Policy", value: CSP }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 화면 꺼짐 방지(Wake Lock)는 쓰므로 self만 허용하고, 쓰지 않는 기능은 막는다
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // 사용 중인 프레임워크를 응답 헤더로 알리지 않는다
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  cacheComponents: true,
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
