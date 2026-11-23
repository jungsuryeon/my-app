// 화면 이탈·복귀 감지 (PLAN 작업 11 일부, DESIGN §3.5)
// 이 작업에서는 "화면에 돌아오면 끊긴 오디오를 다시 켠다"만 만든다.
// 자동 PAUSED·숨은 시간 제외·Wake Lock 재요청은 작업 16·18에서 이 파일에 붙인다.

import { resumeAudio } from "./audio";

type VisibilityTarget = {
  visibilityState: string;
  addEventListener: (type: "visibilitychange", cb: () => void) => void;
  removeEventListener: (type: "visibilitychange", cb: () => void) => void;
};

/**
 * 화면이 숨겨지거나 다시 보일 때 알려 준다. 돌려받은 함수를 부르면 감시를 멈춘다
 * (React의 useEffect 정리 함수로 그대로 쓸 수 있다).
 */
export function watchVisibility(
  handlers: { onHidden?: () => void; onVisible?: () => void },
  target: VisibilityTarget | null = typeof document === "undefined" ? null : document,
): () => void {
  if (!target) return () => {};
  const listener = () => {
    if (target.visibilityState === "hidden") handlers.onHidden?.();
    else if (target.visibilityState === "visible") handlers.onVisible?.();
  };
  target.addEventListener("visibilitychange", listener);
  return () => target.removeEventListener("visibilitychange", listener);
}

/** 화면에 돌아올 때마다 오디오를 다시 깨운다. 정리 함수를 돌려준다. */
export function keepAudioAlive(target?: VisibilityTarget | null): () => void {
  return watchVisibility({ onVisible: resumeAudio }, target);
}

// ───────────────────────── 화면 꺼짐 방지 (PLAN 작업 18, PRD M2) ─────────────────────────
// 운동 중 화면이 저절로 꺼지지 않게 "화면 켜 두기(Screen Wake Lock)"를 요청한다.
// 지원하지 않는 기기이거나 요청이 거절되면 안내만 하고, 앱은 그대로 동작한다(최선 노력).

type SentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: "release", cb: () => void) => void;
};
export type NavigatorLike = {
  wakeLock?: { request: (type: "screen") => Promise<SentinelLike> };
};

/** on = 켜짐 / unsupported = 이 기기는 지원 안 함 / failed = 요청이 거절됨(배터리 절약 모드 등) */
export type WakeLockStatus = "on" | "unsupported" | "failed";

export function createWakeLock(
  nav: NavigatorLike | undefined = typeof navigator === "undefined"
    ? undefined
    : (navigator as unknown as NavigatorLike),
) {
  let sentinel: SentinelLike | null = null;
  let wanted = false;

  return {
    /** 화면 켜 두기를 요청한다. 이미 켜져 있으면 그대로 "on". */
    async acquire(): Promise<WakeLockStatus> {
      wanted = true;
      if (!nav?.wakeLock) return "unsupported";
      if (sentinel) return "on";
      try {
        const s = await nav.wakeLock.request("screen");
        // 기다리는 사이에 그만두기로 했다면 바로 놓는다
        if (!wanted) {
          void s.release().catch(() => {});
          return "failed";
        }
        sentinel = s;
        // 화면이 숨겨지면 시스템이 저절로 놓는다. 다시 보일 때 acquire()로 다시 요청한다.
        s.addEventListener?.("release", () => {
          if (sentinel === s) sentinel = null;
        });
        return "on";
      } catch {
        return "failed";
      }
    },
    /** 화면 켜 두기를 놓는다 */
    async release(): Promise<void> {
      wanted = false;
      const s = sentinel;
      sentinel = null;
      try {
        await s?.release();
      } catch {
        // 이미 놓였다면 무시한다
      }
    },
    isHolding: () => sentinel !== null,
  };
}
