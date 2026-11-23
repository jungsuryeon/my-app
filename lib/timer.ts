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
  /** 틱이 maxGapMs 이상 끊겼을 때. 이 틱에서는 onTick을 부르지 않는다. 자동 PAUSED 처리는 작업 16에서 연결한다. */
  onGap?: (gapMs: number) => void;
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
        lastTickAt = t;
        if (gap >= maxGapMs) {
          options.onGap?.(gap);
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
