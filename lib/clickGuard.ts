// 버튼 연속 클릭 방지 (PLAN 작업 14, PRD M1: 같은 버튼을 0.5초 안에 다시 누르면 무시)
// 모든 버튼 동작은 이 처리기를 거친다. 버튼마다 key로 구분하므로 서로 다른 버튼은 영향을 주지 않는다.

export type ClickGuard = {
  /** 이 key의 마지막 실행 후 windowMs가 지났으면 fn을 실행하고 true, 아니면 무시하고 false */
  run: (key: string, fn: () => void) => boolean;
};

/**
 * @param now 시각 공급 함수. 기본은 performance.now(). 시험 때 가짜를 넣는다.
 * @param windowMs 무시하는 시간. 기본 500ms
 */
export function createClickGuard(
  now: () => number = () => performance.now(),
  windowMs = 500,
): ClickGuard {
  const lastRunAt = new Map<string, number>();
  return {
    run(key, fn) {
      const t = now();
      const last = lastRunAt.get(key);
      if (last !== undefined && t - last < windowMs) return false;
      lastRunAt.set(key, t);
      fn();
      return true;
    },
  };
}
