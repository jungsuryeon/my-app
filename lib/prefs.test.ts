import { beforeEach, describe, expect, it } from "vitest";
import { isPrefs, loadPrefs, savePrefs, showDefaultRoutines } from "./prefs";

describe("홈 설정", () => {
  let store: Map<string, string>;
  let failWrites = false;
  beforeEach(() => {
    store = new Map();
    failWrites = false;
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
          if (failWrites) throw new Error("quota");
          store.set(k, v);
        },
        removeItem: (k: string) => void store.delete(k),
        get length() {
          return store.size;
        },
        key: (i: number) => [...store.keys()][i] ?? null,
      },
    };
  });

  it("처음에는 none(처음 한 번 묻는다)", () => {
    expect(loadPrefs()).toEqual({ kind: "none" });
  });

  it("저장한 선택을 다시 읽는다", () => {
    expect(savePrefs({ defaultRoutines: "hide" })).toBe(true);
    expect(loadPrefs()).toEqual({ kind: "set", prefs: { defaultRoutines: "hide" } });
    savePrefs({ defaultRoutines: "show" });
    expect(loadPrefs()).toEqual({ kind: "set", prefs: { defaultRoutines: "show" } });
  });

  it("저장 실패는 false", () => {
    failWrites = true;
    expect(savePrefs({ defaultRoutines: "hide" })).toBe(false);
  });

  it("깨진 값은 unreadable이고, 이때는 기본 루틴을 숨기지 않는다", () => {
    store.set("reptimer:prefs", "{깨짐");
    const s = loadPrefs();
    expect(s).toEqual({ kind: "unreadable" });
    expect(showDefaultRoutines(s)).toBe(true);
    store.set("reptimer:prefs", JSON.stringify({ v: 1, data: { defaultRoutines: "x" } }));
    expect(loadPrefs()).toEqual({ kind: "unreadable" });
  });

  it("숨기기로 정했을 때만 숨긴다", () => {
    expect(showDefaultRoutines(null)).toBe(true);
    expect(showDefaultRoutines({ kind: "none" })).toBe(true);
    expect(showDefaultRoutines({ kind: "set", prefs: { defaultRoutines: "show" } })).toBe(true);
    expect(showDefaultRoutines({ kind: "set", prefs: { defaultRoutines: "hide" } })).toBe(false);
  });

  it("모양 검사", () => {
    expect(isPrefs({ defaultRoutines: "show" })).toBe(true);
    expect(isPrefs({ defaultRoutines: "hide" })).toBe(true);
    expect(isPrefs({ defaultRoutines: true })).toBe(false);
    expect(isPrefs(null)).toBe(false);
  });
});
