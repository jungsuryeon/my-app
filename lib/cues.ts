// 안내(소리) 시각 계산 (PLAN 작업 9~11, PRD M2 · DESIGN §2.2-3 · §3.5)
// "언제 어떤 소리를 낼지"만 계산한다. 소리를 내는 일은 audio.ts, 겹침·우선순위 판단은 sound.ts가 한다.

import type { BeepKind } from "./audio";

/** 음성이 안 나올 때 대신 낼 비프 하나 (delaySec: 안내 시각으로부터 몇 초 뒤) */
export type FallbackBeep = { kind: BeepKind; delaySec: number };

/** 안내 하나: 어떤 소리를, 상태가 시작된 뒤 몇 ms 시점에 낼지 */
export type Cue = {
  /** 안내 ID `상태-운동-세트-번호`. 같은 ID는 한 번만 낸다(PRD) */
  id: string;
  /** 낼 비프. 없으면 음성만 */
  kind?: BeepKind;
  /** 말할 음성 문구. 없으면 비프만 */
  voice?: string;
  /**
   * 반복 숫자 음성("하나", "둘" …). 있으면 반복 비프 대신 이 숫자를 말하고, 음성을 쓸 수 없으면 kind 비프로 대체한다.
   * 우선순위가 가장 낮아서 세트 완료·시작 음성이 재생 중이면 내지 않고, 이전 숫자가 재생 중이면 취소하고 새 숫자를 말한다.
   */
  countVoice?: string;
  /** 음성을 쓸 수 없을 때 비프로 대체하는 소리(세트 완료의 긴 비프는 kind로 이미 낸 뒤 이어서) */
  voiceFallback?: FallbackBeep[];
  /** 이 상태(운동·휴식·카운트다운)가 시작된 뒤의 시각(ms) */
  atMs: number;
};

/** 휴식이 끝나기 몇 초 전부터 비프를 내는가: 3·2·1초 전 */
export const REST_COUNTDOWN_SECONDS = [3, 2, 1] as const;

/**
 * 휴식 마지막 3·2·1초 비프의 예정 시각을 만든다.
 * 이 비프가 다음 세트의 카운트다운을 겸하므로, 휴식 직후 별도의 3초 카운트다운은 두지 않는다.
 * 휴식이 3초보다 짧아도 시각이 음수가 되지 않게, 앞쪽 비프는 휴식 시작 시점(0ms)부터로 당긴다.
 */
export function restCountdownCues(
  restSec: number,
  exerciseIndex: number,
  setIndex: number,
): Cue[] {
  return REST_COUNTDOWN_SECONDS.map((n) => ({
    id: `REST-${exerciseIndex}-${setIndex}-${n}`,
    kind: "countdown" as const,
    atMs: Math.max(0, restSec * 1000 - n * 1000),
  }));
}

/**
 * 지금까지 예정 시각이 지났는데 아직 내지 않은 안내를 시각 순으로 돌려준다.
 * emitted에 있는 ID는 이미 낸 것이므로 건너뛴다(같은 안내를 두 번 내지 않기 위함).
 */
export function dueCues(cues: Cue[], elapsedMs: number, emitted: ReadonlySet<string>): Cue[] {
  return cues
    .filter((c) => c.atMs <= elapsedMs && !emitted.has(c.id))
    .sort((a, b) => a.atMs - b.atMs);
}

// ───────────────────────── 음성 문구와 혼합 모드 (PLAN 작업 10) ─────────────────────────

/** 음성 문구 (PRD M2). 세트 완료와 휴식 시작은 한 문장으로 합쳐 한 번에 말한다. */
export const PHRASES = {
  start: "운동을 시작합니다.",
  routineDone: "모든 운동을 완료했습니다.",
} as const;

/** 세트 완료 + 휴식 시작: "{n}번째 세트 완료. {휴식}초 휴식합니다." (n은 1부터) */
export function setDonePhrase(setNumber: number, restSec: number): string {
  return `${setNumber}번째 세트 완료. ${restSec}초 휴식합니다.`;
}

