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
