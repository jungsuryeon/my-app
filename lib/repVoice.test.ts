import { describe, expect, it } from "vitest";
import { countWord, setCues, countdownCues } from "./cues";
import { createSoundEngine, type SoundDeps } from "./sound";
import type { BeepKind, SpeakCallbacks } from "./audio";

function fake(opts: { speakOk?: boolean } = {}) {
  const log: string[] = [];
  let last: SpeakCallbacks = {};
  const deps: SoundDeps = {
    beep: (k: BeepKind) => {
      log.push(`beep:${k}`);
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

const cues = (reps = 4) =>
  setCues({ exerciseIndex: 0, setIndex: 0, reps, tempoSec: 1, finalPhrase: "세트 완료", restFollows: true });

describe("우리말 숫자", () => {
  it("1~50", () => {
    expect(countWord(1)).toBe("하나");
    expect(countWord(9)).toBe("아홉");
    expect(countWord(10)).toBe("열");
    expect(countWord(11)).toBe("열하나");
    expect(countWord(15)).toBe("열다섯");
    expect(countWord(20)).toBe("스물");
    expect(countWord(23)).toBe("스물셋");
    expect(countWord(40)).toBe("마흔");
    expect(countWord(50)).toBe("쉰");
  });
});

describe("반복 숫자 음성", () => {
  it("마지막 전 반복에는 숫자 음성이 붙고, 마지막은 세트 완료 음성", () => {
    const c = cues(3);
    expect(c.map((x) => x.countVoice)).toEqual(["하나", "둘", undefined]);
    expect(c[2].voice).toBe("세트 완료");
  });

  it("반복 시각에 숫자를 말한다(비프는 내지 않는다)", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(cues(), 1000, 1000);
    expect(f.log).toEqual(["speak:하나"]);
  });

  it("이전 숫자가 아직 재생 중이면 새 숫자로 바꾼다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(cues(), 1000, 1000);
    e.emit(cues(), 2000, 2000); // 하나 재생 중(끝 신호 없음)
    expect(f.log.filter((x) => x.startsWith("speak"))).toEqual(["speak:하나", "speak:둘"]);
    expect(f.log).not.toContain("beep:rep");
  });

  it("세트 완료·시작 음성이 재생 중이면 숫자를 내지 않는다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit([{ id: "V", voice: "안내 음성", atMs: 0 }], 0, 0); // 다른 음성 재생 중
    e.emit(cues(), 1000, 1000);
    expect(f.log).toEqual(["speak:안내 음성"]);
  });

  it("마지막 반복에서는 세트 완료음과 음성이 숫자를 대신한다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(cues(2), 1000, 1000); // 하나
    e.emit(cues(2), 2000, 2000); // 마지막: 세트 완료
    expect(f.log).toEqual(["speak:하나", "beep:setDone", "speak:세트 완료"]);
  });

  it("한국어 음성을 못 쓰면 반복 비프로 대체", () => {
    const f = fake({ speakOk: false });
    const e = createSoundEngine(f.deps);
    e.emit(cues(), 1000, 1000);
    expect(f.log).toEqual(["beep:rep"]);
  });

  it("재생 중 오류가 나면 반복 비프로 대체", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(cues(), 1000, 1000);
    f.cb().onError?.();
    expect(f.log).toEqual(["speak:하나", "beep:rep"]);
  });

  it("끝났다는 신호가 오면 다음 숫자는 정상 재생", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(cues(), 1000, 1000);
    f.cb().onEnd?.();
    e.emit(cues(), 2000, 2000);
    expect(f.log).toEqual(["speak:하나", "speak:둘"]);
  });

  it("카운트다운 비프가 나온 틱에는 숫자를 내지 않는다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit([...countdownCues(0, 0), ...cues()], 1000, 1000);
    expect(f.log.filter((x) => x.startsWith("speak"))).toEqual([]);
  });

  it("같은 반복 안내는 두 번 말하지 않는다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(cues(), 1000, 1000);
    f.cb().onEnd?.();
    e.emit(cues(), 1100, 1100);
    expect(f.log).toEqual(["speak:하나"]);
  });

  it("4초 넘게 끝 신호가 없어도 다음 숫자는 나온다", () => {
    const f = fake();
    const e = createSoundEngine(f.deps);
    e.emit(cues(8), 1000, 1000);
    e.emit(cues(8), 6000, 6000);
    expect(f.log.filter((x) => x.startsWith("speak")).length).toBeGreaterThanOrEqual(2);
  });
});
