// 타이머 (PLAN 작업 4, DESIGN §2.2 시간 계산 규칙 · §3.5)
// 원칙: 시간은 setInterval 호출 횟수가 아니라 performance.now()로 잰 실제 경과 시간으로 계산한다.
// 틱(setInterval)은 "지금 시각을 확인하러 가는 알람"일 뿐이라, 틱이 늦거나 빠져도 계산한 시간은 틀어지지 않는다.

/** 현재 시각(밀리초). 경과 시간 계산용이라 시계 조정에 영향받지 않는 performance.now()를 쓴다. */
function defaultNow(): number {
  return performance.now();
}

// ───────────────────────── 시계(스톱워치) ─────────────────────────
// "시작 시각 + 누적 시간" 방식. 값은 바꾸지 않고 새 값을 돌려주므로 시험하기 쉽다.

export type Clock = {
  running: boolean;
  startedAt: number; // 돌아가는 중일 때, 이번 구간을 시작한 시각
  accumulatedMs: number; // 지금까지 멈추기 전에 쌓인 시간
};

/** 멈춰 있는 0초짜리 시계 */
export function createClock(accumulatedMs = 0): Clock {
  return { running: false, startedAt: 0, accumulatedMs };
}

/** 시계를 돌린다. 이미 돌고 있으면 그대로 둔다. 이어하기도 이것으로 한다(새 시작 시각을 잡고 쌓인 시간부터 이어 센다). */
export function startClock(clock: Clock, nowMs: number): Clock {
  if (clock.running) return clock;
  return { running: true, startedAt: nowMs, accumulatedMs: clock.accumulatedMs };
}

/** 시계를 멈춘다. 이번 구간의 시간을 누적에 더한다. 이미 멈춰 있으면 그대로 둔다. */
export function stopClock(clock: Clock, nowMs: number): Clock {
  if (!clock.running) return clock;
  return {
    running: false,
    startedAt: 0,
    accumulatedMs: clock.accumulatedMs + Math.max(0, nowMs - clock.startedAt),
  };
}

/** 지금까지 흐른 시간(밀리초). 멈춰 있는 동안의 시간은 들어가지 않는다. */
export function elapsedMs(clock: Clock, nowMs: number): number {
  if (!clock.running) return clock.accumulatedMs;
  return clock.accumulatedMs + Math.max(0, nowMs - clock.startedAt);
}

// ───────────────────────── 틱(주기적 확인) ─────────────────────────

export type TickerOptions = {
  /** 확인 간격(밀리초). 기본 250 (DESIGN §2.2) */
  intervalMs?: number;
  /** 이 시간 이상 틱이 끊기면 onGap을 부른다. 기본 2000 (PRD: 틱 2초 이상 끊김 → PAUSED) */
  maxGapMs?: number;
  /** 시각 공급 함수. 기본은 performance.now(). 시험에서 가짜 시각을 넣을 때 쓴다. */
  now?: () => number;
  /**
   * 틱이 maxGapMs 이상 끊겼을 때. 이 틱에서는 onTick을 부르지 않는다.
   * lastTickMs는 끊기기 전 마지막으로 정상이었던 시각이다. 자동 일시정지는 "지금"이 아니라
   * 이 시각에 멈춘 것으로 처리해야, 끊겨 있던(화면을 벗어난) 시간이 운동·휴식 시간에서 빠진다.
   */
  onGap?: (gapMs: number, lastTickMs: number) => void;
};

export type Ticker = {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
};

// 앱 전체에서 돌아가는 틱은 한 번에 하나만 (PRD: 타이머는 한 번에 하나만 실행)
let activeTicker: Ticker | null = null;

/**
 * 틱을 만든다. start()를 부르면 intervalMs마다 onTick(현재 시각)을 부른다.
 * - 이미 돌고 있을 때 start()를 또 부르면 이전 것을 먼저 멈춰 중복되지 않는다.
 * - 다른 틱이 돌고 있으면 그것을 먼저 멈춘다(앱 전체에서 하나만).
 * - React에서는 useEffect(() => { t.start(); return t.stop; }, []) 처럼 쓰면
 *   개발 모드에서 effect가 두 번 실행돼도 중복되지 않는다.
 */
