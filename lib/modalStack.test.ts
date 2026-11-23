import { describe, expect, it } from "vitest";
import { createModalStack, nextFocusIndex } from "./modalStack";

describe("createModalStack", () => {
  it("맨 위(마지막으로 열린) 모달만 top이다", () => {
    const s = createModalStack();
    const settings = Symbol("settings");
    const reset = Symbol("reset");
    s.push(settings);
    expect(s.isTop(settings)).toBe(true);
    s.push(reset); // 설정 시트 위에 초기화 확인창
    expect(s.isTop(reset)).toBe(true);
    expect(s.isTop(settings)).toBe(false);
  });

  it("맨 위 모달을 닫으면 아래 모달이 다시 top이 된다", () => {
    const s = createModalStack();
    const a = Symbol("a");
    const b = Symbol("b");
    s.push(a);
    s.push(b);
    s.remove(b);
    expect(s.isTop(a)).toBe(true);
    expect(s.size()).toBe(1);
  });

  it("같은 모달을 두 번 등록해도 한 번만 센다(중복 등록 방지)", () => {
    const s = createModalStack();
    const a = Symbol("a");
    s.push(a);
    s.push(a);
    expect(s.size()).toBe(1);
    s.remove(a);
    expect(s.size()).toBe(0);
  });

  it("여러 번 열고 닫아도 목록이 비워진다", () => {
    const s = createModalStack();
    for (let i = 0; i < 5; i++) {
      const id = Symbol(String(i));
      s.push(id);
      s.remove(id);
    }
    expect(s.size()).toBe(0);
  });

  it("없는 모달을 빼도, 비어 있어도 top 검사는 안전하다", () => {
    const s = createModalStack();
    const a = Symbol("a");
    s.remove(a);
    expect(s.isTop(a)).toBe(false);
  });

  it("가운데 모달이 먼저 빠져도 맨 위는 그대로다", () => {
    const s = createModalStack();
    const a = Symbol("a");
    const b = Symbol("b");
    const c = Symbol("c");
    s.push(a);
    s.push(b);
    s.push(c);
    s.remove(b);
    expect(s.isTop(c)).toBe(true);
  });
});

describe("nextFocusIndex", () => {
  it("Tab은 다음 칸으로 가고, 마지막이면 처음으로 돈다", () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 1, false)).toBe(2);
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });

  it("Shift+Tab은 이전 칸으로 가고, 처음이면 마지막으로 돈다", () => {
    expect(nextFocusIndex(3, 2, true)).toBe(1);
    expect(nextFocusIndex(3, 1, true)).toBe(0);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });

  it("포커스가 모달 밖(-1)이면 Tab은 처음, Shift+Tab은 마지막 칸으로 끌어온다", () => {
    expect(nextFocusIndex(4, -1, false)).toBe(0);
    expect(nextFocusIndex(4, -1, true)).toBe(3);
    expect(nextFocusIndex(4, 9, false)).toBe(0);
  });

  it("요소가 하나면 계속 같은 칸이다", () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0);
    expect(nextFocusIndex(1, 0, true)).toBe(0);
  });

  it("요소가 없으면 -1이다", () => {
    expect(nextFocusIndex(0, -1, false)).toBe(-1);
  });
});
