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
    initSpeech(); // 음성도 같은 탭 안에서 함께 켠다
    return true;
  } catch {
    return false;
  }
}

/** 오디오가 켜져 있고 소리를 낼 수 있는 상태인가 */
export function isAudioReady(): boolean {
  return ctx !== null && ctx.state === "running";
}

/**
 * 비프 한 번. 오디오가 아직 켜지지 않았으면 아무것도 하지 않고 false.
 * delaySec를 주면 그만큼 뒤에 정확히 울리도록 예약한다(기본 0 = 지금).
 */
export function playBeep(kind: BeepKind, delaySec = 0): boolean {
  if (!ctx || !beeper) return false;
  try {
    return beeper(kind, ctx.currentTime + delaySec);
  } catch {
    return false;
  }
}

// ───────────────────────── 한국어 음성 안내 (PLAN 작업 10) ─────────────────────────
// 소리 우선순위·4초 제한·음성 실패 시 비프 대체는 작업 11에서 이어서 붙인다.

export type VoiceLike = { lang: string; name: string; localService?: boolean };
export type UtteranceLike = { lang: string; voice: unknown; rate: number; volume: number };
export type SynthLike = {
  getVoices: () => VoiceLike[];
  speak: (u: never) => void;
  cancel: () => void;
  addEventListener: (type: string, cb: () => void) => void;
  removeEventListener: (type: string, cb: () => void) => void;
};

/** 한국어 음성을 고른다. ko-KR 우선, 기기 안에 설치된 음성을 우선. 없으면 null. ("ko_KR" 같은 표기도 인정) */
export function pickKoreanVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  const ko = voices.filter((v) => /^ko([-_]|$)/i.test(v.lang));
  if (ko.length === 0) return null;
  const rank = (v: T) =>
    (/^ko[-_]kr$/i.test(v.lang) ? 0 : 2) + (v.localService ? 0 : 1);
  return [...ko].sort((a, b) => rank(a) - rank(b))[0];
}

/**
 * 음성 목록이 채워질 때까지 기다린다. 브라우저는 목록을 늦게 채우므로(voiceschanged),
 * 이미 있으면 바로, 없으면 변경 알림을 기다리고, timeoutMs가 지나도 안 오면 빈 목록으로 끝낸다.
 */
export function waitForVoices(synth: SynthLike, timeoutMs = 2000): Promise<VoiceLike[]> {
  return new Promise((resolve) => {
    const now = synth.getVoices();
    if (now.length > 0) return resolve(now);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener("voiceschanged", onChange);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const onChange = () => {
      if (synth.getVoices().length > 0) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener("voiceschanged", onChange);
  });
}

/** 음성 재생기. synth와 발화 객체 생성 함수를 받아 시험 때 가짜를 넣을 수 있다. */
export function createSpeaker(deps: {
  synth: SynthLike;
  makeUtterance: (text: string) => UtteranceLike;
}) {
  let voice: VoiceLike | null = null;
  return {
    /** 음성 목록을 기다려 한국어 음성을 고른다. 한국어 음성이 있으면 true. */
    async prepare(timeoutMs = 2000): Promise<boolean> {
      voice = pickKoreanVoice(await waitForVoices(deps.synth, timeoutMs));
      return voice !== null;
    },
    hasVoice(): boolean {
      return voice !== null;
    },
    /** 말한다. 새 음성을 시작하기 전에는 항상 재생 중인 음성을 취소한다. 한국어 음성이 없으면 false(호출 쪽이 비프로 대체). */
    speak(text: string, volume = 1): boolean {
      if (!voice) return false;
      deps.synth.cancel();
      const u = deps.makeUtterance(text);
      u.lang = "ko-KR";
      u.voice = voice;
      u.rate = 1;
      u.volume = volume;
      deps.synth.speak(u as never);
      return true;
    },
    cancel(): void {
      deps.synth.cancel();
    },
  };
}

let speaker: ReturnType<typeof createSpeaker> | null = null;

/**
 * 음성을 켠다. initAudio()와 같이 버튼 탭 안에서 불러야 한다.
 * iPhone은 탭 안에서 한 번 말을 시켜야 이후 음성이 나므로, 들리지 않는 빈 발화로 먼저 깨운다.
 * 한국어 음성 목록은 뒤에서 기다려 고른다.
 */
export function initSpeech(): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    const synth = window.speechSynthesis;
    if (!speaker) {
      speaker = createSpeaker({
        synth: synth as unknown as SynthLike,
        makeUtterance: (text) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike,
      });
      void speaker.prepare();
    }
    const unlock = new SpeechSynthesisUtterance(" ");
    unlock.volume = 0;
    synth.speak(unlock);
    return true;
  } catch {
    return false;
  }
}

/** 한국어로 말한다. 음성을 못 켰거나 한국어 음성이 없으면 false. */
export function speakKorean(text: string): boolean {
  if (!speaker) return false;
  try {
    return speaker.speak(text);
  } catch {
    return false;
  }
}

/** 재생 중인 음성을 취소한다 */
export function cancelSpeech(): void {
  try {
    speaker?.cancel();
  } catch {
    // 취소 실패는 무시한다
  }
}