/** 운동의 마지막 세트 완료: 휴식 문구는 쓰지 않는다 */
export function exerciseDonePhrase(exerciseName: string, nextExerciseName: string): string {
  return `${exerciseName} 완료. 다음 운동은 ${nextExerciseName}입니다. 준비되면 시작을 누르세요.`;
}

const ONES = ["", "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉"];
const TENS = ["", "열", "스물", "서른", "마흔", "쉰"];

/** 반복 숫자를 우리말 셈말로: 1→"하나", 11→"열하나", 20→"스물", 50→"쉰" (1~50) */
export function countWord(n: number): string {
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t] ?? ""}${ONES[o]}` || String(n);
}

/** 소리가 나는 상황 */
export type SoundEvent =
  | "start" // 운동 시작
  | "rep" // 반복 하나
  | "setDone" // 세트 완료(+ 휴식 시작)
  | "exerciseDone" // 운동의 마지막 세트 완료
  | "routineDone" // 루틴 완료
  | "restCountdown"; // 휴식 마지막 3·2·1초

/**
 * 혼합 모드(기본값): 반복은 숫자 음성(음성을 못 쓰면 비프), 세트 완료와 휴식 시작도 음성이다.
 * 휴식 종료는 별도 음성 없이 3·2·1 비프가 대신한다.
 */
export const MIXED_MODE: Record<SoundEvent, "beep" | "voice"> = {
  start: "voice",
  rep: "voice",
  setDone: "voice",
  exerciseDone: "voice",
  routineDone: "voice",
  restCountdown: "beep",
};

// ───────────────────────── 안내 만들기 (PLAN 작업 11) ─────────────────────────

/** 운동 시작 음성. "운동 시작" 탭 순간에 낸다. */
export function startCue(): Cue {
  return { id: "START", voice: PHRASES.start, atMs: 0 };
}

/** 시작 전 3초 카운트다운: 3·2·1 비프를 0·1·2초 시점에 낸다 */
export function countdownCues(exerciseIndex: number, setIndex: number): Cue[] {
  return [3, 2, 1].map((n, i) => ({
    id: `COUNTDOWN-${exerciseIndex}-${setIndex}-${n}`,
    kind: "countdown" as const,
    atMs: i * 1000,
  }));
}

/** 휴식 시작 안내를 음성으로 못 낼 때: 짧은 비프 2회(PRD). 긴 세트 완료 비프(0.7초) 뒤에 이어서 낸다. */
const REST_START_FALLBACK: FallbackBeep[] = [
  { kind: "rep", delaySec: 0.9 },
  { kind: "rep", delaySec: 1.15 },
];

/**
 * 한 세트의 반복 안내를 만든다.
 * - n번째 반복 안내(숫자 음성, 못 쓰면 비프)는 EXERCISE 시작 후 n×템포초에 낸다.
 * - 마지막 반복에는 숫자 대신 세트 완료음(긴 비프)과 음성을 낸다.
 * @param finalPhrase 마지막 반복에서 말할 문구(세트 완료+휴식, 또는 운동 완료, 또는 루틴 완료)
 * @param restFollows 이어서 휴식이 있는가. 있으면 음성 실패 시 짧은 비프 2회로 휴식 시작을 알린다.
 */
export function setCues(p: {
  exerciseIndex: number;
  setIndex: number;
  reps: number;
  tempoSec: number;
  finalPhrase: string;
  restFollows: boolean;
}): Cue[] {
  const cues: Cue[] = [];
  for (let n = 1; n <= p.reps; n++) {
    const id = `EXERCISE-${p.exerciseIndex}-${p.setIndex}-${n}`;
    const atMs = n * p.tempoSec * 1000;
    if (n < p.reps) {
      cues.push({ id, kind: "rep", countVoice: countWord(n), atMs });
    } else {
      cues.push({
        id,
        kind: "setDone",
        voice: p.finalPhrase,
        voiceFallback: p.restFollows ? REST_START_FALLBACK : [],
        atMs,
      });
    }
  }
  return cues;
}
