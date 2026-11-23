// 소리 엔진 (PLAN 작업 11, PRD M2 · DESIGN §2.2-3 · §2.4)
// cues.ts가 만든 안내 중 "지금 낼 것"을 골라, 우선순위·중복·지각·겹침 규칙에 따라 소리를 낸다.
// 실제 소리 내기는 deps(비프·음성·취소)로 받아서, 시험 때 가짜를 넣을 수 있다.

import type { BeepKind, SpeakCallbacks } from "./audio";
import { dueCues, type Cue } from "./cues";

export type SoundDeps = {
  /** 비프를 낸다. delaySec 뒤에 울리도록 예약할 수 있다. */
  beep: (kind: BeepKind, delaySec?: number) => boolean;
  /** 음성을 말한다. 한국어 음성이 없으면 false */
  speak: (text: string, cb: SpeakCallbacks) => boolean;
  /** 재생 중인 음성 취소 */
  cancelSpeech: () => void;
};

export type SoundOptions = {
  /** 음성은 최대 이 시간까지만 인정한다. 기본 4000ms */
  maxVoiceMs?: number;
  /** 예정 시각보다 이만큼 넘게 늦은 안내는 버린다. 기본 500ms */
  staleMs?: number;
};

export function createSoundEngine(deps: SoundDeps, options: SoundOptions = {}) {
  const maxVoiceMs = options.maxVoiceMs ?? 4000;
  const staleMs = options.staleMs ?? 500;

  /** 이미 낸(또는 버린) 안내 ID. 같은 ID는 다시 내지 않는다. */
  const emitted = new Set<string>();
  /** 음성이 재생 중이면 시작한 시각(ms), 아니면 null */
  let voiceStartedAt: number | null = null;
  /** 오래된 음성의 끝남·오류 알림이 새 음성을 끝내지 않도록, 음성마다 번호를 매겨 확인한다 */
  let voiceToken = 0;
  /** 재생 중인 음성이 반복 숫자인가(숫자는 다음 숫자가 와서 갈아치울 수 있다. 다른 음성은 끝까지 간다) */
  let voiceIsCount = false;

  function stopVoice() {
    voiceToken++;
    voiceStartedAt = null;
    voiceIsCount = false;
    deps.cancelSpeech();
  }

  /** 반복 숫자를 말한다. 못 말하거나 재생이 실패하면 반복 비프로 대체한다. */
  function sayCount(cue: Cue, nowMs: number) {
    const beepFallback = () => {
      if (cue.kind) deps.beep(cue.kind);
    };
    const myToken = ++voiceToken;
    const ok = deps.speak(cue.countVoice!, {
      onEnd: () => {
        if (myToken === voiceToken) {
          voiceStartedAt = null;
          voiceIsCount = false;
        }
      },
      onError: () => {
        if (myToken !== voiceToken) return;
        voiceStartedAt = null;
        voiceIsCount = false;
        beepFallback();
      },
    });
    if (ok) {
      voiceStartedAt = nowMs;
      voiceIsCount = true;
    } else {
      voiceStartedAt = null;
      voiceIsCount = false;
      beepFallback();
    }
  }

  /** 음성 하나를 말한다. 못 말하거나 재생이 실패하면 비프로 대체한다. */
  function sayOrFallback(cue: Cue, nowMs: number) {
    if (!cue.voice) return;
    const fallback = () => cue.voiceFallback?.forEach((f) => deps.beep(f.kind, f.delaySec));
    const myToken = ++voiceToken;
    const ok = deps.speak(cue.voice, {
      onEnd: () => {
        if (myToken === voiceToken) voiceStartedAt = null;
      },
      onError: () => {
        if (myToken !== voiceToken) return;
        voiceStartedAt = null;
        fallback();
      },
    });
    voiceIsCount = false;
    if (ok) {
      voiceStartedAt = nowMs;
    } else {
      voiceStartedAt = null;
      fallback();
    }
  }

  return {
    /**
     * 이번 틱에 낼 안내를 처리한다.
     * @param cues 이 상태에서 낼 안내 전체
     * @param elapsedMs 이 상태가 시작된 뒤 흐른 시간(안내 예정 시각과 같은 기준)
     * @param nowMs 음성 길이 재기용 현재 시각(performance.now)
     */
    emit(cues: Cue[], elapsedMs: number, nowMs: number): void {
      // 음성이 4초를 넘기면 끝났다는 신호가 없어도 취소하고, 반복 비프를 다시 낸다
      if (voiceStartedAt !== null && nowMs - voiceStartedAt >= maxVoiceMs) stopVoice();

      const due = dueCues(cues, elapsedMs, emitted);
      if (due.length === 0) return;

      // 1) 같은 ID는 한 번만, 2) 예정보다 0.5초 넘게 늦은 안내는 버린다(내지 않고 처리된 것으로 표시)
      const fresh: Cue[] = [];
      for (const c of due) {
        emitted.add(c.id);
        if (elapsedMs - c.atMs > staleMs) continue;
        fresh.push(c);
      }

      const countdowns = fresh.filter((c) => c.kind === "countdown");
      const voiced = fresh.filter((c) => c.voice !== undefined);
      const reps = fresh.filter((c) => c.kind === "rep" && c.voice === undefined);

      // 우선순위 1: 카운트다운 비프. 음성과 겹치면 음성을 취소하고 비프를 낸다.
      if (countdowns.length > 0) {
        if (voiceStartedAt !== null) stopVoice();
        countdowns.forEach(() => deps.beep("countdown"));
      }

      // 우선순위 2: 음성 안내. 같은 틱에 카운트다운 비프가 있으면 그 안내는 낸 것으로 치고 버린다.
      if (countdowns.length === 0) {
        for (const c of voiced) {
          if (c.kind) deps.beep(c.kind); // 마지막 반복의 세트 완료음
          sayOrFallback(c, nowMs);
        }
      }

      // 우선순위 3: 반복 안내. 카운트다운이 나온 틱에는 내지 않는다.
      if (countdowns.length === 0 && reps.length > 0) {
        // 세트 완료·시작 같은 음성이 재생되는 동안에는 내지 않는다(이전 반복 숫자는 갈아치운다)
        const blocked = voiceStartedAt !== null && !voiceIsCount;
        if (!blocked) {
          const counted = reps.filter((c) => c.countVoice !== undefined);
          if (counted.length > 0) {
            // 한 틱에 여러 개가 겹쳐도 가장 최근 숫자 하나만 말한다
            sayCount(counted[counted.length - 1], nowMs);
          }
          // 숫자 음성이 없는 반복 안내는 이전과 같이 비프. 음성이 재생 중이면 내지 않는다
          if (voiceStartedAt === null) {
            reps.filter((c) => c.countVoice === undefined).forEach((c) => deps.beep(c.kind!));
          }
        }
      }
    },

    /** 음성이 끝났다는 신호를 받았을 때(음성 재생기가 알려 줌) */
    voiceEnded(): void {
      voiceStartedAt = null;
    },

    /** 음성이 재생 중인가 */
    isVoicePlaying(): boolean {
      return voiceStartedAt !== null;
    },

    /** 일시정지: 재생 중인 음성을 취소하고 음성 상태를 비운다. 이미 낸 ID는 그대로 두어 이어하기 때 다시 내지 않는다. */
    pause(): void {
      stopVoice();
    },

    /** 새 운동 시작: 낸 ID 기록과 음성 상태를 모두 비운다 */
    reset(): void {
      emitted.clear();
      stopVoice();
    },
  };
}
