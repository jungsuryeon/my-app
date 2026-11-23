// 운동 진행 상태 머신 (PLAN 작업 5, PRD "상태 전이표", DESIGN §2.2 · §3.5)
// 화면·소리·시간과 무관한 "순수 계산"이다. 현재 상태와 사건(event)을 받아 새 상태를 돌려준다.
// 시간 흐름(카운트다운·반복 세기·휴식 시간)은 작업 6·7에서 이 머신에 사건을 보내는 방식으로 연결한다.

/** 상태는 이 여섯 가지만 쓴다 */
export type Phase =
  | "READY"
  | "COUNTDOWN"
  | "EXERCISE"
  | "REST"
  | "PAUSED"
  | "COMPLETED";

/** 멈출 수 있는 상태(= PAUSED에서 돌아갈 수 있는 상태) */
export type ActivePhase = "COUNTDOWN" | "EXERCISE" | "REST";

/** 세트 상태. pending = 아직 안 함(진행 중 포함), notDone = 전체 종료로 하지 못한 세트(기록의 "미수행") */
export type SetStatus = "pending" | "done" | "skipped" | "notDone";

export type SetRecord = {
  status: SetStatus;
  targetReps: number; // 목표 반복 수
  reps: number; // 실제(예상) 반복 수
};

export type Machine = {
  phase: Phase;
  /** PAUSED일 때, 멈추기 전 상태. 그 밖에는 null */
  pausedFrom: ActivePhase | null;
  /** PAUSED일 때, 멈춘 순간 그 상태의 남은 시간(ms). 이어하기 때 이 값부터 진행한다. 그 밖에는 null */
  remainingMs: number | null;
  exerciseIndex: number;
  setIndex: number;
  /** 운동별 세트 기록 */
  sets: SetRecord[][];
};

/** 사건. 사용자 입력과 시간 흐름이 모두 이 사건으로 들어온다. */
export type MachineEvent =
  | { type: "START" } // READY → COUNTDOWN (시작 탭)
  | { type: "COUNTDOWN_DONE" } // COUNTDOWN → EXERCISE (0초)
  | { type: "REPS_DONE"; reps: number } // EXERCISE: 목표 반복 도달
  | { type: "SKIP_SET"; reps: number } // EXERCISE: 현재 세트 건너뛰기(그때까지의 반복 수)
  | { type: "REST_DONE" } // REST → EXERCISE (남은 시간 0)
  | { type: "PAUSE"; remainingMs: number } // 일시정지·화면 이탈·전체 종료 확인창
  | { type: "RESUME" } // PAUSED → pausedFrom
  | { type: "END_CONFIRM"; reps?: number }; // 종료 확정 → COMPLETED (PAUSED 또는 READY에서)

/** 운동 설정 중 머신에 필요한 것만 */
export type MachineExercise = { sets: number; reps: number };

/** READY 상태의 새 머신을 만든다 (첫 운동 준비 화면) */
export function createMachine(exercises: MachineExercise[]): Machine {
  return {
    phase: "READY",
    pausedFrom: null,
    remainingMs: null,
    exerciseIndex: 0,
    setIndex: 0,
    sets: exercises.map((e) =>
      Array.from({ length: e.sets }, () => ({
        status: "pending" as SetStatus,
        targetReps: e.reps,
        reps: 0,
      })),
    ),
  };
}

/** 지금 세트가 이 운동의 마지막 세트인가 */
export function isLastSetOfExercise(m: Machine): boolean {
  return m.setIndex >= m.sets[m.exerciseIndex].length - 1;
}

/** 지금 운동이 루틴의 마지막 운동인가 */
export function isLastExercise(m: Machine): boolean {
  return m.exerciseIndex >= m.sets.length - 1;
}

/** 완료한 세트 수 (건너뜀·미수행은 제외) */
export function completedSetCount(m: Machine): number {
  return m.sets.flat().filter((s) => s.status === "done").length;
}

/** 전체 세트 수 */
export function totalSetCount(m: Machine): number {
  return m.sets.flat().length;
}

// ───────────────────────── 전이 ─────────────────────────

function withSet(m: Machine, status: SetStatus, reps: number): SetRecord[][] {
  return m.sets.map((row, ei) =>
    ei !== m.exerciseIndex
      ? row
      : row.map((s, si) => (si !== m.setIndex ? s : { ...s, status, reps })),
  );
}

