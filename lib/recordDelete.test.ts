import { beforeEach, describe, expect, it } from "vitest";
import { formatClock, formatDuration, monthStats, recordsOnDay } from "./calendar";
import { deleteRecord, loadRecords, saveRecord, type WorkoutRecord } from "./records";

function rec(id: string, date: number, startedAt?: number): WorkoutRecord {
  return {
    id,
    date,
    ...(startedAt !== undefined ? { startedAt } : {}),
    routineId: "r",
    routineName: "상체 데이",
    activeSec: 60,
    exercises: [{ name: "a", weightKg: null, sets: [{ status: "완료", targetReps: 5, reps: 5 }] }],
  };
}

describe("날짜별 조회·통계·표시", () => {
  const a = rec("a", new Date(2026, 10, 3, 20).getTime());
  const b = rec("b", new Date(2026, 10, 3, 9).getTime());
  const c = rec("c", new Date(2026, 10, 4, 0, 20).getTime(), new Date(2026, 10, 3, 23, 50).getTime());
  const d = rec("d", new Date(2026, 9, 31, 8).getTime());

  it("그 날의 기록을 시작 시각 순으로 돌려준다(자정 넘긴 기록은 시작일)", () => {
    expect(recordsOnDay([a, b, c, d], "2026-11-03").map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(recordsOnDay([a, b, c, d], "2026-11-04")).toEqual([]);
  });

  it("월간 운동 일수와 횟수", () => {
    expect(monthStats([a, b, c, d], 2026, 11)).toEqual({ days: 1, count: 3 });
    expect(monthStats([a, b, c, d], 2026, 10)).toEqual({ days: 1, count: 1 });
    expect(monthStats([], 2026, 11)).toEqual({ days: 0, count: 0 });
  });

  it("시각·시간 표시", () => {
    expect(formatClock(new Date(2026, 0, 1, 0, 5).getTime())).toBe("오전 12:05");
    expect(formatClock(new Date(2026, 0, 1, 15, 30).getTime())).toBe("오후 3:30");
    expect(formatDuration(45)).toBe("45초");
    expect(formatDuration(725)).toBe("12분 05초");
  });
});

describe("개별 기록 삭제", () => {
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

  it("고른 기록만 지우고 나머지는 남긴다", () => {
    saveRecord(rec("a", 1));
    saveRecord(rec("b", 2));
    const r = deleteRecord("a");
    expect(r.ok && r.records.map((x) => x.id)).toEqual(["b"]);
    const l = loadRecords();
    expect(l.ok && l.records.map((x) => x.id)).toEqual(["b"]);
  });

  it("없는 기록은 missing", () => {
    saveRecord(rec("a", 1));
    const r = deleteRecord("zzz");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe("missing");
  });

  it("저장 실패는 알리고 기록은 그대로", () => {
    saveRecord(rec("a", 1));
    failWrites = true;
    const r = deleteRecord("a");
    expect(!r.ok && r.reason).toBe("storage");
    failWrites = false;
    const l = loadRecords();
    expect(l.ok && l.records).toHaveLength(1);
  });

  it("손상된 목록은 건드리지 않는다", () => {
    store.set("reptimer:records", "{깨짐");
    const r = deleteRecord("a");
    expect(!r.ok && r.reason).toBe("corrupt");
    expect(store.get("reptimer:records")).toBe("{깨짐");
  });

  it("마지막 기록을 지우면 빈 목록", () => {
    saveRecord(rec("a", 1));
    const r = deleteRecord("a");
    expect(r.ok && r.records).toEqual([]);
  });
});
