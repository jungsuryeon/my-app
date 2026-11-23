import { describe, expect, it, vi } from "vitest";
import { createWakeLock, watchVisibility } from "./lifecycle";

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

describe("화면 꺼짐 방지(Wake Lock)", () => {
  function fakeNav(opts: { reject?: boolean } = {}) {
    const state = { requests: 0, released: 0, onRelease: undefined as undefined | (() => void) };
    const nav = {
      wakeLock: {
        request: async () => {
          state.requests++;
          if (opts.reject) throw new Error("NotAllowedError");
          return {
            release: async () => {
              state.released++;
            },
            addEventListener: (_t: "release", cb: () => void) => {
              state.onRelease = cb;
            },
          };
        },
      },
    };
    return { nav, state };
  }

  it("지원하는 기기에서는 켜지고 on을 돌려준다", async () => {
    const f = fakeNav();
    const wl = createWakeLock(f.nav);
    expect(await wl.acquire()).toBe("on");
    expect(wl.isHolding()).toBe(true);
  });

  it("이미 켜져 있으면 다시 요청하지 않는다", async () => {
    const f = fakeNav();
    const wl = createWakeLock(f.nav);
    await wl.acquire();
    await wl.acquire();
    expect(f.state.requests).toBe(1);
  });

  it("지원하지 않는 기기는 unsupported(안내만 하고 앱은 계속 동작)", async () => {
    expect(await createWakeLock({}).acquire()).toBe("unsupported");
    expect(await createWakeLock(undefined).acquire()).toBe("unsupported");
  });

  it("요청이 거절되면 failed", async () => {
    const wl = createWakeLock(fakeNav({ reject: true }).nav);
    expect(await wl.acquire()).toBe("failed");
    expect(wl.isHolding()).toBe(false);
  });

  it("release하면 놓는다", async () => {
    const f = fakeNav();
    const wl = createWakeLock(f.nav);
    await wl.acquire();
    await wl.release();
    expect(f.state.released).toBe(1);
    expect(wl.isHolding()).toBe(false);
  });

  it("화면이 숨겨져 시스템이 놓으면 다시 요청할 수 있다", async () => {
    const f = fakeNav();
    const wl = createWakeLock(f.nav);
    await wl.acquire();
    f.state.onRelease?.(); // 시스템이 놓음
    expect(wl.isHolding()).toBe(false);
    expect(await wl.acquire()).toBe("on");
    expect(f.state.requests).toBe(2);
  });

  it("요청을 기다리는 사이에 release하면 얻자마자 놓는다", async () => {
    const f = fakeNav();
    const wl = createWakeLock(f.nav);
    const p = wl.acquire();
    await wl.release();
    await p;
    expect(wl.isHolding()).toBe(false);
    expect(f.state.released).toBe(1);
  });
});
