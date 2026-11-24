import { describe, expect, it } from "vitest";
import {
  BEEP_SPECS,
  createBeeper,
  createSpeaker,
  pickKoreanVoice,
  waitForVoices,
  type AudioContextLike,
  type GainLike,
  type OscillatorLike,
  type SynthLike,
  type UtteranceLike,
  type VoiceLike,
} from "./audio";

/** 호출을 기록만 하는 가짜 오디오 */
function fakeCtx(state = "running", currentTime = 10) {
  const oscs: (OscillatorLike & { startedAt?: number; stoppedAt?: number })[] = [];
  const gains: (GainLike & { events: [string, number, number][] })[] = [];
  const ctx: AudioContextLike = {
    currentTime,
    state,
    destination: {},
    createOscillator() {
      const o = {
        type: "",
        frequency: { value: 0 },
        connect: () => {},
        start(t: number) {
          o.startedAt = t;
        },
        stop(t: number) {
          o.stoppedAt = t;
        },
      } as OscillatorLike & { startedAt?: number; stoppedAt?: number };
      oscs.push(o);
      return o;
    },
    createGain() {
      const events: [string, number, number][] = [];
      const g = {
        events,
        connect: () => {},
        gain: {
          value: 1,
          setValueAtTime: (v: number, t: number) => events.push(["set", v, t]),
          linearRampToValueAtTime: (v: number, t: number) => events.push(["ramp", v, t]),
        },
      } as GainLike & { events: [string, number, number][] };
      gains.push(g);
      return g;
    },
  };
  return { ctx, oscs, gains };
}

describe("비프음", () => {
  it("반복 비프는 짧은 높은 소리, 세트 완료는 더 길고 낮은 소리", () => {
    expect(BEEP_SPECS.setDone.durationSec).toBeGreaterThan(BEEP_SPECS.rep.durationSec * 3);
    expect(BEEP_SPECS.setDone.freq).toBeLessThan(BEEP_SPECS.rep.freq);
  });

  it("지금 시각에 주파수·길이대로 소리를 예약한다", () => {
    const { ctx, oscs } = fakeCtx("running", 10);
    expect(createBeeper(ctx)("rep")).toBe(true);
    expect(oscs).toHaveLength(1);
    expect(oscs[0].frequency.value).toBe(BEEP_SPECS.rep.freq);
    expect(oscs[0].startedAt).toBe(10);
    expect(oscs[0].stoppedAt).toBeCloseTo(10 + BEEP_SPECS.rep.durationSec + 0.02);
  });

  it("긴 비프(세트 완료)는 길이만큼 이어진다", () => {
    const { ctx, oscs } = fakeCtx();
    createBeeper(ctx)("setDone");
    expect(oscs[0].frequency.value).toBe(BEEP_SPECS.setDone.freq);
    expect((oscs[0].stoppedAt ?? 0) - (oscs[0].startedAt ?? 0)).toBeGreaterThan(0.7);
  });

  it("볼륨은 0에서 올라갔다가 0으로 내려온다(시작·끝 잡음 방지)", () => {
    const { ctx, gains } = fakeCtx("running", 5);
    createBeeper(ctx)("rep");
    const ev = gains[0].events;
    expect(ev[0]).toEqual(["set", 0, 5]);
    expect(ev[1][0]).toBe("ramp");
    expect(ev[1][1]).toBe(BEEP_SPECS.rep.volume);
    const last = ev[ev.length - 1];
    expect(last[1]).toBe(0);
    expect(last[2]).toBeCloseTo(5 + BEEP_SPECS.rep.durationSec);
  });

  it("미래 시각을 주면 그 시각에 예약하고, 과거 시각이면 지금으로 당긴다", () => {
    const { ctx, oscs } = fakeCtx("running", 10);
    const beep = createBeeper(ctx);
    beep("countdown", 12.5);
    beep("countdown", 3);
    expect(oscs[0].startedAt).toBe(12.5);
    expect(oscs[1].startedAt).toBe(10);
  });

  it("오디오가 닫혀 있으면 소리를 내지 않고 false", () => {
    const { ctx, oscs } = fakeCtx("closed");
    expect(createBeeper(ctx)("rep")).toBe(false);
    expect(oscs).toHaveLength(0);
  });
});

describe("한국어 음성 고르기", () => {
  const v = (lang: string, name: string, localService = true) => ({ lang, name, localService });

  it("한국어 음성이 없으면 null", () => {
    expect(pickKoreanVoice([v("en-US", "Samantha"), v("ja-JP", "Kyoko")])).toBeNull();
    expect(pickKoreanVoice([])).toBeNull();
  });

  it("ko-KR을 우선하고 ko_KR 같은 표기도 인정한다", () => {
    expect(pickKoreanVoice([v("en-US", "A"), v("ko-KR", "Yuna")])?.name).toBe("Yuna");
    expect(pickKoreanVoice([v("ko_KR", "Android")])?.name).toBe("Android");
  });

  it("같은 한국어면 기기 안에 설치된 음성을 우선한다", () => {
    expect(
      pickKoreanVoice([v("ko-KR", "Online", false), v("ko-KR", "Local", true)])?.name,
    ).toBe("Local");
  });
});

