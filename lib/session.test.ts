import { describe, expect, it } from "vitest";
import { completedSetCount } from "./machine";
import {
  activeTotalMs,
  createSession,
  currentReps,
  endSession,
  pauseSession,
  resumeSession,
  skipSet,
  startSession,
  tick,
  updateExercise,
  type Session,
} from "./session";

// 운동 A: 2세트 × 3회, 템포 1초, 휴식 2초 / 운동 B: 1세트 × 2회, 템포 1초, 휴식 5초
const routine = [
  { id: "a", name: "운동A", sets: 2, reps: 3, tempoSec: 1, restSec: 2, weightKg: null },
  { id: "b", name: "운동B", sets: 1, reps: 2, tempoSec: 1, restSec: 5, weightKg: null },
];

/** 시각을 step씩 앞으로 보내며 tick을 부른다 */
function run(s: Session, from: number, to: number, step = 250): Session {
  let cur = s;
  for (let t = from + step; t <= to; t += step) cur = tick(cur, t);
  return cur;
}
const phaseAt = (s: Session) => s.machine.phase;

describe("자동 진행", () => {
  it("시작 전에는 tick을 해도 아무 일도 없다", () => {
    const s = createSession(routine);
    expect(tick(s, 5000)).toBe(s);
  });

  it("시작 → 3초 카운트다운 → 운동 (정확히 3초에 넘어간다)", () => {
    let s = startSession(createSession(routine), 0);
    expect(phaseAt(s)).toBe("COUNTDOWN");
    s = tick(s, 2999);
    expect(phaseAt(s)).toBe("COUNTDOWN");
    s = tick(s, 3000);
    expect(phaseAt(s)).toBe("EXERCISE");
  });

  it("세트 완료 후 휴식 → 휴식이 끝나면 저절로 다음 세트 운동", () => {
    let s = startSession(createSession(routine), 0);
    s = run(s, 0, 6000); // 카운트다운 3초 + 3회×1초
    expect(phaseAt(s)).toBe("REST");
    expect(s.machine.setIndex).toBe(0);
    s = tick(s, 7999);
    expect(phaseAt(s)).toBe("REST");
    s = tick(s, 8000);
    expect(phaseAt(s)).toBe("EXERCISE");
    expect(s.machine.setIndex).toBe(1);
  });

  it("운동의 마지막 세트가 끝나면 휴식 없이 다음 운동 준비(READY)로 멈춘다", () => {
    let s = startSession(createSession(routine), 0);
    s = run(s, 0, 11_000); // 카운트다운3 + 세트3 + 휴식2 + 세트3
    expect(phaseAt(s)).toBe("READY");
    expect(s.machine.exerciseIndex).toBe(1);
    // READY에서는 시간이 흘러도 저절로 넘어가지 않는다
    expect(tick(s, 99_000)).toBe(s);
  });

  it("준비 화면에서 시작을 누르면 다시 3초 카운트다운 후 시작, 마지막 세트 뒤에는 COMPLETED", () => {
    let s = startSession(createSession(routine), 0);
    s = run(s, 0, 11_000);
    s = startSession(s, 20_000);
    expect(phaseAt(s)).toBe("COUNTDOWN");
    s = run(s, 20_000, 25_000); // 카운트다운3 + 2회×1초
    expect(phaseAt(s)).toBe("COMPLETED");
    expect(completedSetCount(s.machine)).toBe(3);
  });

  it("활성 운동 시간은 운동(EXERCISE) 시간만 더한다: 카운트다운·휴식·준비 제외", () => {
    let s = startSession(createSession(routine), 0);
    s = run(s, 0, 11_000);
    expect(activeTotalMs(s, 11_000)).toBe(6000); // 3초 × 2세트
    s = startSession(s, 20_000);
    s = run(s, 20_000, 25_000);
    expect(activeTotalMs(s, 25_000)).toBe(8000); // + 2초
  });

  it("틱이 늦어도 다음 상태는 예정 시각부터 센다(오차가 쌓이지 않는다)", () => {
    let s = startSession(createSession(routine), 0);
    s = tick(s, 3400); // 카운트다운은 3000에 끝났어야 함
    expect(phaseAt(s)).toBe("EXERCISE");
    expect(currentReps(s, 3400)).toBe(0); // 400ms 지남 → 아직 0회
    expect(currentReps(s, 4000)).toBe(1); // 운동은 3000부터 센 것으로 본다
  });

  it("틱이 한 번에 여러 단계를 건너뛰어도 따라잡는다", () => {
    let s = startSession(createSession(routine), 0);
    s = tick(s, 6500); // 카운트다운 끝 + 운동 끝이 모두 지나고 휴식 0.5초째
    expect(phaseAt(s)).toBe("REST");
    expect(s.machine.sets[0][0].status).toBe("done");
  });
});

