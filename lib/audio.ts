// 오디오 초기화와 비프음 (PLAN 작업 8, PRD M2 · DESIGN §2.4)
// 규칙: 소리는 사용자가 버튼을 누른 "그 탭 안에서" 초기화해야 iPhone이 허용한다.
// 비프음은 소리 파일 없이 Web Audio로 직접 만든다. (음성 안내는 작업 10, 휴식 3·2·1 비프는 작업 9)

/** 비프 종류. rep = 반복마다 짧게, setDone = 세트 완료 긴 소리, countdown = 휴식 마지막 3·2·1(작업 9에서 사용) */
export type BeepKind = "rep" | "setDone" | "countdown";

type BeepSpec = { freq: number; durationSec: number; volume: number };

export const BEEP_SPECS: Record<BeepKind, BeepSpec> = {
  rep: { freq: 880, durationSec: 0.1, volume: 0.35 },
  setDone: { freq: 660, durationSec: 0.7, volume: 0.4 }, // PRD: 세트 완료 = 긴 비프
  countdown: { freq: 1100, durationSec: 0.15, volume: 0.45 },
};

// ── 시험하기 쉽도록 Web Audio에서 쓰는 부분만 좁게 정의한 모양 ──
type ParamLike = {
  value: number;
  setValueAtTime: (v: number, t: number) => unknown;
  linearRampToValueAtTime: (v: number, t: number) => unknown;
};
type NodeLike = { connect: (dest: never) => unknown };
export type OscillatorLike = NodeLike & {
  type: string;
  frequency: { value: number };
  start: (t: number) => void;
  stop: (t: number) => void;
};
export type GainLike = NodeLike & { gain: ParamLike };
export type AudioContextLike = {
  currentTime: number;
  state: string;
  destination: unknown;
  createOscillator: () => OscillatorLike;
  createGain: () => GainLike;
};

/**
 * 비프를 내는 함수를 만든다. ctx는 실제 AudioContext(또는 시험용 가짜).
 * 소리가 갑자기 켜지고 꺼질 때 나는 "틱" 잡음을 줄이려고 볼륨을 짧게 올렸다 내린다.
 * atSec를 주면 그 시각(ctx.currentTime 기준)에 정확히 예약해서 낸다. 안 주면 지금 낸다.
 */
export function createBeeper(ctx: AudioContextLike) {
  return function beep(kind: BeepKind, atSec?: number): boolean {
    if (ctx.state === "closed") return false;
    const spec = BEEP_SPECS[kind];
    const t0 = Math.max(atSec ?? 0, ctx.currentTime);
    const attack = 0.005;
    const release = Math.min(0.03, spec.durationSec / 2);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = spec.freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(spec.volume, t0 + attack);
    gain.gain.setValueAtTime(spec.volume, t0 + spec.durationSec - release);
    gain.gain.linearRampToValueAtTime(0, t0 + spec.durationSec);
    osc.connect(gain as never);
    gain.connect(ctx.destination as never);
    osc.start(t0);
    osc.stop(t0 + spec.durationSec + 0.02);
    return true;
  };
}

// ───────────────────────── 앱에서 쓰는 부분 (브라우저 필요) ─────────────────────────

type AudioContextCtor = new () => AudioContext;

let ctx: AudioContext | null = null;
let beeper: ReturnType<typeof createBeeper> | null = null;

/** iPhone Safari는 예전 이름(webkitAudioContext)을 쓰는 경우가 있어 둘 다 확인한다 */
function getCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * 오디오를 켠다. 반드시 사용자가 누른 버튼의 클릭 처리 안에서 불러야 한다("운동 시작", "소리 테스트").
 * 이미 켜져 있으면 멈춰 있던 것만 다시 깨운다. 성공하면 true.
 */
export function initAudio(): boolean {
  const Ctor = getCtor();
  if (!Ctor) return false;
  try {
    if (!ctx || ctx.state === "closed") {
      ctx = new Ctor();
      beeper = createBeeper(ctx as unknown as AudioContextLike);
    }
    // iOS는 탭 안에서 resume()과 소리 재생을 한 번 해 줘야 이후에 소리가 난다. 아무 소리 없는 한 샘플을 재생한다.
    void ctx.resume();
    const silent = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start(0);
    return true;
  } catch {
    return false;
  }
}

/** 오디오가 켜져 있고 소리를 낼 수 있는 상태인가 */
export function isAudioReady(): boolean {
  return ctx !== null && ctx.state === "running";
}

/** 비프 한 번. 오디오가 아직 켜지지 않았으면 아무것도 하지 않고 false. */
export function playBeep(kind: BeepKind): boolean {
  if (!ctx || !beeper) return false;
  try {
    return beeper(kind);
  } catch {
    return false;
  }
}
