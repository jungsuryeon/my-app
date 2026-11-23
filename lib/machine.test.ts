import { describe, expect, it } from "vitest";
import {
  completedSetCount,
  createMachine,
  resumeInfo,
  totalSetCount,
  transition,
  type Machine,
  type MachineEvent,
} from "./machine";

// 운동 2개: A(2세트, 목표 15회), B(1세트, 목표 12회)
const routine = [
  { sets: 2, reps: 15 },
  { sets: 1, reps: 12 },
];

/** 사건을 차례로 보낸다 */
function run(events: MachineEvent[], start: Machine = createMachine(routine)): Machine {
  return events.reduce(transition, start);
}
const toExercise: MachineEvent[] = [{ type: "START" }, { type: "COUNTDOWN_DONE" }];

describe("시작과 기본 흐름", () => {
  it("처음에는 READY, 첫 운동·첫 세트이고 세트는 모두 pending", () => {
    const m = createMachine(routine);
    expect(m.phase).toBe("READY");
    expect([m.exerciseIndex, m.setIndex]).toEqual([0, 0]);
    expect(totalSetCount(m)).toBe(3);
    expect(m.sets[0][0]).toEqual({ status: "pending", targetReps: 15, reps: 0 });
    expect(m.sets[1][0].targetReps).toBe(12);
  });

  it("READY → COUNTDOWN → EXERCISE", () => {
    expect(run([{ type: "START" }]).phase).toBe("COUNTDOWN");
    expect(run(toExercise).phase).toBe("EXERCISE");
  });

  it("남은 세트가 있으면 반복 완료 후 REST, 휴식이 끝나면 다음 세트의 EXERCISE", () => {
    let m = run([...toExercise, { type: "REPS_DONE", reps: 15 }]);
    expect(m.phase).toBe("REST");
    expect(m.setIndex).toBe(0);
    expect(m.sets[0][0]).toMatchObject({ status: "done", reps: 15 });
    m = run([{ type: "REST_DONE" }], m);
    expect(m.phase).toBe("EXERCISE");
    expect(m.setIndex).toBe(1);
  });

  it("운동의 마지막 세트가 끝나면 휴식 없이 다음 운동 준비(READY)", () => {
    const m = run([
      ...toExercise,
      { type: "REPS_DONE", reps: 15 },
      { type: "REST_DONE" },
      { type: "REPS_DONE", reps: 15 },
    ]);
    expect(m.phase).toBe("READY");
    expect([m.exerciseIndex, m.setIndex]).toEqual([1, 0]);
  });

  it("루틴의 마지막 세트가 끝나면 COMPLETED", () => {
    const m = run([
      ...toExercise,
      { type: "REPS_DONE", reps: 15 },
      { type: "REST_DONE" },
      { type: "REPS_DONE", reps: 15 },
      { type: "START" },
      { type: "COUNTDOWN_DONE" },
      { type: "REPS_DONE", reps: 12 },
    ]);
    expect(m.phase).toBe("COMPLETED");
    expect(completedSetCount(m)).toBe(3);
  });
});

describe("세트 건너뛰기", () => {
  it("남은 세트가 있으면 휴식 없이 COUNTDOWN으로 다음 세트", () => {
    const m = run([...toExercise, { type: "SKIP_SET", reps: 6 }]);
    expect(m.phase).toBe("COUNTDOWN");
    expect(m.setIndex).toBe(1);
    expect(m.sets[0][0]).toMatchObject({ status: "skipped", reps: 6 });
    expect(completedSetCount(m)).toBe(0); // 건너뜀은 완료 세트에 포함하지 않는다
  });

  it("운동의 마지막 세트를 건너뛰면 다음 운동 준비(READY)", () => {
    const m = run([
      ...toExercise,
      { type: "SKIP_SET", reps: 0 },
      { type: "COUNTDOWN_DONE" },
      { type: "SKIP_SET", reps: 3 },
    ]);
    expect(m.phase).toBe("READY");
    expect(m.exerciseIndex).toBe(1);
  });

  it("루틴의 마지막 세트를 건너뛰면 COMPLETED", () => {
    const one = createMachine([{ sets: 1, reps: 10 }]);
    const m = run([...toExercise, { type: "SKIP_SET", reps: 2 }], one);
    expect(m.phase).toBe("COMPLETED");
    expect(m.sets[0][0].status).toBe("skipped");
  });

  it("EXERCISE가 아닐 때(COUNTDOWN·REST)는 건너뛰기를 무시한다", () => {
    const cd = run([{ type: "START" }]);
    expect(transition(cd, { type: "SKIP_SET", reps: 0 })).toBe(cd);
    const rest = run([...toExercise, { type: "REPS_DONE", reps: 15 }]);
    expect(transition(rest, { type: "SKIP_SET", reps: 0 })).toBe(rest);
  });
});

