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
  /** 운동을 시작한 시각(Date.now()). 이전 버전이 저장한 스냅샷에는 없다 */
  startedAt?: number;
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
  startedAt?: number;
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
    ...(args.startedAt !== undefined ? { startedAt: args.startedAt } : {}),
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
    (v.startedAt === undefined || typeof v.startedAt === "number") &&
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
      startedAt?: number;
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
  const base = {
    routine: snap.routine,
    recordId: snap.recordId,
    ...(snap.startedAt !== undefined ? { startedAt: snap.startedAt } : {}),
  };

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

// ───────────────────────── 운동 기록 저장 (PLAN 작업 20) ─────────────────────────

export type RecordSetStatus = "완료" | "건너뜀" | "미수행";

export type RecordSet = {
  status: RecordSetStatus;
  targetReps: number;
  reps: number;
};

export type RecordExercise = {
  name: string;
  /** 무게(kg). 비워 둔 운동은 null → 화면에는 "-"로 보인다 */
  weightKg: number | null;
  sets: RecordSet[];
};

/** 저장되는 운동 기록 하나 */
export type WorkoutRecord = {
  /** 기록 ID. 같은 ID로 다시 저장하면 덮어쓰기만 한다(중복 기록 없음) */
  id: string;
  /** 날짜(Date.now() 값) */
  date: number;
  /** 운동 시작 시각(Date.now()). 새 기록에만 있다. 캘린더는 이 값이 있으면 이 날짜에 표시한다 */
  startedAt?: number;
  routineId: string;
  routineName: string;
  /** 활성 운동 시간(초). EXERCISE에서 실제로 흐른 시간의 합계 */
  activeSec: number;
  exercises: RecordExercise[];
};

const STATUS_TEXT: Record<SetRecord["status"], RecordSetStatus> = {
  done: "완료",
  skipped: "건너뜀",
  notDone: "미수행",
  pending: "미수행", // 종료 뒤에는 남아 있지 않지만, 혹시 있어도 하지 않은 세트로 기록한다
};

/** 종료된 세션에서 기록 하나를 만든다 */
export function buildRecord(args: {
  recordId: string;
  routine: { id: string; name: string };
  session: Session;
  nowDate: number;
  startedAt?: number;
}): WorkoutRecord {
  const { session } = args;
  return {
    id: args.recordId,
    date: args.nowDate,
    ...(args.startedAt !== undefined ? { startedAt: args.startedAt } : {}),
    routineId: args.routine.id,
    routineName: args.routine.name,
    activeSec: Math.round(session.activeMs / 1000),
    exercises: session.exercises.map((ex, ei) => ({
      name: ex.name,
      weightKg: ex.weightKg,
      sets: session.machine.sets[ei].map((s) => ({
        status: STATUS_TEXT[s.status],
        targetReps: s.targetReps,
        reps: s.reps,
      })),
    })),
  };
}

/** 완료한 세트 수 / 전체 세트 수 (홈의 최근 기록 한 줄에 쓴다) */
export function countSets(rec: WorkoutRecord): { done: number; total: number } {
  const all = rec.exercises.flatMap((e) => e.sets);
  return { done: all.filter((s) => s.status === "완료").length, total: all.length };
}

function isRecordSet(v: unknown): v is RecordSet {
  return (
    isObject(v) &&
    (v.status === "완료" || v.status === "건너뜀" || v.status === "미수행") &&
    typeof v.targetReps === "number" &&
    typeof v.reps === "number"
  );
}

function isRecord(v: unknown): v is WorkoutRecord {
  return (
    isObject(v) &&
    typeof v.id === "string" &&
    typeof v.date === "number" &&
    (v.startedAt === undefined || typeof v.startedAt === "number") &&
    typeof v.routineId === "string" &&
    typeof v.routineName === "string" &&
    typeof v.activeSec === "number" &&
    Array.isArray(v.exercises) &&
    v.exercises.every(
      (e: unknown) =>
        isObject(e) &&
        typeof e.name === "string" &&
        (e.weightKg === null || typeof e.weightKg === "number") &&
        Array.isArray(e.sets) &&
        e.sets.every(isRecordSet),
    )
  );
}

/** 저장된 기록 목록 모양인지 확인한다 */
export function isRecordList(v: unknown): v is WorkoutRecord[] {
  return Array.isArray(v) && v.every(isRecord);
}

export type SaveResult =
  | { ok: true }
  | {
      ok: false;
      /** corrupt = 기존 기록 목록이 손상돼 덮어쓰지 않음 / storage = 저장 공간 문제 */
      reason: "corrupt" | "storage";
      message: string;
    };

