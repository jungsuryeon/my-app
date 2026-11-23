// 안내(소리) 시각 계산 (PLAN 작업 9, PRD M2 · DESIGN §2.2-3 · §3.5)
// "언제 어떤 소리를 낼지"만 계산한다. 소리를 내는 일은 audio.ts가 한다.
// 이 작업에서는 휴식 마지막 3·2·1초 비프만 다룬다. 중복 방지·우선순위·지각 판정은 작업 11에서 이어서 붙인다.

import type { BeepKind } from "./audio";

/** 안내 하나: 어떤 소리를, 상태가 시작된 뒤 몇 ms 시점에 낼지 */
export type Cue = {
  /** 안내 ID `상태-운동-세트-번호`. 같은 ID는 한 번만 낸다(PRD) */
  id: string;
  kind: BeepKind;
  /** 이 상태(휴식)가 시작된 뒤의 시각(ms) */
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

/** 소리가 나는 상황 */
export type SoundEvent =
  | "start" // 운동 시작
  | "rep" // 반복 하나
  | "setDone" // 세트 완료(+ 휴식 시작)
  | "exerciseDone" // 운동의 마지막 세트 완료
  | "routineDone" // 루틴 완료
  | "restCountdown"; // 휴식 마지막 3·2·1초

/**
 * 혼합 모드(기본값): 반복은 비프음, 세트 완료와 휴식 시작은 음성이다.
 * 휴식 종료는 별도 음성 없이 3·2·1 비프가 대신한다.
 */
export const MIXED_MODE: Record<SoundEvent, "beep" | "voice"> = {
  start: "voice",
  rep: "beep",
  setDone: "voice",
  exerciseDone: "voice",
  routineDone: "voice",
  restCountdown: "beep",
};
