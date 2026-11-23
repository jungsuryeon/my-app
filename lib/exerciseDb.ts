// ExerciseDB 무료 호스트에서 운동 GIF 주소를 조회한다 (확장 STEP 4)
// - 검증된 운동의 ExerciseDB ID로만 조회한다(검색 결과를 그대로 쓰지 않는다).
// - 약관상 응답을 저장하지 않고 매번 실시간으로 조회한다. GIF 주소는 매주 바뀔 수 있다.
// - 받은 주소가 ExerciseDB의 https 미디어 주소인지 확인한 것만 화면에 내보낸다.

export const EXERCISEDB_API = "https://oss.exercisedb.dev/api/v1";
export const EXERCISEDB_MEDIA_HOST = "static.exercisedb.dev";

export type GifResult =
  | { ok: true; gifUrl: string }
  | { ok: false; reason: "no-gif" | "unavailable" | "bad-response" };

/** 화면에 내보내도 되는 GIF 주소인가: https + ExerciseDB 미디어 주소 + .gif */
export function isSafeGifUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === EXERCISEDB_MEDIA_HOST && u.pathname.endsWith(".gif");
  } catch {
    return false;
  }
}

/** ExerciseDB ID가 형식에 맞는가(주소에 끼워 넣기 전에 검사) */
export function isExerciseDbId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9]{7}$/.test(id);
}

/**
 * 운동 하나의 GIF 주소를 조회한다. fetchImpl은 시험 때 가짜를 넣기 위함.
 * 네트워크 실패·시간 초과·이상한 응답은 모두 실패로 돌려주고, 던지지 않는다.
 */
export async function lookupGifUrl(
  exerciseDbId: string | null,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<GifResult> {
  if (exerciseDbId === null) return { ok: false, reason: "no-gif" };
  if (!isExerciseDbId(exerciseDbId)) return { ok: false, reason: "bad-response" };
  try {
    const res = await fetchImpl(`${EXERCISEDB_API}/exercises/${exerciseDbId}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const body: unknown = await res.json();
    const data = (body as { data?: { exerciseId?: unknown; gifUrl?: unknown } } | null)?.data;
    if (!data || data.exerciseId !== exerciseDbId || !isSafeGifUrl(data.gifUrl)) {
      return { ok: false, reason: "bad-response" };
    }
    return { ok: true, gifUrl: data.gifUrl };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
