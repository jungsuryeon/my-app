// 진행 상태 스냅샷 저장·복원 (PLAN 작업 17, PRD M1 · DESIGN §2.3 · §2.5)
// 운동 중에는 1초마다 지금 상태를 localStorage에 남기고, 새로고침·재실행 때 이어 갈 수 있게 한다.
// (운동 기록 저장·최근 기록 조회는 작업 20·21에서 이 파일에 추가한다)

import type { Phase, SetRecord } from "./machine";
import type { Exercise } from "./routines";
import { createSession, endSession, pauseSession, type Session } from "./session";
import { createClock } from "./timer";
import { STORAGE_KEYS, readItem, removeItem, writeItem } from "./storage";

/** 마지막 저장 후 이 시간(30분)이 지나면 이어갈 수 없다 */
export const RESTORE_LIMIT_MS = 30 * 60 * 1000;

export const NOTICES = {
  restoredPaused: "진행 중이던 운동을 불러왔어요. 일시정지 상태예요.",
  restoredReady: "진행 중이던 운동을 불러왔어요. 다음 운동 준비 화면이에요.",
  restoredCompleted: "저장하지 못한 운동 기록을 불러왔어요.",
  expired: "30분이 지나 이어갈 수 없어요. 완료한 세트까지 저장할까요?",
} as const;

/** 저장되는 모양. 시계 값(performance.now 기준)은 새로고침하면 의미가 없어 남기지 않는다. */
export type Snapshot = {
  /** 기록 ID. 같은 ID로 저장하면 덮어쓰기만 한다(중복 저장 방지) */
  recordId: string;
  routine: { id: string; name: string };
  /** 마지막 저장 시각. 날짜와 30분 판정은 새로고침해도 이어지는 Date.now()를 쓴다 */
  savedAt: number;
  phase: Phase;
  pausedFrom: "COUNTDOWN" | "EXERCISE" | "REST" | null;
  remainingMs: number | null;
  exerciseIndex: number;
  setIndex: number;
  sets: SetRecord[][];
  exercises: Exercise[];
  /** 끝난 세트들의 활성 운동 시간(ms) */
  activeMs: number;
};

// ───────────────────────── 만들기·복원 (순수 계산) ─────────────────────────

/**
 * 지금 세션을 저장 가능한 모양으로 만든다.
 * 진행 중(카운트다운·운동·휴식)이면 "지금 멈춘 것"으로 보고 남은 시간을 함께 남긴다.
 * 그래서 어느 순간에 새로고침해도 항상 일시정지 상태로 복원된다.
 */
export function buildSnapshot(args: {
  recordId: string;
  routine: { id: string; name: string };
  session: Session;
  /** performance.now() 값 (경과 시간 계산용) */
  nowMs: number;
  /** Date.now() 값 (저장 시각용) */
  nowDate: number;
}): Snapshot {
  const frozen = pauseSession(args.session, args.nowMs); // 멈출 수 없는 상태(READY·COMPLETED)는 그대로
  const m = frozen.machine;
  return {
    recordId: args.recordId,
    routine: args.routine,
    savedAt: args.nowDate,
    phase: m.phase,
    pausedFrom: m.pausedFrom,
    remainingMs: m.remainingMs,
    exerciseIndex: m.exerciseIndex,
    setIndex: m.setIndex,
    sets: m.sets,
    exercises: frozen.exercises,
    activeMs: frozen.activeMs,
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

const PHASES: Phase[] = ["READY", "COUNTDOWN", "EXERCISE", "REST", "PAUSED", "COMPLETED"];

/** 저장된 값이 스냅샷 모양인지 확인한다(깨진 값은 걸러낸다) */
export function isSnapshot(v: unknown): v is Snapshot {
  if (!isObject(v)) return false;
  const exercises = v.exercises;
  const sets = v.sets;
  if (!Array.isArray(exercises) || exercises.length === 0) return false;
  if (!Array.isArray(sets) || sets.length !== exercises.length) return false;
  if (!sets.every((row) => Array.isArray(row) && row.length > 0)) return false;
  const r = v.routine;
  if (!isObject(r) || typeof r.id !== "string" || typeof r.name !== "string") return false;
  const ei = v.exerciseIndex;
  const si = v.setIndex;
  if (typeof ei !== "number" || !Number.isInteger(ei) || ei < 0 || ei >= exercises.length) return false;
  if (typeof si !== "number" || !Number.isInteger(si) || si < 0) return false;
  return (
    typeof v.recordId === "string" &&
    typeof v.savedAt === "number" &&
    typeof v.activeMs === "number" &&
    typeof v.phase === "string" &&
    (PHASES as string[]).includes(v.phase) &&
    // PAUSED는 돌아갈 상태와 남은 시간이 있어야 이어갈 수 있다
    (v.phase !== "PAUSED" || (typeof v.pausedFrom === "string" && typeof v.remainingMs === "number"))
  );
}

export type RestoreResult =
  | { kind: "none" }
  | {
      kind: "restored" | "expired";
      session: Session;
      routine: { id: string; name: string };
      recordId: string;
      /** 사용자에게 보여 줄 안내 문구 */
      notice: string;
    };

/**
 * 스냅샷으로 세션을 되살린다.
 * - 30분 안: 진행 중이던 것은 PAUSED로, 운동 사이 준비(READY)는 READY로 되살린다.
 * - 30분 초과: 이어갈 수 없으므로 종료한 것으로 보고(못 한 세트는 미수행) 저장 여부를 묻게 한다.
 * - 종료 화면(COMPLETED, 저장 전)은 시간 제한 없이 그대로 되살린다.
 */
export function restoreFromSnapshot(snap: Snapshot, nowDate: number): RestoreResult {
  let session: Session = {
    ...createSession(snap.exercises),
    machine: {
      phase: snap.phase,
      pausedFrom: snap.pausedFrom,
      remainingMs: snap.remainingMs,
      exerciseIndex: snap.exerciseIndex,
      setIndex: snap.setIndex,
      sets: snap.sets,
    },
    clock: createClock(),
    activeMs: snap.activeMs,
  };
  const base = { routine: snap.routine, recordId: snap.recordId };

  if (snap.phase === "COMPLETED") {
    return { kind: "restored", session, ...base, notice: NOTICES.restoredCompleted };
  }

  const expired = nowDate - snap.savedAt > RESTORE_LIMIT_MS;
  if (expired) {
    session = endSession(session);
    return { kind: "expired", session, ...base, notice: NOTICES.expired };
  }
  return {
    kind: "restored",
    session,
    ...base,
    notice: snap.phase === "READY" ? NOTICES.restoredReady : NOTICES.restoredPaused,
  };
}

// ───────────────────────── localStorage 읽고 쓰기 ─────────────────────────

/** 스냅샷을 저장한다. 실패하면 false */
export function saveSnapshot(snap: Snapshot): boolean {
  return writeItem(STORAGE_KEYS.snapshot, snap).ok;
}

/** 저장된 스냅샷을 읽어 되살린다. 없거나 깨졌으면(무시하고 새로 시작) none. 화면이 그려진 뒤에만 부른다. */
export function loadSnapshot(nowDate: number): RestoreResult {
  const r = readItem<Snapshot>(STORAGE_KEYS.snapshot, isSnapshot);
  if (!r.ok || r.value === null) return { kind: "none" };
  return restoreFromSnapshot(r.value, nowDate);
}

/** 스냅샷을 지운다(저장·버리기·홈으로 돌아갈 때) */
export function clearSnapshot(): void {
  removeItem(STORAGE_KEYS.snapshot);
}
