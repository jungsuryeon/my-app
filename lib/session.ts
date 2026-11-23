// 자동 진행 세션 (PLAN 작업 7, PRD M1 · DESIGN §2.2)
// 상태 머신(machine.ts)과 시간 계산(timer.ts)을 이어 붙여, 사용자가 누르지 않아도
// 카운트다운 → 운동 → 휴식 → 다음 세트 → (운동 사이 준비) → … → 루틴 완료로 저절로 넘어가게 한다.
// 화면·소리와 무관한 순수 계산이다. 시각(nowMs)은 호출하는 쪽이 performance.now()로 넘겨 준다.

import {
  transition,
  resumeInfo,
  createMachine,
  type ActivePhase,
  type Machine,
} from "./machine";
import type { Exercise } from "./routines";
import {
  COUNTDOWN_MS,
  createClock,
  countdownRemainingMs,
  elapsedMs,
  exerciseRemainingMs,
  isCountdownDone,
  isRestDone,
  isSetComplete,
  repsDone,
  restRemainingMs,
  setDurationMs,
  startClock,
  type Clock,
} from "./timer";

/** 세션이 쓰는 운동 설정 = 루틴의 운동(이름·반복·세트·휴식·템포·무게) 그대로 */
export type SessionExercise = Exercise;

export type Session = {
  machine: Machine;
  exercises: SessionExercise[];
  /** 지금 상태(카운트다운·운동·휴식)의 시계. 멈춰 있거나 READY·COMPLETED·PAUSED이면 멈춘 시계 */
  clock: Clock;
  /** 이미 끝난 세트들의 활성 운동 시간(ms). 진행 중 세트의 시간은 activeTotalMs()가 더해 준다. */
  activeMs: number;
};

export function createSession(exercises: SessionExercise[]): Session {
  return {
    machine: createMachine(exercises),
    exercises,
    clock: createClock(),
    activeMs: 0,
  };
}

/**
 * 운동 사이 준비 화면(READY)에서 다음 운동의 값을 고쳤을 때 반영한다.
 * 그 운동의 세트 기록을 새 값(세트 수·목표 반복)으로 다시 만든다. 준비 화면이 아니거나 다른 운동이면 그대로.
 */
export function updateExercise(
  s: Session,
  index: number,
  values: Pick<SessionExercise, "reps" | "sets" | "restSec" | "tempoSec">,
): Session {
  if (s.machine.phase !== "READY" || s.machine.exerciseIndex !== index) return s;
  const exercises = s.exercises.map((e, i) => (i === index ? { ...e, ...values } : e));
  const sets = s.machine.sets.map((row, i) =>
    i !== index
      ? row
      : Array.from({ length: values.sets }, () => ({
          status: "pending" as const,
          targetReps: values.reps,
          reps: 0,
        })),
  );
  return { ...s, exercises, machine: { ...s.machine, sets } };
}

// ───────────────────────── 보조 계산 ─────────────────────────

function currentExercise(s: Session): SessionExercise {
  return s.exercises[s.machine.exerciseIndex];
}

/** 상태별 전체 길이(ms) */
function phaseDurationMs(s: Session, phase: ActivePhase): number {
  const ex = currentExercise(s);
  if (phase === "COUNTDOWN") return COUNTDOWN_MS;
  if (phase === "EXERCISE") return setDurationMs(ex.tempoSec, ex.reps);
  return ex.restSec * 1000;
}

/** 이 상태가 예정대로 끝나는 시각. 틱이 늦어도 다음 상태는 이 시각부터 시작한 것으로 센다(오차가 쌓이지 않게). */
function scheduledEnd(clock: Clock, durationMs: number): number {
  return clock.startedAt + (durationMs - clock.accumulatedMs);
}

/** 새 상태에 맞는 시계: 시간이 흐르는 상태면 startAt부터 돌고, 아니면 멈춘 시계 */
function clockFor(machine: Machine, startAt: number): Clock {
  const p = machine.phase;
  return p === "COUNTDOWN" || p === "EXERCISE" || p === "REST"
    ? startClock(createClock(), startAt)
    : createClock();
}

// ───────────────────────── 자동 진행 ─────────────────────────

/** 한 단계만 진행해 본다. 넘어갈 게 없으면 같은 객체를 돌려준다. */
function stepOnce(s: Session, nowMs: number): Session {
  const m = s.machine;
  if (!s.clock.running) return s;
  if (m.phase !== "COUNTDOWN" && m.phase !== "EXERCISE" && m.phase !== "REST") return s;

  const el = elapsedMs(s.clock, nowMs);
  const ex = currentExercise(s);

  if (m.phase === "COUNTDOWN") {
    if (!isCountdownDone(el)) return s;
    const end = scheduledEnd(s.clock, COUNTDOWN_MS);
    const next = transition(m, { type: "COUNTDOWN_DONE" });
    return { ...s, machine: next, clock: clockFor(next, end) };
  }

  if (m.phase === "EXERCISE") {
    if (!isSetComplete(el, ex.tempoSec, ex.reps)) return s;
    const dur = setDurationMs(ex.tempoSec, ex.reps);
    const end = scheduledEnd(s.clock, dur);
    // 목표 반복 도달: 남은 세트가 있으면 REST, 운동의 마지막 세트면 READY, 루틴의 마지막이면 COMPLETED
    const next = transition(m, { type: "REPS_DONE", reps: ex.reps });
    return { ...s, machine: next, clock: clockFor(next, end), activeMs: s.activeMs + dur };
  }

  // REST
  if (!isRestDone(el, ex.restSec)) return s;
  const end = scheduledEnd(s.clock, ex.restSec * 1000);
  const next = transition(m, { type: "REST_DONE" });
  return { ...s, machine: next, clock: clockFor(next, end) };
}

