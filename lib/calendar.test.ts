import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  countByDay,
  dayKey,
  daysInMonth,
  recordDayKey,
  recordTime,
  shiftMonth,
} from "./calendar";
import type { WorkoutRecord } from "./records";

function rec(id: string, date: number, startedAt?: number): WorkoutRecord {
  return {
    id,
    date,
    ...(startedAt !== undefined ? { startedAt } : {}),
    routineId: "r",
    routineName: "상체 데이",
    activeSec: 60,
    exercises: [],
  };
}

describe("기록 날짜 기준", () => {
  it("기존 기록(startedAt 없음)은 저장 시각 date를 쓴다", () => {
    const t = new Date(2026, 10, 23, 10, 0).getTime();
    expect(recordTime(rec("a", t))).toBe(t);
    expect(recordDayKey(rec("a", t))).toBe("2026-11-23");
  });

  it("새 기록은 시작일을 쓴다: 자정을 넘겨 끝나도 시작한 날에 표시", () => {
    const start = new Date(2026, 10, 23, 23, 50).getTime();
    const saved = new Date(2026, 10, 24, 0, 20).getTime();
    expect(recordDayKey(rec("a", saved, start))).toBe("2026-11-23");
  });

  it("날짜별 기록 수를 센다", () => {
    const d1 = new Date(2026, 10, 23, 9).getTime();
    const d2 = new Date(2026, 10, 23, 20).getTime();
    const d3 = new Date(2026, 10, 25, 8).getTime();
    const m = countByDay([rec("a", d1), rec("b", d2), rec("c", d3)]);
    expect(m.get("2026-11-23")).toBe(2);
    expect(m.get("2026-11-25")).toBe(1);
    expect(m.get("2026-11-24")).toBeUndefined();
  });
});

describe("달력 칸", () => {
  it("2026년 11월: 1일은 일요일, 30일, 칸 수는 7의 배수", () => {
    const g = buildMonthGrid(2026, 11);
    expect(g[0]).toEqual({ day: 1, key: "2026-11-01" });
    expect(g.filter(Boolean)).toHaveLength(30);
    expect(g.length % 7).toBe(0);
  });

  it("앞쪽 빈 칸 수는 1일의 요일과 같다 (2026년 10월 1일은 목요일)", () => {
    const g = buildMonthGrid(2026, 10);
    expect(g.slice(0, 4)).toEqual([null, null, null, null]);
    expect(g[4]).toEqual({ day: 1, key: "2026-10-01" });
  });

  it("윤년 2월은 29일, 평년은 28일", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it("모든 달의 칸이 7의 배수이고 날짜가 빠짐없이 들어간다", () => {
    for (let m = 1; m <= 12; m++) {
      const g = buildMonthGrid(2026, m);
      expect(g.length % 7).toBe(0);
      expect(g.filter(Boolean)).toHaveLength(daysInMonth(2026, m));
    }
  });
});

describe("달 이동", () => {
  it("연말·연초를 넘어간다", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 5 }, 0)).toEqual({ year: 2026, month: 5 });
  });

  it("dayKey는 0을 채운다", () => {
    expect(dayKey(2026, 3, 5)).toBe("2026-03-05");
  });
});
