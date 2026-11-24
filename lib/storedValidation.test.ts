import { describe, expect, it } from "vitest";
import { isRoutineList } from "./myRoutines";
import { isRecordList, isSnapshot } from "./records";
import { isStoredExercise } from "./routines";

// 저장소에서 읽은 값(깨졌거나 직접 고쳐진 값)을 걸러내는 검사를 시험한다.

const ex = { id: "a", name: "운동A", sets: 2, reps: 3, tempoSec: 1, restSec: 10, weightKg: null };
const snap = () => ({
  recordId: "r1",
  routine: { id: "my-1", name: "루틴" },
  savedAt: 1_700_000_000_000,
  phase: "PAUSED",
  pausedFrom: "EXERCISE",
  remainingMs: 500,
  exerciseIndex: 0,
  setIndex: 0,
  sets: [
    [
      { status: "pending", targetReps: 3, reps: 0 },
      { status: "pending", targetReps: 3, reps: 0 },
    ],
  ],
  exercises: [{ ...ex }],
  activeMs: 1000,
});

describe("isStoredExercise", () => {
  it("정상 값은 통과한다", () => {
    expect(isStoredExercise(ex)).toBe(true);
    expect(isStoredExercise({ ...ex, weightKg: 42.5 })).toBe(true);
  });
  it("거대한 세트·반복 수, 음수, NaN, 무한대는 거절한다", () => {
    expect(isStoredExercise({ ...ex, sets: 1e9 })).toBe(false);
    expect(isStoredExercise({ ...ex, reps: 1e6 })).toBe(false);
    expect(isStoredExercise({ ...ex, restSec: -1 })).toBe(false);
    expect(isStoredExercise({ ...ex, tempoSec: Number.NaN })).toBe(false);
    expect(isStoredExercise({ ...ex, weightKg: Infinity })).toBe(false);
  });
  it("너무 긴 이름은 거절한다", () => {
    expect(isStoredExercise({ ...ex, name: "가".repeat(101) })).toBe(false);
  });
});

describe("isRoutineList(내 루틴 읽기)", () => {
  const r = { id: "my-1", name: "가슴 데이", exercises: [ex] };
  it("정상 목록은 통과한다", () => {
    expect(isRoutineList([r])).toBe(true);
  });
  it("값이 깨진 운동이 하나라도 있으면 거절한다", () => {
    expect(isRoutineList([{ ...r, exercises: [{ ...ex, sets: 1e9 }] }])).toBe(false);
  });
  it("이름이 너무 길거나 운동이 너무 많거나 루틴이 너무 많으면 거절한다", () => {
    expect(isRoutineList([{ ...r, name: "가".repeat(40) }])).toBe(false);
    expect(isRoutineList([{ ...r, exercises: Array.from({ length: 11 }, () => ex) }])).toBe(false);
    expect(isRoutineList(Array.from({ length: 21 }, () => r))).toBe(false);
  });
});

describe("isSnapshot(진행 상태 읽기)", () => {
  it("정상 스냅샷은 통과한다", () => {
    expect(isSnapshot(snap())).toBe(true);
  });
  it("운동 값이 깨졌으면 거절한다", () => {
    const s = snap();
    s.exercises[0].sets = 1e9;
    expect(isSnapshot(s)).toBe(false);
  });
  it("세트 칸 모양이 틀리거나 범위를 벗어나면 거절한다", () => {
    const a = snap();
    (a.sets[0][0] as { status: string }).status = "이상한값";
    expect(isSnapshot(a)).toBe(false);
    const b = snap();
    b.sets[0][0].reps = Number.NaN;
    expect(isSnapshot(b)).toBe(false);
  });
  it("세트 번호가 그 운동의 세트 수를 넘으면 거절한다", () => {
    const s = snap();
    s.setIndex = 99;
    expect(isSnapshot(s)).toBe(false);
  });
  it("숫자 필드가 NaN이면 거절한다", () => {
    const s = snap();
    s.activeMs = Number.NaN;
    expect(isSnapshot(s)).toBe(false);
  });
});

describe("isRecordList(운동 기록 읽기)", () => {
  const rec = {
    id: "x",
    date: 1_700_000_000_000,
    routineId: "upper",
    routineName: "상체 데이",
    activeSec: 60,
    exercises: [{ name: "랫풀다운", weightKg: null, sets: [{ status: "완료", targetReps: 15, reps: 15 }] }],
  };
  it("정상 기록은 통과하고, 깨진 숫자는 거절한다", () => {
    expect(isRecordList([rec])).toBe(true);
    expect(isRecordList([{ ...rec, activeSec: Number.NaN }])).toBe(false);
    expect(
      isRecordList([{ ...rec, exercises: [{ ...rec.exercises[0], sets: [{ status: "완료", targetReps: 15, reps: 1e9 }] }] }]),
    ).toBe(false);
  });
});
