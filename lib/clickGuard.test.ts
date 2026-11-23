import { describe, expect, it, vi } from "vitest";
import { createClickGuard } from "./clickGuard";

describe("버튼 연속 클릭 방지 (0.5초)", () => {
  it("첫 클릭은 실행한다", () => {
    const g = createClickGuard(() => 0);
    const fn = vi.fn();
    expect(g.run("pause", fn)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("같은 버튼을 0.5초 안에 다시 누르면 무시한다", () => {
    let t = 0;
    const g = createClickGuard(() => t);
    const fn = vi.fn();
    g.run("pause", fn);
    t = 499;
    expect(g.run("pause", fn)).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("정확히 0.5초가 지나면 다시 실행한다", () => {
    let t = 0;
    const g = createClickGuard(() => t);
    const fn = vi.fn();
    g.run("pause", fn);
    t = 500;
    expect(g.run("pause", fn)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("무시된 클릭은 시간을 연장하지 않는다(계속 누르고 있어도 첫 실행 기준)", () => {
    let t = 0;
    const g = createClickGuard(() => t);
    const fn = vi.fn();
    g.run("a", fn);
    t = 300;
    g.run("a", fn); // 무시
    t = 600;
    expect(g.run("a", fn)).toBe(true); // 첫 실행(0) 기준 600ms 지남
  });

  it("다른 버튼은 서로 영향을 주지 않는다", () => {
    const g = createClickGuard(() => 0);
    const a = vi.fn();
    const b = vi.fn();
    g.run("pause", a);
    expect(g.run("skip", b)).toBe(true);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
