import { describe, expect, it } from "vitest";
import { countdownCues, restCountdownCues, setCues, type Cue } from "./cues";
import { createSoundEngine, type SoundDeps } from "./sound";
import type { BeepKind, SpeakCallbacks } from "./audio";

/** 소리 내기를 기록만 하는 가짜 */
function fake(opts: { speakOk?: boolean } = {}) {
  const log: string[] = [];
  let last: SpeakCallbacks = {};
  const deps: SoundDeps = {
    beep: (k: BeepKind, d?: number) => {
      log.push(d ? `beep:${k}+${d}` : `beep:${k}`);
      return true;
    },
    speak: (t, cb) => {
      if (opts.speakOk === false) return false;
      last = cb;
      log.push(`speak:${t}`);
      return true;
    },
    cancelSpeech: () => log.push("cancel"),
  };
  return { deps, log, cb: () => last };
}

// 이 파일은 "숫자 음성이 없는" 반복 안내(비프 경로)의 규칙을 시험한다. 숫자 음성은 repVoice.test.ts에서 시험한다.
const set = (reps = 3, restFollows = true) =>
  setCues({ exerciseIndex: 0, setIndex: 0, reps, tempoSec: 1, finalPhrase: "세트 완료", restFollows }).map(
    (c) => ({ ...c, countVoice: undefined }),
  );

describe("안내 만들기", () => {
  it("n번째 반복 비프는 n×템포초, 마지막 반복은 반복 비프 대신 세트 완료음+음성", () => {
    const c = set(3);
    expect(c.map((x) => x.atMs)).toEqual([1000, 2000, 3000]);
    expect(c.map((x) => x.kind)).toEqual(["rep", "rep", "setDone"]);
    expect(c[2].voice).toBe("세트 완료");
    expect(c[0].voice).toBeUndefined();
  });

  it("안내 ID는 상태-운동-세트-번호", () => {
    expect(set(2).map((x) => x.id)).toEqual(["EXERCISE-0-0-1", "EXERCISE-0-0-2"]);
  });

  it("휴식이 이어질 때만 음성 실패 대체(짧은 비프 2회)를 붙인다", () => {
    expect(set(2, true)[1].voiceFallback).toHaveLength(2);
    expect(set(2, false)[1].voiceFallback).toEqual([]);
  });

  it("시작 전 카운트다운은 삑·삑·삑 3번(0·1·2초)이고 음성은 없다", () => {
    const c = countdownCues(0, 0);
    expect(c.map((x) => x.atMs)).toEqual([0, 1000, 2000]);
    expect(c.every((x) => x.kind === "countdown" && x.voice === undefined)).toBe(true);
  });

  it("두 번째 운동의 안내 ID는 첫 운동과 겹치지 않는다", () => {
    const a = setCues({ exerciseIndex: 0, setIndex: 0, reps: 2, tempoSec: 1, finalPhrase: "x", restFollows: false });
    const b = setCues({ exerciseIndex: 1, setIndex: 0, reps: 2, tempoSec: 1, finalPhrase: "x", restFollows: false });
    expect(new Set([...a, ...b].map((c) => c.id)).size).toBe(4);
  });
});

describe("중복 방지", () => {
  it("같은 안내는 틱이 여러 번 와도 한 번만 낸다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    const cues = set(3);
    e.emit(cues, 1000, 1000);
    e.emit(cues, 1100, 1100);
    e.emit(cues, 1200, 1200);
    expect(f.log).toEqual(["beep:rep"]);
  });

  it("일시정지했다 이어하면 이미 낸 안내를 다시 내지 않는다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    const cues = set(3);
    e.emit(cues, 1000, 1000);
    e.pause();
    e.emit(cues, 1000, 5000);
    expect(f.log.filter((l) => l === "beep:rep")).toHaveLength(1);
  });

  it("reset하면 새 운동에서 같은 ID도 다시 낼 수 있다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(set(3), 1000, 1000);
    e.reset();
    e.emit(set(3), 1000, 9000);
    expect(f.log.filter((l) => l === "beep:rep")).toHaveLength(2);
  });
});

describe("오래된 안내 버리기", () => {
  it("예정 시각보다 0.5초 넘게 늦으면 내지 않고, 이후에도 다시 내지 않는다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    const cues = set(3);
    e.emit(cues, 1501, 1501); // 1000ms 안내가 501ms 늦음
    expect(f.log).toEqual([]);
    e.emit(cues, 1600, 1600);
    expect(f.log).toEqual([]);
  });

  it("정확히 0.5초 늦은 것까지는 낸다", () => {
    const f = fake();
    createSoundEngine(f.deps).emit(set(3), 1500, 1500);
    expect(f.log).toEqual(["beep:rep"]);
  });

  it("백그라운드에서 밀린 안내를 몰아서 내지 않는다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(set(10), 8000, 8000); // 1~7초 안내는 모두 늦었고 8초 안내만 제때
    expect(f.log).toEqual(["beep:rep"]);
  });
});

describe("마지막 반복: 세트 완료음과 음성", () => {
  it("긴 비프와 음성을 함께 내고 반복 비프는 내지 않는다", () => {
    const f = fake();
    createSoundEngine(f.deps).emit(set(3), 3000, 3000);
    expect(f.log).toEqual(["beep:setDone", "speak:세트 완료"]);
  });
});

