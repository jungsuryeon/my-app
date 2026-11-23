// 홈 설정: 기본 루틴(상체·하체 데이)을 보여 줄지 (PRD §6)
// 이 폰의 localStorage(`reptimer:prefs`)에만 저장한다. 데이터 초기화 때 함께 지워진다.

import { STORAGE_KEYS, readItem, writeItem } from "./storage";

/** show = 기본 루틴을 보여 준다 / hide = 숨긴다 */
export type DefaultRoutines = "show" | "hide";
export type Prefs = { defaultRoutines: DefaultRoutines };

export function isPrefs(v: unknown): v is Prefs {
  return (
    typeof v === "object" &&
    v !== null &&
    ((v as { defaultRoutines: unknown }).defaultRoutines === "show" ||
      (v as { defaultRoutines: unknown }).defaultRoutines === "hide")
  );
}

export type PrefsState =
  | { kind: "none" } // 아직 정한 적 없음 → 처음 한 번 묻는다
  | { kind: "set"; prefs: Prefs }
  | { kind: "unreadable" }; // 저장소를 읽을 수 없거나 값이 깨짐 → 묻지 않고 기본 루틴을 보여 준다

/** 저장된 설정을 읽는다. 화면이 그려진 뒤에만 부른다. */
export function loadPrefs(): PrefsState {
  const r = readItem<Prefs>(STORAGE_KEYS.prefs, isPrefs);
  if (!r.ok || r.invalid) return { kind: "unreadable" };
  if (r.value === null) return { kind: "none" };
  return { kind: "set", prefs: r.value };
}

/** 설정을 저장한다. 실패하면 false */
export function savePrefs(prefs: Prefs): boolean {
  return writeItem<Prefs>(STORAGE_KEYS.prefs, prefs).ok;
}

/** 기본 루틴을 보여 줄지: 숨기기로 정했을 때만 숨긴다(안 정했거나 읽을 수 없으면 보여 준다) */
export function showDefaultRoutines(state: PrefsState | null): boolean {
  return !(state?.kind === "set" && state.prefs.defaultRoutines === "hide");
}