/** 가짜 음성 합성기 */
function fakeSynth(initial: VoiceLike[]) {
  let voices = initial;
  const listeners = new Set<() => void>();
  const spoken: UtteranceLike[] = [];
  let cancels = 0;
  const synth: SynthLike = {
    getVoices: () => voices,
    speak: (u) => spoken.push(u as unknown as UtteranceLike),
    cancel: () => {
      cancels++;
    },
    addEventListener: (_t, cb) => listeners.add(cb),
    removeEventListener: (_t, cb) => listeners.delete(cb),
  };
  return {
    synth,
    spoken,
    cancelCount: () => cancels,
    setVoices(v: VoiceLike[]) {
      voices = v;
      listeners.forEach((cb) => cb());
    },
    listenerCount: () => listeners.size,
  };
}
const mk = (text: string) => ({ text, lang: "", voice: null, rate: 0, volume: 0 }) as UtteranceLike;

describe("음성 목록 기다리기", () => {
  it("이미 목록이 있으면 바로 돌려준다", async () => {
    const f = fakeSynth([{ lang: "ko-KR", name: "Yuna" }]);
    expect(await waitForVoices(f.synth)).toHaveLength(1);
  });

  it("목록이 늦게 채워지면 변경 알림을 받아 돌려준다", async () => {
    const f = fakeSynth([]);
    const p = waitForVoices(f.synth, 5000);
    f.setVoices([{ lang: "ko-KR", name: "Yuna" }]);
    expect(await p).toHaveLength(1);
    expect(f.listenerCount()).toBe(0); // 기다림이 끝나면 알림 구독을 해제한다
  });

  it("끝내 안 채워지면 시간 제한 뒤 빈 목록으로 끝낸다", async () => {
    const f = fakeSynth([]);
    expect(await waitForVoices(f.synth, 20)).toEqual([]);
    expect(f.listenerCount()).toBe(0);
  });
});

describe("음성 재생기", () => {
  it("한국어 음성이 준비되면 ko-KR로 말하고, 말하기 전에 항상 이전 음성을 취소한다", async () => {
    const f = fakeSynth([{ lang: "ko-KR", name: "Yuna" }]);
    const sp = createSpeaker({ synth: f.synth, makeUtterance: mk });
    expect(await sp.prepare()).toBe(true);
    expect(sp.speak("운동을 시작합니다.")).toBe(true);
    expect(sp.speak("1번째 세트 완료. 30초 휴식합니다.")).toBe(true);
    expect(f.cancelCount()).toBe(2); // 말할 때마다 먼저 취소
    expect(f.spoken).toHaveLength(2);
    expect(f.spoken[0].lang).toBe("ko-KR");
    expect((f.spoken[0].voice as VoiceLike).name).toBe("Yuna");
  });

  it("한국어 음성이 없으면 말하지 않고 false(호출 쪽이 비프로 대체)", async () => {
    const f = fakeSynth([{ lang: "en-US", name: "Samantha" }]);
    const sp = createSpeaker({ synth: f.synth, makeUtterance: mk });
    expect(await sp.prepare(10)).toBe(false);
    expect(sp.speak("안녕")).toBe(false);
    expect(f.spoken).toHaveLength(0);
  });

  it("준비 전에도 목록에 한국어 음성이 이미 있으면 말한다(목록을 말하는 순간에 다시 확인)", () => {
    const f = fakeSynth([{ lang: "ko-KR", name: "Yuna" }]);
    const sp = createSpeaker({ synth: f.synth, makeUtterance: mk });
    expect(sp.hasVoice()).toBe(true);
    expect(sp.speak("안녕")).toBe(true);
  });

  it("처음 기다리는 시간 안에 목록이 안 채워져도, 나중에 채워지면 그때부터 음성으로 말한다", async () => {
    const f = fakeSynth([]);
    const sp = createSpeaker({ synth: f.synth, makeUtterance: mk });
    expect(await sp.prepare(10)).toBe(false); // 시간 안에는 못 찾음 → 비프로 대체
    expect(sp.speak("안녕")).toBe(false);
    f.setVoices([{ lang: "ko-KR", name: "Yuna" }]); // 나중에 목록이 채워짐
    expect(sp.speak("안녕")).toBe(true);
    expect(f.spoken).toHaveLength(1);
    expect((f.spoken[0].voice as VoiceLike).name).toBe("Yuna");
  });

  it("한국어 음성이 끝내 없으면 계속 false(비프 대체)", () => {
    const f = fakeSynth([{ lang: "en-US", name: "Samantha" }]);
    const sp = createSpeaker({ synth: f.synth, makeUtterance: mk });
    expect(sp.speak("안녕")).toBe(false);
    expect(sp.hasVoice()).toBe(false);
  });

  it("cancel은 재생 중인 음성을 취소한다", async () => {
    const f = fakeSynth([{ lang: "ko-KR", name: "Yuna" }]);
    const sp = createSpeaker({ synth: f.synth, makeUtterance: mk });
    await sp.prepare();
    sp.cancel();
    expect(f.cancelCount()).toBe(1);
  });
});
