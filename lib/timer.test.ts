import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createClock,
  createTicker,
  elapsedMs,
  startClock,
  stopClock,
  type Ticker,
} from "./timer";

describe("시계 (시작 시각 + 누적 시간)", () => {
  it("돌기 전에는 0초", () => {
    expect(elapsedMs(createClock(), 5000)).toBe(0);
  });

  it("시작한 뒤 흐른 시간만큼 계산한다", () => {
    const c = startClock(createClock(), 1000);
    expect(elapsedMs(c, 4000)).toBe(3000);
  });

  it("멈춰 있던 시간은 들어가지 않고, 이어하면 쌓인 시간부터 센다", () => {
    let c = startClock(createClock(), 0);
    c = stopClock(c, 10_000); // 10초 운동 후 일시정지
    expect(elapsedMs(c, 99_000)).toBe(10_000); // 멈춘 동안 시간은 안 흐름
    c = startClock(c, 50_000); // 40초 뒤 이어하기 (새 시작 시각)
    expect(elapsedMs(c, 55_000)).toBe(15_000);
  });

  it("이미 돌고 있을 때 start, 멈춰 있을 때 stop은 값을 바꾸지 않는다", () => {
    const running = startClock(createClock(), 100);
    expect(startClock(running, 999)).toBe(running);
    const stopped = createClock(2000);
    expect(stopClock(stopped, 999)).toBe(stopped);
  });

  it("시각이 거꾸로 가도 음수가 되지 않는다", () => {
    const c = startClock(createClock(), 1000);
    expect(elapsedMs(c, 500)).toBe(0);
  });

  it("누적 값으로 시작할 수 있다(복원용)", () => {
    const c = startClock(createClock(7000), 100);
    expect(elapsedMs(c, 600)).toBe(7500);
  });
});

describe("틱 (주기적 확인)", () => {
  let t = 0;
  const now = () => t;
  const made: Ticker[] = [];

  /** 가짜 시계를 intervalMs씩 나눠 앞으로 보낸다 */
  function advance(ms: number, step = 250) {
    for (let done = 0; done < ms; done += step) {
      t += step;
      vi.advanceTimersByTime(step);
    }
  }
  function make(onTick: (n: number) => void, onGap?: (g: number) => void) {
    const tk = createTicker(onTick, { now, onGap });
    made.push(tk);
    return tk;
  }

  beforeEach(() => {
    t = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    made.splice(0).forEach((tk) => tk.stop());
    vi.useRealTimers();
  });

  it("250ms마다 현재 시각과 함께 틱을 부른다", () => {
    const seen: number[] = [];
    make((n) => seen.push(n)).start();
    advance(1000);
    expect(seen).toEqual([250, 500, 750, 1000]);
  });

  it("stop 하면 더 이상 부르지 않는다", () => {
    const onTick = vi.fn();
    const tk = make(onTick);
    tk.start();
    advance(500);
    tk.stop();
    advance(1000);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(tk.isRunning()).toBe(false);
  });

  it("start를 두 번 불러도 틱이 두 배로 늘지 않는다", () => {
    const onTick = vi.fn();
    const tk = make(onTick);
    tk.start();
    tk.start();
    advance(1000);
    expect(onTick).toHaveBeenCalledTimes(4);
  });

  it("개발 모드처럼 effect가 두 번 실행(시작→정리→시작)돼도 하나만 돈다", () => {
    const onTick = vi.fn();
    const run = () => {
      const tk = make(onTick);
      tk.start();
      return tk.stop; // useEffect의 정리 함수
    };
    const cleanup1 = run();
    cleanup1();
    run();
    advance(1000);
    expect(onTick).toHaveBeenCalledTimes(4);
  });

  it("다른 틱을 만들어 시작하면 앞의 것은 멈춘다(앱 전체에서 하나만)", () => {
    const a = vi.fn();
    const b = vi.fn();
    const ta = make(a);
    const tb = make(b);
    ta.start();
    advance(500);
    tb.start();
    advance(500);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);
    expect(ta.isRunning()).toBe(false);
    expect(tb.isRunning()).toBe(true);
  });

  it("틱이 2초 이상 끊기면 onGap을 부르고 그 틱의 onTick은 부르지 않는다", () => {
    const onTick = vi.fn();
    const onGap = vi.fn();
    make(onTick, onGap).start();
    advance(500); // 정상 2번
    t += 3000; // 화면이 꺼졌다 켜진 것처럼 시각만 3초 점프
    advance(250); // 다음 틱 1번
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(onGap).toHaveBeenCalledTimes(1);
    expect(onGap.mock.calls[0][0]).toBeGreaterThanOrEqual(2000);
    advance(250); // 그 다음 틱은 다시 정상
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it("틱이 몇 번 빠져도 경과 시간은 시각으로 계산하므로 틀어지지 않는다", () => {
    let clock = startClock(createClock(), t);
    const tk = make(() => {});
    tk.start();
    advance(30_000); // 30초 휴식
    // 틱 횟수(120번)가 아니라 시각 차이로 계산
    expect(elapsedMs(clock, now())).toBe(30_000);
    clock = stopClock(clock, now());
    expect(elapsedMs(clock, now() + 10_000)).toBe(30_000);
  });
});
