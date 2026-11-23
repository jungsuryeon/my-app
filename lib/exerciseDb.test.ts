import { describe, expect, it } from "vitest";
import { isExerciseDbId, isSafeGifUrl, lookupGifUrl } from "./exerciseDb";

const okBody = (id: string, gifUrl: string) => ({ success: true, data: { exerciseId: id, gifUrl } });
const fakeFetch = (res: Partial<Response> & { json?: () => Promise<unknown> }) =>
  (async () => res as Response) as unknown as typeof fetch;

describe("GIF 주소 검사", () => {
  it("ExerciseDB 미디어의 https .gif만 통과", () => {
    expect(isSafeGifUrl("https://static.exercisedb.dev/media/DOoWcnA.gif")).toBe(true);
    expect(isSafeGifUrl("http://static.exercisedb.dev/media/a.gif")).toBe(false);
    expect(isSafeGifUrl("https://evil.example.com/media/a.gif")).toBe(false);
    expect(isSafeGifUrl("https://static.exercisedb.dev.evil.com/a.gif")).toBe(false);
    expect(isSafeGifUrl("https://static.exercisedb.dev/media/a.html")).toBe(false);
    expect(isSafeGifUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeGifUrl(null)).toBe(false);
  });

  it("ExerciseDB ID 형식", () => {
    expect(isExerciseDbId("DOoWcnA")).toBe(true);
    expect(isExerciseDbId("../etc")).toBe(false);
    expect(isExerciseDbId("DOoWcnA/x")).toBe(false);
    expect(isExerciseDbId(5)).toBe(false);
  });
});

describe("GIF 주소 조회", () => {
  const url = "https://static.exercisedb.dev/media/DOoWcnA.gif";

  it("정상 응답이면 주소를 돌려준다", async () => {
    const f = fakeFetch({ ok: true, json: async () => okBody("DOoWcnA", url) });
    expect(await lookupGifUrl("DOoWcnA", f)).toEqual({ ok: true, gifUrl: url });
  });

  it("맞는 GIF가 없는 운동(null)은 조회하지 않고 no-gif", async () => {
    let called = false;
    const f = (async () => {
      called = true;
      return {} as Response;
    }) as unknown as typeof fetch;
    expect(await lookupGifUrl(null, f)).toEqual({ ok: false, reason: "no-gif" });
    expect(called).toBe(false);
  });

  it("서버 오류·네트워크 실패는 unavailable", async () => {
    expect(await lookupGifUrl("DOoWcnA", fakeFetch({ ok: false }))).toEqual({ ok: false, reason: "unavailable" });
    const boom = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await lookupGifUrl("DOoWcnA", boom)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("다른 운동의 응답·이상한 주소·깨진 JSON은 bad-response", async () => {
    const other = fakeFetch({ ok: true, json: async () => okBody("XXXXXXX", url) });
    expect(await lookupGifUrl("DOoWcnA", other)).toEqual({ ok: false, reason: "bad-response" });
    const evil = fakeFetch({ ok: true, json: async () => okBody("DOoWcnA", "https://evil.example.com/a.gif") });
    expect(await lookupGifUrl("DOoWcnA", evil)).toEqual({ ok: false, reason: "bad-response" });
    const empty = fakeFetch({ ok: true, json: async () => ({}) });
    expect(await lookupGifUrl("DOoWcnA", empty)).toEqual({ ok: false, reason: "bad-response" });
    expect(await lookupGifUrl("bad id!", empty)).toEqual({ ok: false, reason: "bad-response" });
  });
});
