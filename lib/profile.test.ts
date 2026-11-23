import { beforeEach, describe, expect, it } from "vitest";
import {
  NICKNAME_MAX,
  greeting,
  isProfile,
  loadProfile,
  saveProfile,
  validateNickname,
} from "./profile";

describe("닉네임 검사", () => {
  it("앞뒤 공백을 지우고 그대로 받는다", () => {
    expect(validateNickname("  정수련 ")).toEqual({ ok: true, nickname: "정수련" });
  });

  it("비어 있거나 공백뿐이면 오류", () => {
    expect(validateNickname("").ok).toBe(false);
    expect(validateNickname("   ").ok).toBe(false);
  });

  it("보이지 않는 제어 문자는 뺀다", () => {
    expect(validateNickname("수\u0000련\n")).toEqual({ ok: true, nickname: "수련" });
    expect(validateNickname("\u0007\u0008").ok).toBe(false);
  });

  it(`${NICKNAME_MAX}글자까지 허용하고 넘으면 오류(이모지도 한 글자로 센다)`, () => {
    expect(validateNickname("가".repeat(NICKNAME_MAX)).ok).toBe(true);
    expect(validateNickname("가".repeat(NICKNAME_MAX + 1)).ok).toBe(false);
    expect(validateNickname("💪".repeat(NICKNAME_MAX)).ok).toBe(true);
  });

  it("HTML처럼 보이는 글자도 그냥 글자로 받는다(화면에서 이스케이프된다)", () => {
    expect(validateNickname("<b>나</b>")).toEqual({ ok: true, nickname: "<b>나</b>" });
  });
});

describe("인사말", () => {
  it("닉네임이 있으면 인사말, 없으면 null", () => {
    expect(greeting("정수련")).toBe("안녕하세요, 정수련님");
    expect(greeting(null)).toBeNull();
    expect(greeting("")).toBeNull();
  });
});

describe("저장·불러오기", () => {
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

  it("처음에는 none(입력 카드를 보여 준다)", () => {
    expect(loadProfile()).toEqual({ kind: "none" });
  });

  it("저장한 닉네임을 다시 읽는다", () => {
    expect(saveProfile("정수련")).toBe(true);
    expect(loadProfile()).toEqual({ kind: "set", nickname: "정수련" });
  });

  it("건너뛰기(null)를 저장하면 다시 묻지 않는다", () => {
    saveProfile(null);
    expect(loadProfile()).toEqual({ kind: "set", nickname: null });
  });

  it("저장에 실패하면 false", () => {
    failWrites = true;
    expect(saveProfile("a")).toBe(false);
  });

  it("깨진 값은 unreadable", () => {
    store.set("reptimer:profile", "{깨짐");
    expect(loadProfile()).toEqual({ kind: "unreadable" });
    store.set("reptimer:profile", JSON.stringify({ v: 1, data: { nickname: 5 } }));
    expect(loadProfile()).toEqual({ kind: "unreadable" });
  });

  it("모양 검사", () => {
    expect(isProfile({ nickname: null })).toBe(true);
    expect(isProfile({ nickname: "a" })).toBe(true);
    expect(isProfile({ nickname: 1 })).toBe(false);
    expect(isProfile(null)).toBe(false);
  });
});
