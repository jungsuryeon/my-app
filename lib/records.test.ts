import { beforeEach, describe, expect, it } from "vitest";
import {
  NOTICES,
  RESTORE_LIMIT_MS,
  buildSnapshot,
  clearSnapshot,
  isSnapshot,
  loadSnapshot,
  restoreFromSnapshot,
  saveSnapshot,
} from "./records";
import { createSession, endSession, startSession, tick, type Session } from "./session";
import { elapsedMs } from "./timer";

const exercises = [
  { id: "a", name: "운동A", sets: 2, reps: 3, tempoSec: 1, restSec: 2, weightKg: null },
  { id: "b", name: "운동B", sets: 1, reps: 2, tempoSec: 1, restSec: 5, weightKg: 40 },
];
const routine = { id: "upper", name: "상체 데이" };
const T0 = 1_700_000_000_000; // Date.now() 기준 임의의 시각

function runTo(s: Session, to: number): Session {
  let cur = s;
  for (let t = 250; t <= to; t += 250) cur = tick(cur, t);
  return cur;
}
const snapAt = (s: Session, nowMs: number, nowDate = T0) =>
  buildSnapshot({ recordId: "rec-1", routine, session: s, nowMs, nowDate });

describe("스냅샷 만들기", () => {
  it("운동 중에 만들면 일시정지 상태(멈춘 상태·남은 시간)로 저장된다", () => {
    let s = startSession(createSession(exercises), 0);
    s = runTo(s, 4500); // 카운트다운 3초 + 운동 1.5초
    const snap = snapAt(s, 4500);
    expect(snap.phase).toBe("PAUSED");
    expect(snap.pausedFrom).toBe("EXERCISE");
    expect(snap.remainingMs).toBe(1500); // 3회×1초 중 1.5초 남음
    expect(snap.recordId).toBe("rec-1");
    expect(snap.savedAt).toBe(T0);
  });

  it("준비 화면(READY)과 종료(COMPLETED)는 그 상태 그대로 저장된다", () => {
    let s = startSession(createSession(exercises), 0);
    s = runTo(s, 11_000);
    expect(snapAt(s, 11_000).phase).toBe("READY");
    expect(snapAt(endSession(s), 11_000).phase).toBe("COMPLETED");
  });

  it("만든 스냅샷은 JSON으로 저장했다 읽어도 같고 모양 검사를 통과한다", () => {
    const s = runTo(startSession(createSession(exercises), 0), 5000);
    const snap = snapAt(s, 5000);
    const back = JSON.parse(JSON.stringify(snap));
    expect(isSnapshot(back)).toBe(true);
    expect(back).toEqual(snap);
  });
});

describe("모양 검사", () => {
  const good = snapAt(runTo(startSession(createSession(exercises), 0), 5000), 5000);

  it("깨진 값은 걸러낸다", () => {
    expect(isSnapshot(null)).toBe(false);
    expect(isSnapshot("x")).toBe(false);
    expect(isSnapshot({ ...good, phase: "NOPE" })).toBe(false);
    expect(isSnapshot({ ...good, exercises: [] })).toBe(false);
    expect(isSnapshot({ ...good, exerciseIndex: 9 })).toBe(false);
    expect(isSnapshot({ ...good, sets: [[]] })).toBe(false);
    expect(isSnapshot({ ...good, savedAt: "어제" })).toBe(false);
    expect(isSnapshot({ ...good, remainingMs: null })).toBe(false); // PAUSED인데 남은 시간 없음
  });
});

describe("복원: 30분 안", () => {
  it("진행 중이던 운동은 PAUSED로 복원되고 이어하면 남은 시간부터 진행한다", () => {
    let s = startSession(createSession(exercises), 0);
    s = runTo(s, 4500);
    const r = restoreFromSnapshot(snapAt(s, 4500), T0 + 10 * 60_000);
    expect(r.kind).toBe("restored");
    if (r.kind === "none") throw new Error();
    expect(r.session.machine.phase).toBe("PAUSED");
    expect(r.session.machine.remainingMs).toBe(1500);
    expect(r.notice).toBe(NOTICES.restoredPaused);
    expect(r.recordId).toBe("rec-1");
    expect(r.routine).toEqual(routine);
    // 복원한 세션의 시계는 멈춰 있다(새 페이지에서 performance.now가 0부터 다시 시작해도 안전)
    expect(elapsedMs(r.session.clock, 999_999)).toBe(0);
  });

  it("정확히 30분까지는 복원하고, 1ms라도 넘으면 복원하지 않는다", () => {
    const s = runTo(startSession(createSession(exercises), 0), 4500);
    const snap = snapAt(s, 4500);
    expect(restoreFromSnapshot(snap, T0 + RESTORE_LIMIT_MS).kind).toBe("restored");
    expect(restoreFromSnapshot(snap, T0 + RESTORE_LIMIT_MS + 1).kind).toBe("expired");
  });

  it("운동 사이 준비 화면(READY)은 PAUSED 없이 READY로 복원한다", () => {
    const s = runTo(startSession(createSession(exercises), 0), 11_000);
    const r = restoreFromSnapshot(snapAt(s, 11_000), T0 + 1000);
    if (r.kind === "none") throw new Error();
    expect(r.session.machine.phase).toBe("READY");
    expect(r.session.machine.exerciseIndex).toBe(1);
    expect(r.notice).toBe(NOTICES.restoredReady);
  });

  it("시계가 거꾸로 가도(저장 시각이 미래) 복원한다", () => {
    const s = runTo(startSession(createSession(exercises), 0), 4500);
    expect(restoreFromSnapshot(snapAt(s, 4500, T0 + 5000), T0).kind).toBe("restored");
  });
});

