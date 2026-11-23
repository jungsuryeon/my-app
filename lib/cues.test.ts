import { describe, expect, it } from "vitest";
import {
  MIXED_MODE,
  PHRASES,
  dueCues,
  exerciseDonePhrase,
  restCountdownCues,
  setDonePhrase,
} from "./cues";

describe("휴식 마지막 3·2·1초 비프", () => {
  it("휴식 30초면 27·28·29초 시점에 카운트다운 비프 3번(남은 3·2·1초)", () => {
    const cues = restCountdownCues(30, 0, 0);
    expect(cues.map((c) => c.atMs)).toEqual([27_000, 28_000, 29_000]);
    expect(cues.every((c) => c.kind === "countdown")).toBe(true);
  });

  it("안내 ID에 운동·세트·번호가 들어가 다른 세트의 안내와 겹치지 않는다", () => {
    const a = restCountdownCues(30, 0, 0).map((c) => c.id);
    const b = restCountdownCues(30, 0, 1).map((c) => c.id);
    const c = restCountdownCues(30, 1, 0).map((c2) => c2.id);
    expect(new Set([...a, ...b, ...c]).size).toBe(9);
    expect(a).toEqual(["REST-0-0-3", "REST-0-0-2", "REST-0-0-1"]);
  });

  it("휴식 마지막 비프(남은 1초)가 휴식이 끝나기 1초 전이다", () => {
    for (const rest of [10, 30, 90, 600]) {
      const last = restCountdownCues(rest, 0, 0).at(-1)!;
      expect(rest * 1000 - last.atMs).toBe(1000);
    }
  });

  it("휴식이 3초보다 짧아도 시각이 음수가 되지 않는다", () => {
    const cues = restCountdownCues(2, 0, 0);
    expect(cues.map((c) => c.atMs)).toEqual([0, 0, 1000]);
  });
});

describe("지금 낼 안내 고르기", () => {
  const cues = restCountdownCues(30, 0, 0);

  it("예정 시각 전에는 아무것도 내지 않는다", () => {
    expect(dueCues(cues, 26_999, new Set())).toEqual([]);
  });

  it("예정 시각이 되면 해당 안내를 낸다", () => {
    expect(dueCues(cues, 27_000, new Set()).map((c) => c.id)).toEqual(["REST-0-0-3"]);
    expect(dueCues(cues, 28_100, new Set()).map((c) => c.id)).toEqual([
      "REST-0-0-3",
      "REST-0-0-2",
    ]);
  });

  it("이미 낸 ID는 다시 내지 않는다", () => {
    const emitted = new Set(["REST-0-0-3"]);
    expect(dueCues(cues, 28_100, emitted).map((c) => c.id)).toEqual(["REST-0-0-2"]);
    expect(dueCues(cues, 30_000, new Set(cues.map((c) => c.id)))).toEqual([]);
  });

  it("틱이 늦어 여러 개가 한꺼번에 밀려도 시각 순으로 돌려준다", () => {
    expect(dueCues(cues, 29_500, new Set()).map((c) => c.id)).toEqual([
      "REST-0-0-3",
      "REST-0-0-2",
      "REST-0-0-1",
    ]);
  });
});

describe("음성 문구와 혼합 모드", () => {
  it("세트 완료와 휴식 시작은 한 문장으로 합쳐 말한다", () => {
    expect(setDonePhrase(2, 30)).toBe("2번째 세트 완료. 30초 휴식합니다.");
  });

  it("운동 완료 문구는 다음 운동 이름을 말하고 휴식 문구는 없다", () => {
    const p = exerciseDonePhrase("랫풀다운", "체스트프레스");
    expect(p).toBe("랫풀다운 완료. 다음 운동은 체스트프레스입니다. 준비되면 시작을 누르세요.");
    expect(p).not.toContain("휴식");
  });

  it("시작·루틴 완료 문구", () => {
    expect(PHRASES.routineDone).toBe("모든 운동을 완료했습니다.");
  });

  it("혼합 모드: 휴식 카운트다운은 비프, 반복 숫자·세트 완료·운동 전환·시작·종료는 음성", () => {
    expect(MIXED_MODE.restCountdown).toBe("beep");
    expect(MIXED_MODE.countdown).toBe("beep");
    for (const e of ["rep", "setDone", "exerciseDone", "routineDone"] as const) {
      expect(MIXED_MODE[e]).toBe("voice");
    }
  });
});
