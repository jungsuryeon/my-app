import { describe, expect, it } from "vitest";
import { buildRecord, buildSnapshot, isRecordList, isSnapshot, restoreFromSnapshot } from "./records";
import { createSession, startSession, endSession } from "./session";
import { SAMPLE_ROUTINES } from "./routines";

const routine = { id: "upper", name: "상체 데이" };
const T0 = new Date(2026, 10, 23, 23, 50).getTime();

function session() {
  return endSession(startSession(createSession(SAMPLE_ROUTINES[0].exercises), 0));
}

describe("startedAt(선택 필드)", () => {
  it("값을 주면 기록에 담기고, 안 주면 필드 자체가 없다", () => {
    const withIt = buildRecord({ recordId: "a", routine, session: session(), nowDate: T0 + 1, startedAt: T0 });
    expect(withIt.startedAt).toBe(T0);
    const without = buildRecord({ recordId: "b", routine, session: session(), nowDate: T0 });
    expect("startedAt" in without).toBe(false);
  });

  it("startedAt이 없는 기존 기록도 유효하다(호환), 숫자가 아니면 거부", () => {
    const old = buildRecord({ recordId: "o", routine, session: session(), nowDate: T0 });
    expect(isRecordList([old])).toBe(true);
    expect(isRecordList([{ ...old, startedAt: T0 }])).toBe(true);
    expect(isRecordList([{ ...old, startedAt: "x" }])).toBe(false);
  });

  it("스냅샷에 담겨 새로고침 복원 뒤에도 유지되고, 없는 옛 스냅샷도 읽힌다", () => {
    const snap = buildSnapshot({ recordId: "s", routine, startedAt: T0, session: session(), nowMs: 0, nowDate: T0 });
    expect(isSnapshot(snap)).toBe(true);
    const r = restoreFromSnapshot(snap, T0);
    expect(r.kind === "none" ? null : r.startedAt).toBe(T0);

    const old = buildSnapshot({ recordId: "s", routine, session: session(), nowMs: 0, nowDate: T0 });
    expect("startedAt" in old).toBe(false);
    expect(isSnapshot(old)).toBe(true);
    expect(isSnapshot({ ...old, startedAt: "x" })).toBe(false);
  });
});
