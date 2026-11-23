import { defineConfig } from "vitest/config";

// 화면 없는 로직(lib/)만 시험한다. 브라우저 기능이 필요 없어 node 환경으로 충분하다.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
