// 운동 기록 캘린더 계산 (확장 STEP 1)
// 기록을 날짜별로 묶고 월간 달력 칸을 만든다. 날짜는 이 기기의 시간대 기준이다.

import type { WorkoutRecord } from "./records";

export type YearMonth = { year: number; month: number }; // month: 1~12

/** 기록이 표시될 시각. 새 기록은 운동 시작 시각(startedAt), 기존 기록은 저장 시각(date) */
export function recordTime(rec: WorkoutRecord): number {
  return rec.startedAt ?? rec.date;
}

/** "2026-11-23" 모양의 날짜 키 */
export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 기록이 표시될 날짜 키 */
export function recordDayKey(rec: WorkoutRecord): string {
  const d = new Date(recordTime(rec));
  return dayKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** 날짜 키별 기록 수 (달력에 점·숫자를 찍는 데 쓴다) */
export function countByDay(records: readonly WorkoutRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) {
    const k = recordDayKey(r);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/** 그 날짜 키의 기록들. 시작 시각이 이른 순 */
export function recordsOnDay(records: readonly WorkoutRecord[], key: string): WorkoutRecord[] {
  return records.filter((r) => recordDayKey(r) === key).sort((a, b) => recordTime(a) - recordTime(b));
}

/** 그 달의 운동 일수와 운동 횟수(기록 수) */
export function monthStats(
  records: readonly WorkoutRecord[],
  year: number,
  month: number,
): { days: number; count: number; kcal: number; kcalCount: number } {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const inMonth = records.filter((r) => recordDayKey(r).startsWith(prefix));
  const keys = inMonth.map(recordDayKey);
  // 칼로리는 저장할 때 체중이 있었던 기록만 합친다(kcalCount = 합친 기록 수)
  const withKcal = inMonth.filter((r) => typeof r.kcal === "number");
  return {
    days: new Set(keys).size,
    count: keys.length,
    kcal: withKcal.reduce((sum, r) => sum + (r.kcal ?? 0), 0),
    kcalCount: withKcal.length,
  };
}

/** "오후 3:05" */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const period = h < 12 ? "오전" : "오후";
  return `${period} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 활성 운동 시간(초) → "12분 05초" / "45초" */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, "0")}초`;
}

/** 이전·다음 달로 옮긴다(delta: -1, +1 …) */
export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const idx = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 한 칸: 날짜(day)와 키. 앞뒤 빈 칸은 null */
export type DayCell = { day: number; key: string } | null;

/** 일요일 시작 달력 칸. 길이는 항상 7의 배수다 */
export function buildMonthGrid(year: number, month: number): DayCell[] {
  const lead = new Date(year, month - 1, 1).getDay(); // 1일의 요일(0=일)
  const total = daysInMonth(year, month);
  const cells: DayCell[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= total; d++) cells.push({ day: d, key: dayKey(year, month, d) });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
