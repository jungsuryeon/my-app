// 샘플 루틴과 기본값 데이터 (PLAN 작업 3, PRD 5번 M1)
// 입력 범위 검증 함수는 작업 12(값 수정 화면)에서 이 파일에 추가한다.

/** 운동 하나의 설정 */
export type Exercise = {
  id: string;
  name: string;
  reps: number; // 세트당 반복 횟수
  sets: number; // 세트 수
  restSec: number; // 세트 사이 휴식(초)
  tempoSec: number; // 반복 1회당 시간(초)
  weightKg: number | null; // 무게(kg). 비워 두면 null → 기록에는 "-"
};

/** 루틴 = 운동 여러 개를 순서대로 */
export type Routine = {
  id: string;
  name: string;
  exercises: Exercise[];
};

/** 기본값: 반복 15회, 3세트, 휴식 30초, 템포 3초 */
export const DEFAULTS = {
  reps: 15,
  sets: 3,
  restSec: 30,
  tempoSec: 3,
  weightKg: null,
} as const;

/** 입력 허용 범위. 무게는 비워 둘 수 있고, 입력하면 0.5kg 단위다. */
export const LIMITS = {
  reps: { min: 1, max: 50 },
  sets: { min: 1, max: 10 },
  restSec: { min: 10, max: 600 },
  tempoSec: { min: 1, max: 10 },
  weightKg: { min: 0, max: 500, step: 0.5 },
} as const;

/** 기본값에 이름과 (필요하면) 반복 횟수만 바꿔 운동 하나를 만든다 */
function exercise(
  id: string,
  name: string,
  overrides: Partial<Pick<Exercise, "reps">> = {},
): Exercise {
  return {
    id,
    name,
    reps: DEFAULTS.reps,
    sets: DEFAULTS.sets,
    restSec: DEFAULTS.restSec,
    tempoSec: DEFAULTS.tempoSec,
    weightKg: DEFAULTS.weightKg,
    ...overrides,
  };
}

/** 샘플 루틴: 상체 데이 / 하체 데이 */
export const SAMPLE_ROUTINES: readonly Routine[] = [
  {
    id: "upper",
    name: "상체 데이",
    exercises: [
      exercise("lat-pulldown", "랫풀다운"),
      exercise("chest-press", "체스트프레스"),
      exercise("shoulder-press", "숄더프레스", { reps: 12 }),
    ],
  },
  {
    id: "lower",
    name: "하체 데이",
    exercises: [
      exercise("leg-press", "레그프레스"),
      exercise("hip-abduction", "아웃타이"),
      exercise("hip-adduction", "인타이"),
      exercise("squat", "스쿼트", { reps: 12 }),
    ],
  },
];

/**
 * 샘플 루틴을 복사해 돌려준다. 시작 전 값 수정이 원본 샘플을 바꾸지 않게 하기 위함.
 * 없는 id면 null.
 */
export function cloneRoutine(id: string): Routine | null {
  const found = SAMPLE_ROUTINES.find((r) => r.id === id);
  if (!found) return null;
  return {
    ...found,
    exercises: found.exercises.map((e) => ({ ...e })),
  };
}
