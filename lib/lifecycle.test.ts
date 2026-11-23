import { describe, expect, it, vi } from "vitest";
import { watchVisibility } from "./lifecycle";

function fakeDoc() {
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: "visible",
    addEventListener: (_t: "visibilitychange", cb: () => void) => listeners.add(cb),
    removeEventListener: (_t: "visibilitychange", cb: () => void) => listeners.delete(cb),
  };
  const set = (state: string) => {
    doc.visibilityState = state;
    listeners.forEach((cb) => cb());
  };
  return { doc, set, count: () => listeners.size };
}

describe("화면 이탈·복귀 감지", () => {
  it("숨겨지면 onHidden, 다시 보이면 onVisible을 부른다", () => {
    const f = fakeDoc();
    const onHidden = vi.fn();
    const onVisible = vi.fn();
    watchVisibility({ onHidden, onVisible }, f.doc);
    f.set("hidden");
    f.set("visible");
    expect(onHidden).toHaveBeenCalledTimes(1);
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it("정리 함수를 부르면 감시를 멈춘다(개발 모드 effect 이중 실행에도 안전)", () => {
    const f = fakeDoc();
    const onVisible = vi.fn();
    const stop = watchVisibility({ onVisible }, f.doc);
    stop();
    f.set("visible");
    expect(onVisible).not.toHaveBeenCalled();
    expect(f.count()).toBe(0);
  });

  it("문서가 없는 환경에서는 아무 일도 하지 않는다", () => {
    expect(() => watchVisibility({}, null)()).not.toThrow();
  });
});