/**
 * 지금 시각까지 저절로 넘어갈 수 있는 만큼 모두 진행한다.
 * 틱이 늦어 한 번에 여러 단계를 건너뛰어야 해도(예: 카운트다운 끝 + 운동 시작) 예정 시각 기준으로 따라잡는다.
 */
export function tick(s: Session, nowMs: number): Session {
  let cur = s;
  for (let i = 0; i < 1000; i++) {
    const next = stepOnce(cur, nowMs);
    if (next === cur) return cur;
    cur = next;
  }
  return cur;
}

// ───────────────────────── 사용자 조작 ─────────────────────────

/** 시작 탭: READY → COUNTDOWN. 첫 운동과 운동 사이 준비 화면에서 모두 같다. */
export function startSession(s: Session, nowMs: number): Session {
  const next = transition(s.machine, { type: "START" });
  if (next === s.machine) return s;
  return { ...s, machine: next, clock: clockFor(next, nowMs) };
}

/** 일시정지: 그 순간의 남은 시간을 저장하고 시계를 멈춘다. 멈출 수 없는 상태면 그대로. */
export function pauseSession(s: Session, nowMs: number): Session {
  const t = tick(s, nowMs); // 지나간 단계를 먼저 따라잡는다
  const m = t.machine;
  if (m.phase !== "COUNTDOWN" && m.phase !== "EXERCISE" && m.phase !== "REST") return t;

  const el = elapsedMs(t.clock, nowMs);
  const ex = currentExercise(t);
  const remaining =
    m.phase === "COUNTDOWN"
      ? countdownRemainingMs(el)
      : m.phase === "EXERCISE"
        ? exerciseRemainingMs(el, ex.tempoSec, ex.reps)
        : restRemainingMs(el, ex.restSec);

  return {
    ...t,
    machine: transition(m, { type: "PAUSE", remainingMs: remaining }),
    clock: createClock(),
  };
}

/** 이어하기: 멈췄던 상태로 돌아가 남은 시간부터 다시 센다. 멈춰 있던 시간은 들어가지 않는다. */
export function resumeSession(s: Session, nowMs: number): Session {
  const info = resumeInfo(s.machine);
  if (!info) return s;
  const total = phaseDurationMs(s, info.phase);
  const elapsedBefore = total - info.remainingMs;
  return {
    ...s,
    machine: transition(s.machine, { type: "RESUME" }),
    clock: startClock(createClock(elapsedBefore), nowMs),
  };
}

/** 현재 세트 건너뛰기: 운동 중에만 가능. 그때까지 센 반복 수를 기록하고 휴식 없이 다음으로 간다. */
export function skipSet(s: Session, nowMs: number): Session {
  const t = tick(s, nowMs);
  if (t.machine.phase !== "EXERCISE") return t;
  const ex = currentExercise(t);
  const el = Math.min(elapsedMs(t.clock, nowMs), setDurationMs(ex.tempoSec, ex.reps));
  const next = transition(t.machine, {
    type: "SKIP_SET",
    reps: repsDone(el, ex.tempoSec, ex.reps),
  });
  return { ...t, machine: next, clock: clockFor(next, nowMs), activeMs: t.activeMs + el };
}

/**
 * 종료 확정: 일시정지 중이거나 운동 사이 준비 화면에서만 가능하다.
 * 못 한 세트는 미수행이 되고, 진행 중이던 세트는 그때까지의 반복 수와 운동 시간을 남긴다.
 */
export function endSession(s: Session): Session {
  const m = s.machine;
  if (m.phase !== "PAUSED" && m.phase !== "READY") return s;

  let reps: number | undefined;
  let activeMs = s.activeMs;
  if (m.phase === "PAUSED" && m.pausedFrom === "EXERCISE" && m.remainingMs !== null) {
    const ex = currentExercise(s);
    const elapsed = setDurationMs(ex.tempoSec, ex.reps) - m.remainingMs;
    reps = repsDone(elapsed, ex.tempoSec, ex.reps);
    activeMs += elapsed;
  }
  return {
    ...s,
    machine: transition(m, { type: "END_CONFIRM", reps }),
    clock: createClock(),
    activeMs,
  };
}

// ───────────────────────── 화면·기록용 값 ─────────────────────────

/** 지금까지의 활성 운동 시간(ms): EXERCISE에서 실제로 흐른 시간의 합. 휴식·카운트다운·일시정지·준비 시간은 제외. */
export function activeTotalMs(s: Session, nowMs: number): number {
  const m = s.machine;
  if (m.phase === "EXERCISE") return s.activeMs + elapsedMs(s.clock, nowMs);
  if (m.phase === "PAUSED" && m.pausedFrom === "EXERCISE" && m.remainingMs !== null) {
    const ex = currentExercise(s);
    return s.activeMs + (setDurationMs(ex.tempoSec, ex.reps) - m.remainingMs);
  }
  return s.activeMs;
}

/** 지금 세트에서 센 반복 수. 운동 중이 아니면 0(일시정지 중에는 멈춘 시점의 값). */
export function currentReps(s: Session, nowMs: number): number {
  const m = s.machine;
  const ex = currentExercise(s);
  if (m.phase === "EXERCISE") return repsDone(elapsedMs(s.clock, nowMs), ex.tempoSec, ex.reps);
  if (m.phase === "PAUSED" && m.pausedFrom === "EXERCISE" && m.remainingMs !== null) {
    return repsDone(
      setDurationMs(ex.tempoSec, ex.reps) - m.remainingMs,
      ex.tempoSec,
      ex.reps,
    );
  }
  return 0;
}
