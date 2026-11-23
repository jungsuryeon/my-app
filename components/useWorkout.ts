"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cancelSpeech, playBeep, speakKorean } from "@/lib/audio";
import {
  PHRASES,
  countdownCues,
  exerciseDonePhrase,
  restCountdownCues,
  setCues,
  setDonePhrase,
  type Cue,
} from "@/lib/cues";
import { isLastExercise, isLastSetOfExercise } from "@/lib/machine";
import { createClickGuard } from "@/lib/clickGuard";
import {
  createSession,
  pauseSession,
  resumeSession,
  startSession,
  tick,
  updateExercise,
  type Session,
  type SessionExercise,
} from "@/lib/session";
import { createSoundEngine } from "@/lib/sound";
import { createTicker, elapsedMs } from "@/lib/timer";

/** 지금 상태에서 낼 안내 전체 */
function cuesFor(s: Session): Cue[] {
  const m = s.machine;
  const ex = s.exercises[m.exerciseIndex];
  if (m.phase === "COUNTDOWN") return countdownCues(m.exerciseIndex, m.setIndex);
  if (m.phase === "REST") return restCountdownCues(ex.restSec, m.exerciseIndex, m.setIndex);
  if (m.phase === "EXERCISE") {
    const lastSet = isLastSetOfExercise(m);
    const finalPhrase = !lastSet
      ? setDonePhrase(m.setIndex + 1, ex.restSec)
      : isLastExercise(m)
        ? PHRASES.routineDone
        : exerciseDonePhrase(ex.name, s.exercises[m.exerciseIndex + 1].name);
    return setCues({
      exerciseIndex: m.exerciseIndex,
      setIndex: m.setIndex,
      reps: ex.reps,
      tempoSec: ex.tempoSec,
      finalPhrase,
      restFollows: !lastSet,
    });
  }
  return [];
}

// 일시정지와 이어하기는 화면의 같은 자리에 번갈아 나타나는 버튼이므로 같은 버튼으로 본다
// (실수로 두 번 눌러 멈췄다가 바로 이어지는 일을 막는다)
const PAUSE_TOGGLE = "pause-toggle";

const ACTIVE = ["COUNTDOWN", "EXERCISE", "REST"];

/**
 * 운동 세션을 들고 있으면서, 진행 중에는 0.25초마다 시간을 확인해
 * 상태를 저절로 넘기고(session.ts) 소리를 낸다(sound.ts).
 * 개발 모드에서 effect가 두 번 실행돼도 틱은 하나만 돈다(timer.ts).
 */
export function useWorkout() {
  const [session, setSession] = useState<Session | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const sessionRef = useRef<Session | null>(null);
  // 소리 엔진은 처음 한 번만 만들어 계속 쓴다(이미 낸 안내 ID 기록을 유지하기 위함)
  const [engine] = useState(() =>
    createSoundEngine({
      beep: playBeep,
      speak: (text, cb) => speakKorean(text, cb),
      cancelSpeech,
    }),
  );

  // 모든 버튼 동작은 연속 클릭 방지(0.5초)를 거친다
  const [guard] = useState(() => createClickGuard());

  const commit = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** 첫 운동 "운동 시작" 탭: 새 세션을 만들고 바로 카운트다운을 시작한다 */
  const begin = useCallback(
    (exercises: SessionExercise[]) =>
      void guard.run("start", () => {
        engine.reset();
        const now = performance.now();
        setNowMs(now);
        commit(startSession(createSession(exercises), now));
      }),
    [commit, engine, guard],
  );

  /** 운동 사이 준비 화면에서 "운동 시작" 탭: 고친 값을 반영하고 카운트다운을 시작한다 */
  const startNext = useCallback(
    (values: Pick<SessionExercise, "reps" | "sets" | "restSec" | "tempoSec">) =>
      void guard.run("start", () => {
        const s = sessionRef.current;
        if (!s) return;
        const now = performance.now();
        setNowMs(now);
        commit(startSession(updateExercise(s, s.machine.exerciseIndex, values), now));
      }),
    [commit, guard],
  );

  /** 일시정지: 재생 중인 음성을 취소하고 시간을 멈춘다. 남은 시간은 세션이 저장한다 */
  const pause = useCallback(
    () =>
      void guard.run(PAUSE_TOGGLE, () => {
        const s = sessionRef.current;
        if (!s) return;
        const now = performance.now();
        engine.pause();
        setNowMs(now);
        commit(pauseSession(s, now));
      }),
    [commit, engine, guard],
  );

  /** 이어하기: 멈췄던 상태로 돌아가 남은 시간부터 다시 센다 */
  const resume = useCallback(
    () =>
      void guard.run(PAUSE_TOGGLE, () => {
        const s = sessionRef.current;
        if (!s) return;
        const now = performance.now();
        setNowMs(now);
        commit(resumeSession(s, now));
      }),
    [commit, guard],
  );

  /** 세션을 버리고 홈으로 돌아갈 때 */
  const exit = useCallback(() => {
    engine.pause();
    commit(null);
  }, [commit, engine]);

  const active = session !== null && ACTIVE.includes(session.machine.phase);

  useEffect(() => {
    if (!active) return;
    const ticker = createTicker((now) => {
      const s = sessionRef.current;
      if (!s) return;
      // 소리는 "넘어가기 전" 상태 기준으로 낸다(운동이 끝나는 순간의 세트 완료 안내가 빠지지 않게)
      engine.emit(cuesFor(s), elapsedMs(s.clock, now), now);
      const next = tick(s, now);
      if (next !== s) commit(next);
      setNowMs(now);
    });
    ticker.start();
    return ticker.stop;
  }, [active, commit, engine]);

  return { session, nowMs, begin, startNext, pause, resume, exit };
}