export const SAVE_MESSAGES = {
  storage:
    "저장하지 못했어요. 저장 공간이 부족하거나 브라우저 설정 때문일 수 있어요. 다시 저장해 보세요.",
  corrupt:
    "저장된 기록 목록이 손상돼 있어서 새 기록을 저장하지 않았어요(기존 기록을 덮어쓰지 않기 위해서예요). 홈의 데이터 초기화 뒤에 다시 시도해 주세요.",
} as const;

/**
 * 기록 하나를 저장한다. 같은 ID가 있으면 그 기록을 덮어쓰고, 없으면 목록 끝에 더한다.
 * - 기존 목록이 손상돼 있으면 덮어쓰지 않고 알린다(기록을 조용히 잃지 않기 위함).
 * - 쓴 뒤 다시 읽어 실제로 들어갔는지 확인한다(실패를 조용히 넘기지 않기 위함).
 * 화면이 그려진 뒤(이벤트 처리 안)에서만 부른다.
 */
export function saveRecord(rec: WorkoutRecord): SaveResult {
  const fail = (reason: "corrupt" | "storage"): SaveResult => ({
    ok: false,
    reason,
    message: SAVE_MESSAGES[reason],
  });

  const current = readItem<WorkoutRecord[]>(STORAGE_KEYS.records, isRecordList);
  if (!current.ok) return fail("storage");
  if (current.invalid) return fail("corrupt");

  const list = current.value ?? [];
  const next = list.some((r) => r.id === rec.id)
    ? list.map((r) => (r.id === rec.id ? rec : r))
    : [...list, rec];

  if (!writeItem(STORAGE_KEYS.records, next).ok) return fail("storage");

  const back = readItem<WorkoutRecord[]>(STORAGE_KEYS.records, isRecordList);
  const saved = back.ok ? back.value?.find((r) => r.id === rec.id) : undefined;
  if (!saved || JSON.stringify(saved) !== JSON.stringify(rec)) return fail("storage");
  return { ok: true };
}

/** 날짜가 가장 늦은 기록. 없으면 null */
export function latestRecord(records: readonly WorkoutRecord[]): WorkoutRecord | null {
  return records.reduce<WorkoutRecord | null>(
    (best, r) => (best === null || r.date > best.date ? r : best),
    null,
  );
}

/** 홈에 보여 줄 한 줄: "11월 23일 · 상체 데이 · 완료 6/9세트" (날짜는 이 기기의 시간대 기준) */
export function formatRecordLine(rec: WorkoutRecord): string {
  const d = new Date(rec.date);
  const { done, total } = countSets(rec);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 · ${rec.routineName} · 완료 ${done}/${total}세트`;
}

export const DELETE_MESSAGES = {
  storage: "삭제하지 못했어요. 브라우저 설정이나 저장 공간을 확인한 뒤 다시 시도해 주세요.",
  corrupt: "저장된 기록 목록이 손상돼 있어서 삭제하지 않았어요.",
  missing: "이미 없는 기록이에요.",
} as const;

export type DeleteResult =
  | { ok: true; records: WorkoutRecord[] }
  | { ok: false; reason: "corrupt" | "storage" | "missing"; message: string };

/**
 * 기록 하나를 지운다(전체 초기화와 별개). 손상된 목록은 건드리지 않고,
 * 쓴 뒤 다시 읽어 실제로 지워졌는지 확인한다. 성공하면 남은 목록을 돌려준다.
 */
export function deleteRecord(id: string): DeleteResult {
  const fail = (reason: "corrupt" | "storage" | "missing"): DeleteResult => ({
    ok: false,
    reason,
    message: DELETE_MESSAGES[reason],
  });
  const current = readItem<WorkoutRecord[]>(STORAGE_KEYS.records, isRecordList);
  if (!current.ok) return fail("storage");
  if (current.invalid) return fail("corrupt");
  const list = current.value ?? [];
  if (!list.some((r) => r.id === id)) return fail("missing");
  const next = list.filter((r) => r.id !== id);
  if (!writeItem(STORAGE_KEYS.records, next).ok) return fail("storage");
  const back = readItem<WorkoutRecord[]>(STORAGE_KEYS.records, isRecordList);
  if (!back.ok || back.invalid || (back.value ?? []).some((r) => r.id === id)) return fail("storage");
  return { ok: true, records: back.value ?? [] };
}

/** 저장된 기록 목록을 읽는다. 손상됐으면 invalid. */
export function loadRecords():
  | { ok: true; records: WorkoutRecord[]; invalid: boolean }
  | { ok: false } {
  const r = readItem<WorkoutRecord[]>(STORAGE_KEYS.records, isRecordList);
  if (!r.ok) return { ok: false };
  return { ok: true, records: r.value ?? [], invalid: r.invalid };
}
