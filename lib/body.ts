// 체중(칼로리 계산용, 선택 입력) (PRD §6·§7)
// 이 폰의 localStorage(`reptimer:body`)에만 저장하고 서버로 보내지 않는다. 건강 정보라 민감하게 다룬다.

import { STORAGE_KEYS, readItem, writeItem } from "./storage";

export type Body = { weightKg: number | null };

export const WEIGHT_LIMITS = { min: 20, max: 300 } as const;

export function isBody(v: unknown): v is Body {
  if (typeof v !== "object" || v === null) return false;
  const w = (v as { weightKg: unknown }).weightKg;
  return w === null || (typeof w === "number" && Number.isFinite(w) && w >= WEIGHT_LIMITS.min && w <= WEIGHT_LIMITS.max);
}

/** 입력한 체중 글자를 검사한다. 20~300kg, 소수 한 자리까지 */
export function validateWeight(
  input: string,
): { ok: true; weightKg: number } | { ok: false; error: string } {
  const t = input.trim().replace(/kg$/i, "").trim();
  const msg = `체중은 ${WEIGHT_LIMITS.min}~${WEIGHT_LIMITS.max}kg 사이로 입력해 주세요(소수 한 자리까지).`;
  if (t === "") return { ok: false, error: "체중을 입력해 주세요." };
  if (!/^\d+(\.\d)?$/.test(t)) return { ok: false, error: msg };
  const n = Number(t);
  if (n < WEIGHT_LIMITS.min || n > WEIGHT_LIMITS.max) return { ok: false, error: msg };
  return { ok: true, weightKg: n };
}

export type BodyState =
  | { kind: "none" } // 입력한 적 없음
  | { kind: "set"; weightKg: number | null }
  | { kind: "unreadable" }; // 읽을 수 없거나 값이 깨짐 → 체중 없는 것으로 보고 칼로리를 계산하지 않는다

/** 저장된 체중을 읽는다. 화면이 그려진 뒤(또는 이벤트 처리 안)에만 부른다. */
export function loadBody(): BodyState {
  const r = readItem<Body>(STORAGE_KEYS.body, isBody);
  if (!r.ok || r.invalid) return { kind: "unreadable" };
  if (r.value === null) return { kind: "none" };
  return { kind: "set", weightKg: r.value.weightKg };
}

/** 체중을 저장한다(null = 지우기). 실패하면 false */
export function saveBody(weightKg: number | null): boolean {
  return writeItem<Body>(STORAGE_KEYS.body, { weightKg }).ok;
}

/** 계산에 쓸 체중(kg). 없거나 읽을 수 없으면 null */
export function weightOf(state: BodyState | null): number | null {
  return state?.kind === "set" ? state.weightKg : null;
}