/**
 * 현재 세트를 끝낸(완료 또는 건너뜀) 뒤 다음으로 갈 곳을 정한다.
 * - 운동에 남은 세트가 있음: whenMoreSets (완료 → REST, 건너뜀 → COUNTDOWN)
 * - 운동의 마지막 세트: 다음 운동 준비(READY)
 * - 루틴의 마지막 세트: COMPLETED
 */
function afterSet(
  m: Machine,
  sets: SetRecord[][],
  whenMoreSets: "REST" | "COUNTDOWN",
): Machine {
  const base = { ...m, sets, pausedFrom: null, remainingMs: null };
  if (!isLastSetOfExercise(m)) {
    // 건너뜀은 휴식 없이 바로 다음 세트로 가므로 세트 번호를 지금 올린다.
    // 완료 후 휴식은 REST_DONE에서 올린다.
    return {
      ...base,
      phase: whenMoreSets,
      setIndex: whenMoreSets === "COUNTDOWN" ? m.setIndex + 1 : m.setIndex,
    };
  }
  if (!isLastExercise(m)) {
    return { ...base, phase: "READY", exerciseIndex: m.exerciseIndex + 1, setIndex: 0 };
  }
  return { ...base, phase: "COMPLETED" };
}

/** 종료 확정: 아직 안 끝난 세트는 모두 미수행으로 바꾼다 */
function markRemainingNotDone(m: Machine, currentReps: number | undefined): SetRecord[][] {
  return m.sets.map((row, ei) =>
    row.map((s, si) => {
      if (s.status !== "pending") return s;
      const isCurrent = ei === m.exerciseIndex && si === m.setIndex;
      // 진행 중이던 세트는 그때까지의 반복 수를 남기고, 나머지는 0
      return { ...s, status: "notDone" as SetStatus, reps: isCurrent ? (currentReps ?? 0) : 0 };
    }),
  );
}

/**
 * 전이표대로 새 상태를 돌려준다.
 * 지금 상태에서 일어날 수 없는 사건은 무시하고 같은 객체를 그대로 돌려준다.
 */
export function transition(m: Machine, e: MachineEvent): Machine {
  switch (e.type) {
    case "START":
      if (m.phase !== "READY") return m;
      return { ...m, phase: "COUNTDOWN" };

    case "COUNTDOWN_DONE":
      if (m.phase !== "COUNTDOWN") return m;
      return { ...m, phase: "EXERCISE" };

    case "REPS_DONE":
      if (m.phase !== "EXERCISE") return m;
      return afterSet(m, withSet(m, "done", e.reps), "REST");

    case "SKIP_SET":
      // 세트 건너뛰기는 운동 중(EXERCISE)에만 가능하다
      if (m.phase !== "EXERCISE") return m;
      return afterSet(m, withSet(m, "skipped", e.reps), "COUNTDOWN");

    case "REST_DONE":
      if (m.phase !== "REST") return m;
      return { ...m, phase: "EXERCISE", setIndex: m.setIndex + 1 };

    case "PAUSE":
      if (m.phase !== "COUNTDOWN" && m.phase !== "EXERCISE" && m.phase !== "REST") {
        return m;
      }
      return {
        ...m,
        phase: "PAUSED",
        pausedFrom: m.phase,
        remainingMs: Math.max(0, e.remainingMs),
      };

    case "RESUME":
      if (m.phase !== "PAUSED" || m.pausedFrom === null) return m;
      // 상태만 되돌린다. 남은 시간은 여기서 지워지므로, 호출하는 쪽은 RESUME을 보내기 전에
      // resumeInfo()로 남은 시간을 먼저 꺼내 두었다가 그 값부터 이어서 센다.
      return { ...m, phase: m.pausedFrom, pausedFrom: null, remainingMs: null };

    case "END_CONFIRM":
      // 종료 확정은 일시정지 중이거나 운동 사이 준비 화면(READY)에서만 가능하다
      if (m.phase !== "PAUSED" && m.phase !== "READY") return m;
      return {
        ...m,
        phase: "COMPLETED",
        pausedFrom: null,
        remainingMs: null,
        sets: markRemainingNotDone(m, e.reps),
      };
  }
}

/** 이어하기 전에 "어느 상태로 얼마 남았는지"를 꺼내 본다. PAUSED가 아니면 null. */
export function resumeInfo(m: Machine): { phase: ActivePhase; remainingMs: number } | null {
  if (m.phase !== "PAUSED" || m.pausedFrom === null || m.remainingMs === null) return null;
  return { phase: m.pausedFrom, remainingMs: m.remainingMs };
}