export function createTicker(
  onTick: (nowMs: number) => void,
  options: TickerOptions = {},
): Ticker {
  const intervalMs = options.intervalMs ?? 250;
  const maxGapMs = options.maxGapMs ?? 2000;
  const now = options.now ?? defaultNow;

  let handle: ReturnType<typeof setInterval> | null = null;
  let lastTickAt = 0;

  const ticker: Ticker = {
    start() {
      // 내 것이든 남의 것이든 돌고 있는 틱을 먼저 멈춘다
      if (activeTicker) activeTicker.stop();
      lastTickAt = now();
      handle = setInterval(() => {
        const t = now();
        const gap = t - lastTickAt;
        const previous = lastTickAt;
        lastTickAt = t;
        if (gap >= maxGapMs) {
          options.onGap?.(gap, previous);
          return;
        }
        onTick(t);
      }, intervalMs);
      activeTicker = ticker;
    },
    stop() {
      if (handle !== null) {
        clearInterval(handle);
        handle = null;
      }
      if (activeTicker === ticker) activeTicker = null;
    },
    isRunning() {
      return handle !== null;
    },
  };
  return ticker;
}

// ───────────────────────── 카운트다운과 반복 세기 (PLAN 작업 6) ─────────────────────────
// 모두 "이 상태가 시작된 뒤 흐른 시간(elapsedMs)"만 받아 계산한다. 틱 횟수는 쓰지 않는다.

/** 운동 시작 전 카운트다운 길이: 3초 */
export const COUNTDOWN_MS = 3000;

/** 카운트다운이 끝났는가 */
export function isCountdownDone(elapsedMs: number): boolean {
  return elapsedMs >= COUNTDOWN_MS;
}

/** 카운트다운 남은 시간(ms). 0 아래로 내려가지 않는다. */
export function countdownRemainingMs(elapsedMs: number): number {
  return Math.max(0, COUNTDOWN_MS - elapsedMs);
}

/** 화면에 보여 줄 카운트다운 숫자: 3 → 2 → 1 (끝나면 0). 남은 시간을 올림해서 센다. */
export function countdownDisplay(elapsedMs: number): number {
  return Math.ceil(countdownRemainingMs(elapsedMs) / 1000);
}

// 부동소수점 오차로 정확히 n×템포 시각에 한 개가 모자라 보이는 일을 막는 아주 작은 여유(ms)
const EPS_MS = 1e-6;

/** n번째 반복이 끝나는 시각(EXERCISE 시작 후 ms) = n × 템포. 이 시각에 n번째 비프를 낸다. */
export function repTimeMs(n: number, tempoSec: number): number {
  return n * tempoSec * 1000;
}

/** 지금까지 센 반복 수. 목표 횟수를 넘지 않는다. (n번째 반복은 EXERCISE 시작 후 n×템포초에 끝난 것으로 본다) */
export function repsDone(elapsedMs: number, tempoSec: number, targetReps: number): number {
  if (elapsedMs <= 0) return 0;
  const n = Math.floor((elapsedMs + EPS_MS) / (tempoSec * 1000));
  return Math.min(targetReps, n);
}

/** 목표 반복에 도달했는가(= 세트 완료) */
export function isSetComplete(elapsedMs: number, tempoSec: number, targetReps: number): boolean {
  return repsDone(elapsedMs, tempoSec, targetReps) >= targetReps;
}

/** 한 세트의 운동 시간(ms) = 목표 반복 × 템포 */
export function setDurationMs(tempoSec: number, targetReps: number): number {
  return repTimeMs(targetReps, tempoSec);
}

/** 운동 중 남은 시간(ms). 일시정지 때 이 값을 저장한다. */
export function exerciseRemainingMs(
  elapsedMs: number,
  tempoSec: number,
  targetReps: number,
): number {
  return Math.max(0, setDurationMs(tempoSec, targetReps) - elapsedMs);
}

/** 휴식 남은 시간(ms) */
export function restRemainingMs(elapsedMs: number, restSec: number): number {
  return Math.max(0, restSec * 1000 - elapsedMs);
}

/** 휴식이 끝났는가 */
export function isRestDone(elapsedMs: number, restSec: number): boolean {
  return elapsedMs >= restSec * 1000;
}
