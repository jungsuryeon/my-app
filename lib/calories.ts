// 예상 소모 칼로리 (PRD §6)
// 칼로리(kcal) = 체중(kg) × MET × 운동 시간(시간). 참고용 추정값이며 의학적 조언이 아니다.
// MET 3.5 = 웨이트 트레이닝(가볍거나 보통 강도)에 흔히 쓰는 값. 이 값은 세트 사이 휴식을 포함한 평균이라
// 운동 시간에는 세트를 한 시간(활성 시간)과 휴식 시간을 함께 센다.

import type { SetRecord } from "./machine";
import type { Exercise } from "./routines";

export const MET = 3.5;

/**
 * 휴식 시간 추정(초): 세트를 완료한 뒤 휴식이 있는 만큼 그 운동의 휴식 설정을 더한다.
 * 휴식은 운동의 마지막 세트 뒤에는 없고, 건너뛴·못 한 세트 뒤에도 없다(PRD: 건너뛰면 휴식 없이 다음 세트).
 * 타이머가 휴식을 따로 재지 않으므로 설정값으로 계산한다.
 */
export function restSecEstimate(
  exercises: readonly Pick<Exercise, "restSec">[],
  sets: readonly (readonly Pick<SetRecord, "status">[])[],
): number {
  let total = 0;
  exercises.forEach((ex, ei) => {
    const row = sets[ei] ?? [];
    row.forEach((s, si) => {
      if (s.status === "done" && si < row.length - 1) total += ex.restSec;
    });
  });
  return total;
}

/** 체중·활성 시간·휴식 시간(초)으로 칼로리를 구한다. 가까운 정수(kcal). 체중이 없거나 시간이 0 이하면 null */
export function estimateKcal(
  weightKg: number | null,
  activeSec: number,
  restSec: number,
): number | null {
  if (weightKg === null || !(weightKg > 0)) return null;
  const totalSec = Math.max(0, activeSec) + Math.max(0, restSec);
  if (totalSec <= 0) return null;
  return Math.round((weightKg * MET * totalSec) / 3600);
}

/** 종료된 세션의 예상 칼로리. 체중이 없으면 null */
export function sessionKcal(
  weightKg: number | null,
  session: {
    activeMs: number;
    exercises: readonly Pick<Exercise, "restSec">[];
    machine: { sets: readonly (readonly Pick<SetRecord, "status">[])[] };
  },
): number | null {
  return estimateKcal(
    weightKg,
    session.activeMs / 1000,
    restSecEstimate(session.exercises, session.machine.sets),
  );
}
