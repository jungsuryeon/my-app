// localStorage 읽기·쓰기 도구 (PLAN 작업 2, DESIGN §2.3)
// 규칙: 화면이 그려진 뒤(useEffect)에만 호출한다 / 모든 접근은 try/catch / 저장 값에는 버전을 둔다.
// 실패해도 앱이 멈추지 않도록 예외 대신 결과 객체를 돌려주고, 화면에서 사용자에게 알릴 수 있게 한다.

/** 저장 형식 버전. 형식을 바꾸면 올린다. 다른 버전의 값은 무시하고 초기값으로 시작한다. */
export const STORAGE_VERSION = 1;

/** 이 앱이 쓰는 키 접두사. 데이터 초기화는 이 접두사의 키만 지운다. */
const PREFIX = "reptimer:";

/** 앱에서 쓰는 키 목록 */
export const STORAGE_KEYS = {
  profile: "profile", // 닉네임
  snapshot: "snapshot", // 진행 중 운동 상태
  records: "records", // 저장된 운동 기록
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** 실제로 저장되는 모양: { v: 버전, data: 값 } */
type Envelope<T> = { v: number; data: T };

// ok: true 일 때 value가 null이면 "쓸 수 있는 값이 없음"이다.
// invalid가 true면 값이 저장돼 있었지만 깨졌거나 버전·모양이 달라 읽지 못한 것이므로,
// 호출하는 쪽은 사용자에게 알리고 그 키를 덮어쓰지 않아야 한다(기록을 조용히 잃지 않기 위함).
export type ReadResult<T> =
  | { ok: true; value: T | null; invalid: boolean }
  | { ok: false; error: string }; // 저장소에 접근할 수 없음

export type WriteResult = { ok: true } | { ok: false; error: string };

function fullKey(key: StorageKey): string {
  return PREFIX + key;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 값 하나 읽기. validate를 주면 모양이 맞지 않는 값은 null로 취급한다. */
export function readItem<T>(
  key: StorageKey,
  validate?: (data: unknown) => data is T,
): ReadResult<T> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(fullKey(key));
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
  if (raw === null) return { ok: true, value: null, invalid: false };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as Envelope<unknown>).v !== STORAGE_VERSION
    ) {
      return { ok: true, value: null, invalid: true };
    }
    const data = (parsed as Envelope<unknown>).data;
    if (validate && !validate(data)) {
      return { ok: true, value: null, invalid: true };
    }
    return { ok: true, value: data as T, invalid: false };
  } catch {
    // JSON이 깨진 경우: 쓸 수 있는 값은 없지만, 저장돼 있던 것이므로 invalid로 알린다
    return { ok: true, value: null, invalid: true };
  }
}

/** 값 하나 저장. 용량 초과·사생활 보호 모드 등으로 실패하면 ok: false. */
export function writeItem<T>(key: StorageKey, data: T): WriteResult {
  try {
    const envelope: Envelope<T> = { v: STORAGE_VERSION, data };
    window.localStorage.setItem(fullKey(key), JSON.stringify(envelope));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** 값 하나 지우기 */
export function removeItem(key: StorageKey): WriteResult {
  try {
    window.localStorage.removeItem(fullKey(key));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** 이 앱의 모든 데이터 지우기(데이터 초기화용). 다른 사이트·다른 키는 건드리지 않는다. */
export function clearAll(): WriteResult {
  try {
    const targets: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k !== null && k.startsWith(PREFIX)) targets.push(k);
    }
    targets.forEach((k) => window.localStorage.removeItem(k));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
