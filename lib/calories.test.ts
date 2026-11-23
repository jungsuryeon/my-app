import { beforeEach, describe, expect, it } from "vitest";
import { MET, estimateKcal, restSecEstimate, sessionKcal } from "./calories";
import type { SetStatus } from "./machine";
import { loadBody, saveBody, validateWeight, weightOf, isBody } from "./body";

const st = (...s: SetStatus[]) => s.map((status) => ({ status }));

describe("휴식 시간 추정", () => {
  it("완료한 세트 뒤에만 휴식이 있고, 운동의 마지막 세트 뒤에는 없다", () => {
    // 3세트 모두 완료: 휴식 2번
    expect(restSecEstimate([{ restSec: 30 }], [st("done", "done", "done")])).toBe(60);
  });

  it("건너뛰거나 못 한 세트 뒤에는 휴식이 없다", () => {
    expect(restSecEstimate([{ restSec: 30 }], [st("done", "skipped", "notDone")])).toBe(30);
    expect(restSecEstimate([{ restSec: 30 }], [st("skipped", "skipped", "done")])).toBe(0);
  });

  it("운동마다 자기 휴식 설정을 쓴다", () => {
    const r = restSecEstimate(
      [{ restSec: 30 }, { restSec: 60 }],
      [st("done", "done"), st("done", "done", "done")],
    );
    expect(r).toBe(30 + 60 * 2);
  });

  it("세트가 하나뿐이거나 비어 있으면 0", () => {
    expect(restSecEstimate([{ restSec: 30 }], [st("done")])).toBe(0);
    expect(restSecEstimate([], [])).toBe(0);
  });
});

describe("칼로리 계산", () => {
  it("체중 × 3.5 × 시간: 70kg, 1시간 → 245kcal", () => {
    expect(MET).toBe(3.5);
    expect(estimateKcal(70, 1800, 1800)).toBe(245);
  });

  it("반올림한다: 60kg, 20분 → 70kcal", () => {
    expect(estimateKcal(60, 600, 600)).toBe(70);
    expect(estimateKcal(65.5, 1000, 500)).toBe(Math.round((65.5 * 3.5 * 1500) / 3600));
  });

  it("체중이 없거나 0 이하, 시간이 0이면 계산하지 않는다", () => {
    expect(estimateKcal(null, 600, 600)).toBeNull();
    expect(estimateKcal(0, 600, 600)).toBeNull();
    expect(estimateKcal(-5, 600, 600)).toBeNull();
    expect(estimateKcal(70, 0, 0)).toBeNull();
  });

  it("세션으로 계산: 활성 시간 + 휴식 추정", () => {
    const s = {
      activeMs: 540_000, // 9분
      exercises: [{ restSec: 30 }],
      machine: { sets: [st("done", "done", "done")] },
    };
    // 9분 + 휴식 60초 = 600초, 70kg → 70*3.5*600/3600 = 40.8 → 41
    expect(sessionKcal(70, s)).toBe(41);
    expect(sessionKcal(null, s)).toBeNull();
  });
});

describe("체중 입력 검사", () => {
  it("20~300kg, 소수 한 자리", () => {
    expect(validateWeight("68")).toEqual({ ok: true, weightKg: 68 });
    expect(validateWeight(" 68.5 ")).toEqual({ ok: true, weightKg: 68.5 });
    expect(validateWeight("68.5kg")).toEqual({ ok: true, weightKg: 68.5 });
    expect(validateWeight("20").ok).toBe(true);
    expect(validateWeight("300").ok).toBe(true);
  });

  it("범위 밖·글자·소수 둘째 자리·빈 값은 오류", () => {
    for (const bad of ["19.9", "300.1", "abc", "68.55", "-5", "", "  ", "6 8"]) {
      expect(validateWeight(bad).ok).toBe(false);
    }
  });

  it("모양 검사", () => {
    expect(isBody({ weightKg: null })).toBe(true);
    expect(isBody({ weightKg: 70 })).toBe(true);
    expect(isBody({ weightKg: 10 })).toBe(false);
    expect(isBody({ weightKg: "70" })).toBe(false);
    expect(isBody(null)).toBe(false);
  });
});

describe("체중 저장·불러오기", () => {
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

  it("처음에는 none, 저장하면 읽히고 지우기(null)도 된다", () => {
    expect(loadBody()).toEqual({ kind: "none" });
    expect(weightOf(loadBody())).toBeNull();
    expect(saveBody(68.5)).toBe(true);
    expect(loadBody()).toEqual({ kind: "set", weightKg: 68.5 });
    expect(weightOf(loadBody())).toBe(68.5);
    expect(saveBody(null)).toBe(true);
    expect(weightOf(loadBody())).toBeNull();
  });

  it("저장 실패는 false, 깨진 값은 unreadable(체중 없음으로 본다)", () => {
    failWrites = true;
    expect(saveBody(70)).toBe(false);
    failWrites = false;
    store.set("reptimer:body", "{깨짐");
    expect(loadBody()).toEqual({ kind: "unreadable" });
    expect(weightOf(loadBody())).toBeNull();
  });
});