describe("일시정지와 이어하기", () => {
  it.each([
    ["COUNTDOWN", [{ type: "START" }] as MachineEvent[]],
    ["EXERCISE", toExercise],
    ["REST", [...toExercise, { type: "REPS_DONE", reps: 15 }] as MachineEvent[]],
  ])("%s에서 멈추면 pausedFrom과 남은 시간을 저장하고, 이어하면 같은 상태로 돌아간다", (name, events) => {
    const before = run(events);
    const paused = transition(before, { type: "PAUSE", remainingMs: 12_345 });
    expect(paused.phase).toBe("PAUSED");
    expect(paused.pausedFrom).toBe(name);
    expect(resumeInfo(paused)).toEqual({ phase: name, remainingMs: 12_345 });
    const resumed = transition(paused, { type: "RESUME" });
    expect(resumed.phase).toBe(name);
    expect(resumed.pausedFrom).toBeNull();
    expect([resumed.exerciseIndex, resumed.setIndex]).toEqual([before.exerciseIndex, before.setIndex]);
  });

  it("READY·COMPLETED에서는 멈출 수 없다(무시)", () => {
    const ready = createMachine(routine);
    expect(transition(ready, { type: "PAUSE", remainingMs: 1 })).toBe(ready);
  });

  it("이미 PAUSED일 때 또 멈춰도 pausedFrom이 바뀌지 않는다", () => {
    const paused = run([...toExercise, { type: "PAUSE", remainingMs: 5000 }]);
    expect(transition(paused, { type: "PAUSE", remainingMs: 1 })).toBe(paused);
  });

  it("음수 남은 시간은 0으로 저장한다", () => {
    const paused = run([...toExercise, { type: "PAUSE", remainingMs: -50 }]);
    expect(paused.remainingMs).toBe(0);
  });

  it("PAUSED가 아니면 RESUME은 무시한다", () => {
    const m = run(toExercise);
    expect(transition(m, { type: "RESUME" })).toBe(m);
    expect(resumeInfo(m)).toBeNull();
  });
});

describe("종료 확정(전체 종료)", () => {
  it("일시정지 중 종료하면 COMPLETED, 못 한 세트는 미수행이고 진행 중이던 세트는 반복 수를 남긴다", () => {
    const m = run([
      ...toExercise,
      { type: "REPS_DONE", reps: 15 },
      { type: "REST_DONE" },
      { type: "PAUSE", remainingMs: 4000 },
      { type: "END_CONFIRM", reps: 7 },
    ]);
    expect(m.phase).toBe("COMPLETED");
    expect(m.sets[0][0].status).toBe("done");
    expect(m.sets[0][1]).toMatchObject({ status: "notDone", reps: 7 });
    expect(m.sets[1][0]).toMatchObject({ status: "notDone", reps: 0 });
    expect(completedSetCount(m)).toBe(1);
    expect(m.pausedFrom).toBeNull();
  });

  it("운동 사이 준비 화면(READY)에서도 종료할 수 있다", () => {
    const m = run([
      ...toExercise,
      { type: "REPS_DONE", reps: 15 },
      { type: "REST_DONE" },
      { type: "REPS_DONE", reps: 15 },
      { type: "END_CONFIRM" },
    ]);
    expect(m.phase).toBe("COMPLETED");
    expect(m.sets[1][0].status).toBe("notDone");
    expect(completedSetCount(m)).toBe(2);
  });

  it("진행 중(EXERCISE 등)에서 바로 종료 확정은 무시한다 — 먼저 멈춰야 한다", () => {
    const m = run(toExercise);
    expect(transition(m, { type: "END_CONFIRM" })).toBe(m);
  });
});

describe("일어날 수 없는 사건은 무시", () => {
  it("READY에서 COUNTDOWN_DONE·REPS_DONE·REST_DONE은 무시", () => {
    const m = createMachine(routine);
    expect(transition(m, { type: "COUNTDOWN_DONE" })).toBe(m);
    expect(transition(m, { type: "REPS_DONE", reps: 15 })).toBe(m);
    expect(transition(m, { type: "REST_DONE" })).toBe(m);
  });

  it("COMPLETED는 어떤 사건에도 바뀌지 않는다", () => {
    const done = run(
      [...toExercise, { type: "PAUSE", remainingMs: 1 }, { type: "END_CONFIRM" }],
    );
    expect(done.phase).toBe("COMPLETED");
    for (const e of [
      { type: "START" },
      { type: "RESUME" },
      { type: "END_CONFIRM" },
      { type: "PAUSE", remainingMs: 1 },
    ] as MachineEvent[]) {
      expect(transition(done, e)).toBe(done);
    }
  });

  it("원래 상태 객체는 바뀌지 않는다", () => {
    const m = createMachine(routine);
    const snapshot = JSON.stringify(m);
    transition(m, { type: "START" });
    expect(JSON.stringify(m)).toBe(snapshot);
  });
});