describe("복원: 30분 초과", () => {
  it("완료한 세트가 하나도 없으면 안내 문구를 비워 종료 화면의 안내와 겹치지 않게 한다", () => {
    const s = runTo(startSession(createSession(exercises), 0), 1000); // 카운트다운 중, 완료 세트 0개
    const r = restoreFromSnapshot(snapAt(s, 1000), T0 + RESTORE_LIMIT_MS + 60_000);
    expect(r.kind).toBe("expired");
    if (r.kind === "none") throw new Error();
    expect(r.session.machine.phase).toBe("COMPLETED");
    expect(r.notice).toBe("");
  });

  it("이어갈 수 없으므로 종료(COMPLETED)로 만들고 못 한 세트는 미수행, 진행 중이던 세트는 반복 수를 남긴다", () => {
    const s = runTo(startSession(createSession(exercises), 0), 4500); // 운동 1.5초 → 1회
    const r = restoreFromSnapshot(snapAt(s, 4500), T0 + RESTORE_LIMIT_MS + 60_000);
    expect(r.kind).toBe("expired");
    if (r.kind === "none") throw new Error();
    expect(r.session.machine.phase).toBe("COMPLETED");
    expect(r.session.machine.sets[0][0]).toMatchObject({ status: "notDone", reps: 1 });
    expect(r.session.machine.sets[1][0].status).toBe("notDone");
    // 완료한 세트가 0개라 저장할 것이 없다 → 안내는 비운다(종료 화면이 알려 줌)
    expect(r.notice).toBe("");
    expect(r.session.activeMs).toBe(1500);
  });

  it("이미 끝낸 세트는 완료로 남는다", () => {
    const s = runTo(startSession(createSession(exercises), 0), 11_000); // 운동A 완료 → B 준비
    const r = restoreFromSnapshot(snapAt(s, 11_000), T0 + RESTORE_LIMIT_MS + 1);
    if (r.kind === "none") throw new Error();
    expect(r.session.machine.sets[0].map((x) => x.status)).toEqual(["done", "done"]);
    expect(r.session.machine.sets[1][0].status).toBe("notDone");
    // 완료한 세트가 있으면 "저장할까요?" 안내를 그대로 보여 준다
    expect(r.notice).toBe(NOTICES.expired);
  });
});

describe("복원: 종료 화면(저장 전)", () => {
  it("시간이 아무리 지나도 그대로 복원한다(저장하거나 버릴 때까지 유지)", () => {
    // 운동 사이 준비 화면에서 종료를 확정한 상태(COMPLETED)를 스냅샷으로 만든다
    const ready = runTo(startSession(createSession(exercises), 0), 11_000);
    const completedSnap = snapAt(endSession(ready), 11_000);
    expect(completedSnap.phase).toBe("COMPLETED");
    const r = restoreFromSnapshot(completedSnap, T0 + 10 * RESTORE_LIMIT_MS);
    expect(r.kind).toBe("restored");
    if (r.kind === "none") throw new Error();
    expect(r.session.machine.phase).toBe("COMPLETED");
    expect(r.notice).toBe(NOTICES.restoredCompleted);
  });
});

// ── localStorage 읽고 쓰기 (가짜 저장소) ──
describe("저장·불러오기·삭제", () => {
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

  const snap = () => snapAt(runTo(startSession(createSession(exercises), 0), 4500), 4500);

  it("저장한 스냅샷을 불러와 복원한다", () => {
    expect(saveSnapshot(snap())).toBe(true);
    const r = loadSnapshot(T0 + 1000);
    expect(r.kind).toBe("restored");
  });

  it("아무것도 저장돼 있지 않으면 none", () => {
    expect(loadSnapshot(T0).kind).toBe("none");
  });

  it("깨진 값·다른 버전은 무시하고 새로 시작한다(none)", () => {
    store.set("reptimer:snapshot", "{깨짐");
    expect(loadSnapshot(T0).kind).toBe("none");
    store.set("reptimer:snapshot", JSON.stringify({ v: 99, data: snap() }));
    expect(loadSnapshot(T0).kind).toBe("none");
    store.set("reptimer:snapshot", JSON.stringify({ v: 1, data: { phase: "EXERCISE" } }));
    expect(loadSnapshot(T0).kind).toBe("none");
  });

  it("저장에 실패하면 false를 돌려준다", () => {
    failWrites = true;
    expect(saveSnapshot(snap())).toBe(false);
  });

  it("지우면 더 이상 복원되지 않는다", () => {
    saveSnapshot(snap());
    clearSnapshot();
    expect(loadSnapshot(T0).kind).toBe("none");
  });
});
