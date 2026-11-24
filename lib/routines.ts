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

// ───────────────────────── 입력 값 검증 (PLAN 작업 12, PRD 입력값 범위) ─────────────────────────

/** 화면의 입력칸 값(글자). 비워 두거나 잘못 입력할 수 있어 숫자가 아니라 글자로 받는다. */
export type ExerciseInput = {
  reps: string;
  sets: string;
  restSec: string;
  tempoSec: string;
  weightKg: string;
};

export type FieldName = keyof ExerciseInput;
export type FieldErrors = Partial<Record<FieldName, string>>;

/** 운동 설정을 입력칸 글자로 바꾼다 (무게 null → 빈 칸) */
export function toInput(e: Exercise): ExerciseInput {
  return {
    reps: String(e.reps),
    sets: String(e.sets),
    restSec: String(e.restSec),
    tempoSec: String(e.tempoSec),
    weightKg: e.weightKg === null ? "" : String(e.weightKg),
  };
}

/** 글자를 숫자로. 비었거나 숫자가 아니면 null */
function toNumber(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** 소수점 아래가 한 자리 이하인가 (부동소수점 오차를 피하려고 글자로 확인) */
function hasAtMostOneDecimal(text: string): boolean {
  const m = text.trim().match(/\.(\d+)$/);
  return !m || m[1].length <= 1;
}

function checkInteger(
  text: string,
  label: string,
  unit: string,
  min: number,
  max: number,
): { value?: number; error?: string } {
  const n = toNumber(text);
  if (n === null) return { error: `${label}을(를) 입력해 주세요` };
  if (!Number.isInteger(n) || n < min || n > max) {
    return { error: `${label}은(는) ${min}~${max}${unit} 사이 정수로 입력해 주세요` };
  }
  return { value: n };
}

/**
 * 입력칸 값을 검사한다. 무게를 뺀 네 값은 비어 있거나 범위를 벗어나면 오류가 되고,
 * 무게는 비워 둘 수 있으며(null → 기록에는 "-") 입력하면 0~500kg, 0.5 단위여야 한다.
 * 오류가 하나도 없을 때만 values가 채워진다.
 */
export function validateInput(input: ExerciseInput): {
  errors: FieldErrors;
  values: Pick<Exercise, "reps" | "sets" | "restSec" | "tempoSec" | "weightKg"> | null;
} {
  const errors: FieldErrors = {};
  const L = LIMITS;

  const reps = checkInteger(input.reps, "반복", "회", L.reps.min, L.reps.max);
  const sets = checkInteger(input.sets, "세트", "개", L.sets.min, L.sets.max);
  const rest = checkInteger(input.restSec, "휴식", "초", L.restSec.min, L.restSec.max);
  if (reps.error) errors.reps = reps.error;
  if (sets.error) errors.sets = sets.error;
  if (rest.error) errors.restSec = rest.error;

  // 템포: 1~10초, 소수 한 자리까지
  const tempo = toNumber(input.tempoSec);
  if (tempo === null) {
    errors.tempoSec = "템포를 입력해 주세요";
  } else if (
    tempo < L.tempoSec.min ||
    tempo > L.tempoSec.max ||
    !hasAtMostOneDecimal(input.tempoSec)
  ) {
    errors.tempoSec = `템포는 ${L.tempoSec.min}~${L.tempoSec.max}초 사이로 입력해 주세요(소수 한 자리까지)`;
  }

  // 무게: 비워도 됨. 입력하면 0~500kg, 0.5 단위
  let weight: number | null = null;
  if (input.weightKg.trim() !== "") {
    const w = toNumber(input.weightKg);
    if (
      w === null ||
      w < L.weightKg.min ||
      w > L.weightKg.max ||
      !Number.isInteger(w / L.weightKg.step)
    ) {
      errors.weightKg = `무게는 비우거나 ${L.weightKg.min}~${L.weightKg.max}kg 사이 0.5 단위로 입력해 주세요`;
    } else {
      weight = w;
    }
  }

  if (Object.keys(errors).length > 0) return { errors, values: null };
  return {
    errors,
    values: {
      reps: reps.value!,
      sets: sets.value!,
      restSec: rest.value!,
      tempoSec: tempo!,
      weightKg: weight,
    },
  };
}

/** 저장소에서 읽은 이름이 너무 길지 않은가(깨졌거나 직접 고친 값 방어). 글자(코드 포인트) 기준 */
export function isReasonableText(v: unknown, max: number): v is string {
  return typeof v === "string" && [...v].length <= max;
}

/**
 * 저장소에서 읽은 값이 운동 하나로 쓸 수 있는가: 모양뿐 아니라 숫자가 상식적인 범위 안인지도 본다.
 * (값이 깨졌거나 직접 고쳐진 경우 거대한 세트 수 등으로 앱이 멈추는 것을 막는다.
 *  입력칸의 정확한 범위(LIMITS)보다 넉넉하게 잡아, 앞으로 입력 범위를 넓혀도 옛 저장 값이 거절되지 않게 한다)
 */
export function isStoredExercise(v: unknown): v is Exercise {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  const inRange = (n: unknown, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  return (
    isReasonableText(e.id, 100) &&
    isReasonableText(e.name, 100) &&
    inRange(e.reps, 1, 1000) &&
    inRange(e.sets, 1, 20) &&
    inRange(e.restSec, 0, 3600) &&
    inRange(e.tempoSec, 0.1, 60) &&
    (e.weightKg === null || inRange(e.weightKg, 0, 1000))
  );
}