describe("일시정지와 이어하기", () => {
  it("멈춘 시간은 빠지고 남은 시간부터 이어서 센다", () => {
    let s = startSession(createSession(routine), 0);
    s = run(s, 0, 4000); // 운동 1초 경과(1회)
    expect(currentReps(s, 4000)).toBe(1);
    s = pauseSession(s, 4000);
    expect(phaseAt(s)).toBe("PAUSED");
    expect(s.machine.pausedFrom).toBe("EXERCISE");
    expect(s.machine.remainingMs).toBe(2000);
    expect(tick(s, 50_000)).toBe(s); // 멈춰 있는 동안은 아무 일도 없다
    s = resumeSession(s, 10_000);
    expect(phaseAt(s)).toBe("EXERCISE");
    s = tick(s, 11_999);
    expect(phaseAt(s)).toBe("EXERCISE");
    s = tick(s, 12_000); // 남은 2초가 지나 세트 완료 → 휴식
    expect(phaseAt(s)).toBe("REST");
  });

  it("일시정지 시간은 활성 운동 시간에 들어가지 않는다", () => {
    let s = startSession(createSession(routine), 0);
    s = run(s, 0, 4000);
    s = pauseSession(s, 4000);
    expect(activeTotalMs(s, 9000)).toBe(1000);
    s = resumeSession(s, 10_000);
    s = run(s, 10_000, 12_000);
    expect(activeTotalMs(s, 12_000)).toBe(3000);
  });

  it("카운트다운·휴식 중에도 멈췄다 이어갈 수 있다", () => {
    let s = startSession(createSession(routine), 0);
    s = pauseSession(s, 1000); // 카운트다운 1초 경과
    expect(s.machine.remainingMs).toBe(2000);
    s = resumeSession(s, 5000);
    s = tick(s, 6999);
    expect(phaseAt(s)).toBe("COUNTDOWN");
    s = tick(s, 7000);
    expect(phaseAt(s)).toBe("EXERCISE");

    s = run(s, 7000, 10_000); // 세트 완료 → 휴식 시작(10000)
    expect(phaseAt(s)).toBe("REST");
    s = pauseSession(s, 11_000); // 휴식 1초 경과
    expect(s.machine.remainingMs).toBe(1000);
    s = resumeSession(s, 20_000);
    s = tick(s, 21_000);
    expect(phaseAt(s)).toBe("EXERCISE");
  });

  it("멈출 수 없는 상태(READY)에서는 아무 일도 없다", () => {
    const s = createSession(routine);
    expect(pauseSession(s, 1000)).toBe(s);
  });
});

describe("세트 건너뛰기", () => {
  it("운동 중 건너뛰면 그때까지의 반복 수를 기록하고 휴식 없이 3초 카운트다운 후 다음 세트", () => {
    let s = startSession(createSession(routine), 0);
    s = run(s, 0, 5000); // 운동 2초 경과 → 2회
    s = skipSet(s, 5000);
    expect(phaseAt(s)).toBe("COUNTDOWN");
    expect(s.machine.setIndex).toBe(1);
    expect(s.machine.sets[0][0]).toMatchObject({ status: "skipped", reps: 2 });
    expect(activeTotalMs(s, 5000)).toBe(2000);
    s = tick(s, 7999);
    expect(phaseAt(s)).toBe("COUNTDOWN");
    s = tick(s, 8000);
    expect(phaseAt(s)).toBe("EXERCISE");
  });

  it("휴식·카운트다운 중에는 건너뛸 수 없다", () => {
    const s = startSession(createSession(routine), 0);
    expect(skipSet(s, 1000)).toBe(s);
  });
});

describe("다음 운동 값 수정", () => {
  it("운동 사이 준비 화면에서 고친 값(세트 수·반복·휴식·템포)이 다음 운동에 반영된다", () => {
    let s = startSession(createSession(routine), 0);
    s = run(s, 0, 11_000); // 운동 A 끝 → B 준비
    s = updateExercise(s, 1, { reps: 4, sets: 2, restSec: 3, tempoSec: 2 });
    expect(s.machine.sets[1]).toHaveLength(2);
    expect(s.machine.sets[1][0]).toMatchObject({ status: "pending", targetReps: 4 });
    s = startSession(s, 20_000);
    s = run(s, 20_000, 34_000); // 카운트다운3 + 4회×2초 = 8초 + 휴식 3초 → 둘째 세트 운동
    expect(s.machine.phase).toBe("EXERCISE");
    expect(s.machine.setIndex).toBe(1);
  });

  it("준비 화면이 아니거나 다른 운동이면 바꾸지 않는다", () => {
    const s = createSession(routine);
    expect(updateExercise(s, 1, { reps: 9, sets: 9, restSec: 9, tempoSec: 9 })).toBe(s);
    const running = startSession(s, 0);
    expect(updateExercise(running, 0, { reps: 9, sets: 9, restSec: 9, tempoSec: 9 })).toBe(running);
  });
});

describe("전체 종료", () => {
  it("일시정지 중 종료: 진행 중이던 세트는 반복 수와 운동 시간을 남기고 나머지는 미수행", () => {
    let s = startSession(createSession(routine), 0);
    s = run(s, 0, 4500); // 운동 1.5초 → 1회
    s = pauseSession(s, 4500);
    s = endSession(s);
    expect(phaseAt(s)).toBe("COMPLETED");
    expect(s.machine.sets[0][0]).toMatchObject({ status: "notDone", reps: 1 });
    expect(s.machine.sets[0][1].status).toBe("notDone");
    expect(s.activeMs).toBe(1500);
  });

  it("운동 사이 준비 화면에서도 종료할 수 있다", () => {
    let s = startSession(createSession(routine), 0);
    s = run(s, 0, 11_000);
    s = endSession(s);
    expect(phaseAt(s)).toBe("COMPLETED");
    expect(completedSetCount(s.machine)).toBe(2);
    expect(s.activeMs).toBe(6000);
  });

  it("운동이 진행 중일 때는 바로 종료할 수 없다(먼저 멈춰야 함)", () => {
    const s = run(startSession(createSession(routine), 0), 0, 4000);
    expect(endSession(s)).toBe(s);
  });
});
