// 내 루틴 만들기·저장 (확장 STEP: 루틴 등록, PRD §6)
// 이 폰의 localStorage(`reptimer:routines`)에만 저장하고 서버로 보내지 않는다. 샘플 루틴 2개는 따로 고정이다.

import { CATALOG, type CatalogExercise } from "./exerciseCatalog";
import { DEFAULTS, isReasonableText, isStoredExercise, toInput, validateInput, type Exercise, type Routine } from "./routines";
import { STORAGE_KEYS, readItem, writeItem } from "./storage";

export const MY_ROUTINE_LIMITS = {
  routines: 20,
  exercisesPerRoutine: 10,
  nameMax: 12,
} as const;

/** 내 루틴 id는 항상 이 접두사로 시작한다(샘플 루틴·임시 루틴과 구분) */
export const MY_ROUTINE_PREFIX = "my-";

export function newRoutineId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return MY_ROUTINE_PREFIX + rand;
}

// ───────────────────────── 검사 ─────────────────────────

/** 루틴 이름 검사: 앞뒤 공백·제어 문자를 지우고 비었거나 12자를 넘으면 오류 */
export function validateRoutineName(
  input: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const cleaned = input.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (cleaned === "") return { ok: false, error: "루틴 이름을 입력해 주세요." };
  if ([...cleaned].length > MY_ROUTINE_LIMITS.nameMax) {
    return { ok: false, error: `루틴 이름은 ${MY_ROUTINE_LIMITS.nameMax}글자까지 쓸 수 있어요.` };
  }
  return { ok: true, name: cleaned };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isRoutine(v: unknown): v is Routine {
  return (
    isObject(v) &&
    typeof v.id === "string" &&
    v.id.startsWith(MY_ROUTINE_PREFIX) &&
    isReasonableText(v.name, MY_ROUTINE_LIMITS.nameMax * 2) &&
    Array.isArray(v.exercises) &&
    v.exercises.length > 0 &&
    v.exercises.length <= MY_ROUTINE_LIMITS.exercisesPerRoutine &&
    v.exercises.every(isStoredExercise)
  );
}

export function isRoutineList(v: unknown): v is Routine[] {
  return Array.isArray(v) && v.length <= MY_ROUTINE_LIMITS.routines && v.every(isRoutine);
}

// ───────────────────────── 만들기 (순수 계산) ─────────────────────────

/** 검증된 운동 하나를 기본값으로 루틴 속 운동으로 만든다 */
export function exerciseFromCatalog(c: CatalogExercise): Exercise {
  return {
    id: c.key,
    name: c.name,
    reps: DEFAULTS.reps,
    sets: DEFAULTS.sets,
    restSec: DEFAULTS.restSec,
    tempoSec: DEFAULTS.tempoSec,
    weightKg: DEFAULTS.weightKg,
  };
}

/** 담은 운동 key 목록 → 루틴 속 운동 목록. 목록에 없는 key는 건너뛴다. */
export function exercisesFromKeys(keys: readonly string[]): Exercise[] {
  return keys.flatMap((k) => {
    const c = CATALOG.find((x) => x.key === k);
    return c ? [exerciseFromCatalog(c)] : [];
  });
}

/** 담긴 목록에서 한 칸 옮긴다(dir: -1 위로, +1 아래로). 끝이면 그대로 */
export function moveItem<T>(list: readonly T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** 시작할 때 쓰는 복사본(저장된 원본을 시작 전 값 수정이 바꾸지 않도록) */
export function copyRoutine(r: Routine): Routine {
  return { ...r, exercises: r.exercises.map((e) => ({ ...e })) };
}

// ───────────────────────── 저장·불러오기 ─────────────────────────

export type RoutinesResult =
  | { ok: true; routines: Routine[] }
  | { ok: false; reason: "corrupt" | "storage" | "limit" | "invalid" | "missing"; message: string };

export const ROUTINE_MESSAGES = {
  storage: "저장하지 못했어요. 저장 공간이 부족하거나 브라우저 설정 때문일 수 있어요. 다시 시도해 주세요.",
  corrupt: "저장된 루틴 목록이 손상돼 있어서 변경하지 않았어요(기존 루틴을 덮어쓰지 않기 위해서예요). 홈의 데이터 초기화 뒤에 다시 시도해 주세요.",
  limit: `루틴은 ${MY_ROUTINE_LIMITS.routines}개까지 만들 수 있어요. 안 쓰는 루틴을 삭제해 주세요.`,
  missing: "이미 없는 루틴이에요.",
} as const;

/** 저장된 내 루틴을 읽는다. 손상됐으면 invalid. 화면이 그려진 뒤에만 부른다. */
export function loadMyRoutines():
  | { ok: true; routines: Routine[]; invalid: boolean }
  | { ok: false } {
  const r = readItem<Routine[]>(STORAGE_KEYS.routines, isRoutineList);
  if (!r.ok) return { ok: false };
  return { ok: true, routines: r.value ?? [], invalid: r.invalid };
}

/**
 * 목록을 바꿔 저장한다: 읽고(손상이면 중단) → 고치고 → 쓰고 → 다시 읽어 확인한다.
 * 기존 목록이 손상돼 있으면 덮어쓰지 않는다(루틴을 조용히 잃지 않기 위함).
 */
function update(change: (list: Routine[]) => Routine[] | RoutinesResult): RoutinesResult {
  const fail = (reason: "corrupt" | "storage"): RoutinesResult => ({
    ok: false,
    reason,
    message: ROUTINE_MESSAGES[reason],
  });
  const cur = readItem<Routine[]>(STORAGE_KEYS.routines, isRoutineList);
  if (!cur.ok) return fail("storage");
  if (cur.invalid) return fail("corrupt");

  const changed = change(cur.value ?? []);
  if (!Array.isArray(changed)) return changed;

  if (!writeItem(STORAGE_KEYS.routines, changed).ok) return fail("storage");
  const back = readItem<Routine[]>(STORAGE_KEYS.routines, isRoutineList);
  if (!back.ok || back.invalid || JSON.stringify(back.value) !== JSON.stringify(changed)) return fail("storage");
  return { ok: true, routines: changed };
}

/** 이름·운동 개수·운동 값(반복·세트·휴식·템포·무게 범위)을 한꺼번에 검사한다 */
export function checkRoutineInput(
  name: string,
  exercises: readonly Exercise[],
): { ok: true; name: string } | { ok: false; error: string } {
  const v = validateRoutineName(name);
  if (!v.ok) return v;
  if (exercises.length === 0) return { ok: false, error: "운동을 하나 이상 담아 주세요." };
  if (exercises.length > MY_ROUTINE_LIMITS.exercisesPerRoutine) {
    return {
      ok: false,
      error: `한 루틴에는 운동을 ${MY_ROUTINE_LIMITS.exercisesPerRoutine}개까지 담을 수 있어요.`,
    };
  }
  const bad = exercises.find((e) => validateInput(toInput(e)).values === null);
  if (bad) return { ok: false, error: `${bad.name}의 반복·세트·휴식·템포·무게 값을 확인해 주세요.` };
  return { ok: true, name: v.name };
}

/** 새 루틴을 만든다. 이름·운동·값 검사를 하고 한도(20개)를 넘으면 거절한다. */
export function createRoutine(name: string, exercises: readonly Exercise[]): RoutinesResult {
  const v = checkRoutineInput(name, exercises);
  if (!v.ok) return { ok: false, reason: "invalid", message: v.error };
  return update((list) => {
    if (list.length >= MY_ROUTINE_LIMITS.routines) {
      return { ok: false, reason: "limit", message: ROUTINE_MESSAGES.limit };
    }
    return [...list, { id: newRoutineId(), name: v.name, exercises: exercises.map((e) => ({ ...e })) }];
  });
}

/** 루틴을 수정한다(이름·운동 구성·순서·운동별 값). 없는 루틴이면 거절하고 다른 루틴은 건드리지 않는다. */
export function updateRoutine(id: string, name: string, exercises: readonly Exercise[]): RoutinesResult {
  const v = checkRoutineInput(name, exercises);
  if (!v.ok) return { ok: false, reason: "invalid", message: v.error };
  return update((list) => {
    if (!list.some((r) => r.id === id)) return { ok: false, reason: "missing", message: ROUTINE_MESSAGES.missing };
    return list.map((r) => (r.id === id ? { id, name: v.name, exercises: exercises.map((e) => ({ ...e })) } : r));
  });
}

/** 이름을 바꾼다 */
export function renameRoutine(id: string, name: string): RoutinesResult {
  const v = validateRoutineName(name);
  if (!v.ok) return { ok: false, reason: "invalid", message: v.error };
  return update((list) => {
    if (!list.some((r) => r.id === id)) return { ok: false, reason: "missing", message: ROUTINE_MESSAGES.missing };
    return list.map((r) => (r.id === id ? { ...r, name: v.name } : r));
  });
}

/** 지운다. 이미 저장된 운동 기록(과거 기록)은 건드리지 않는다. */
export function deleteRoutine(id: string): RoutinesResult {
  return update((list) => {
    if (!list.some((r) => r.id === id)) return { ok: false, reason: "missing", message: ROUTINE_MESSAGES.missing };
    return list.filter((r) => r.id !== id);
  });
}