describe("우선순위: 카운트다운 비프 > 음성 > 반복 비프", () => {
  it("음성이 재생되는 동안에는 반복 비프를 내지 않는다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    const cues: Cue[] = [
      { id: "V", voice: "안내", atMs: 1000 },
      { id: "R", kind: "rep", atMs: 2000 },
    ];
    e.emit(cues, 1000, 1000);
    expect(e.isVoicePlaying()).toBe(true);
    e.emit(cues, 2000, 2000);
    expect(f.log).toEqual(["speak:안내"]); // 반복 비프(R)는 음성 중이라 버려짐
  });

  it("음성이 끝났다는 신호가 오면 다음 반복 비프를 낸다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    const cues: Cue[] = [
      { id: "V", voice: "안내", atMs: 1000 },
      { id: "R", kind: "rep", atMs: 2000 },
    ];
    e.emit(cues, 1000, 1000);
    f.cb().onEnd?.();
    e.emit(cues, 2000, 2000);
    expect(f.log).toEqual(["speak:안내", "beep:rep"]);
  });

  it("음성이 4초를 넘기면 끝났다는 신호가 없어도 취소하고 반복 비프를 다시 낸다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    const cues: Cue[] = [
      { id: "V", voice: "안내", atMs: 0 },
      { id: "R", kind: "rep", atMs: 4500 },
    ];
    e.emit(cues, 0, 0);
    e.emit(cues, 4500, 4500); // 음성 시작 후 4.5초
    expect(f.log).toEqual(["speak:안내", "cancel", "beep:rep"]);
    expect(e.isVoicePlaying()).toBe(false);
  });

  it("카운트다운 비프가 음성과 겹치면 음성을 취소하고 비프를 낸다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    const cues: Cue[] = [
      { id: "V", voice: "세트 완료. 10초 휴식합니다.", atMs: 0 },
      ...restCountdownCues(5, 0, 0),
    ];
    e.emit(cues, 0, 0);
    e.emit(cues, 2000, 2000); // 휴식 5초 → 첫 카운트다운 비프(남은 3초)
    expect(f.log).toEqual(["speak:세트 완료. 10초 휴식합니다.", "cancel", "beep:countdown"]);
  });

  it("같은 틱에 카운트다운 비프와 음성이 함께 예정되면 비프만 낸다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(
      [
        { id: "C", kind: "countdown", atMs: 1000 },
        { id: "V", voice: "안내", atMs: 1000 },
      ],
      1000,
      1000,
    );
    expect(f.log).toEqual(["beep:countdown"]);
  });

  it("같은 틱에 카운트다운 비프와 반복 비프가 겹치면 카운트다운만 낸다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(
      [
        { id: "C", kind: "countdown", atMs: 1000 },
        { id: "R", kind: "rep", atMs: 1000 },
      ],
      1000,
      1000,
    );
    expect(f.log).toEqual(["beep:countdown"]);
  });
});

describe("일시정지와 음성 취소", () => {
  it("일시정지하면 재생 중인 음성을 취소한다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit([{ id: "V", voice: "안내", atMs: 0 }], 0, 0);
    e.pause();
    expect(f.log).toEqual(["speak:안내", "cancel"]);
    expect(e.isVoicePlaying()).toBe(false);
  });

  it("취소된 이전 음성의 늦은 끝남 신호가 새 음성을 끝내지 않는다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit([{ id: "A", voice: "첫째", atMs: 0 }], 0, 0);
    const oldCb = f.cb();
    e.emit([{ id: "B", voice: "둘째", atMs: 0 }], 0, 100);
    oldCb.onEnd?.(); // 첫째의 늦은 신호
    expect(e.isVoicePlaying()).toBe(true);
  });
});

describe("음성 실패 시 비프 대체", () => {
  it("한국어 음성이 없으면(speak 실패) 세트 완료는 긴 비프, 휴식 시작은 짧은 비프 2회", () => {
    const f = fake({ speakOk: false });
    createSoundEngine(f.deps).emit(set(3, true), 3000, 3000);
    expect(f.log).toEqual(["beep:setDone", "beep:rep+0.9", "beep:rep+1.15"]);
  });

  it("휴식이 없는 운동 완료는 긴 비프만 낸다", () => {
    const f = fake({ speakOk: false });
    createSoundEngine(f.deps).emit(set(3, false), 3000, 3000);
    expect(f.log).toEqual(["beep:setDone"]);
  });

  it("말하기 시작 뒤 재생 오류가 오면 그때 비프로 대체한다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(set(3, true), 3000, 3000);
    f.cb().onError?.();
    expect(f.log).toEqual(["beep:setDone", "speak:세트 완료", "beep:rep+0.9", "beep:rep+1.15"]);
    expect(e.isVoicePlaying()).toBe(false);
  });

  it("음성이 실패해도 이후 반복 비프는 계속 난다(타이머는 멈추지 않음)", () => {
    const f = fake({ speakOk: false });
    const e = createSoundEngine(f.deps);
    const cues: Cue[] = [
      { id: "V", voice: "안내", atMs: 0 },
      { id: "R", kind: "rep", atMs: 1000 },
    ];
    e.emit(cues, 0, 0);
    e.emit(cues, 1000, 1000);
    expect(f.log).toEqual(["beep:rep"]);
  });
});
