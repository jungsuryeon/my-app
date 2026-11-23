// 닉네임 (PLAN 작업 22, PRD 이용 흐름 1: 닉네임 입력은 선택, 입력하면 홈 인사말에 표시)
// 닉네임은 이 기기의 localStorage에만 저장하고 서버로 보내지 않는다.

import { STORAGE_KEYS, readItem, writeItem } from "./storage";

/** 저장되는 모양. nickname이 null이면 "건너뛰기"를 골라서 다시 묻지 않는다는 뜻이다. */
export type Profile = { nickname: string | null };

/** 닉네임 최대 글자 수 */
export const NICKNAME_MAX = 12;

export function isProfile(v: unknown): v is Profile {
  return (
    typeof v === "object" &&
    v !== null &&
    "nickname" in v &&
    ((v as { nickname: unknown }).nickname === null ||
      typeof (v as { nickname: unknown }).nickname === "string")
  );
}

/**
 * 입력한 닉네임을 검사한다. 앞뒤 공백은 지우고 눈에 보이지 않는 제어 문자는 뺀다.
 * 비어 있거나 너무 길면 오류.
 */
export function validateNickname(
  input: string,
): { ok: true; nickname: string } | { ok: false; error: string } {
  const cleaned = input.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (cleaned === "") {
    return { ok: false, error: "닉네임을 입력하거나 건너뛰기를 눌러 주세요." };
  }
  if ([...cleaned].length > NICKNAME_MAX) {
    return { ok: false, error: `닉네임은 ${NICKNAME_MAX}글자까지 쓸 수 있어요.` };
  }
  return { ok: true, nickname: cleaned };
}

/** 홈 인사말: 닉네임이 있을 때만 */
export function greeting(nickname: string | null): string | null {
  return nickname ? `안녕하세요, ${nickname}님` : null;
}

export type ProfileState =
  | { kind: "none" } // 아직 정한 적 없음 → 입력 카드를 보여 준다
  | { kind: "set"; nickname: string | null } // 정했거나 건너뜀
  | { kind: "unreadable" }; // 저장소를 읽을 수 없거나 값이 깨짐

/** 저장된 닉네임을 읽는다. 화면이 그려진 뒤에만 부른다. */
export function loadProfile(): ProfileState {
  const r = readItem<Profile>(STORAGE_KEYS.profile, isProfile);
  if (!r.ok || r.invalid) return { kind: "unreadable" };
  if (r.value === null) return { kind: "none" };
  return { kind: "set", nickname: r.value.nickname };
}

/** 닉네임을 저장한다(null = 건너뛰기). 실패하면 false */
export function saveProfile(nickname: string | null): boolean {
  return writeItem<Profile>(STORAGE_KEYS.profile, { nickname }).ok;
}
