import { describe, expect, it } from "vitest";
import {
  BEEP_SPECS,
  createBeeper,
  type AudioContextLike,
  type GainLike,
  type OscillatorLike,
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
