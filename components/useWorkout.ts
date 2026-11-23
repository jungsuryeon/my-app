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
  endSession,
  pauseSession,
  resumeSession,
  setSetReps,
  skipSet,
  startSession,
  tick,
  updateExercise,
  type Session,
  type SessionExercise,
} from "@/lib/session";
import { createSoundEngine } from "@/lib/sound";
import {
  createWakeLock,
  keepAudioAlive,
  watchVisibility,
  type WakeLockStatus,
} from "@/lib/lifecycle";
import {
  buildRecord,
  buildSnapshot,
  clearSnapshot,
  saveRecord,
  saveSnapshot,
  type RestoreResult,
  type SaveResult,
} from "@/lib/records";
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

/** 새 기록 ID. 같은 ID로 저장하면 덮어쓰기만 한다 */
function newRecordId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

type Meta = { recordId: string; routine: { id: string; name: string }; startedAt?: number };

const ACTIVE = ["COUNTDOWN", "EXERCISE", "REST"];

/**
 * 운동 세션을 들고 있으면서, 진행 중에는 0.25초마다 시간을 확인해
 * 상태를 저절로 넘기고(session.ts) 소리를 낸다(sound.ts).
 * 개발 모드에서 effect가 두 번 실행돼도 틱은 하나만 돈다(timer.ts).
 */
export function useWorkout() {
  const [session, setSession] = useState<Session | null>(null);
  const [nowMs, setNowMs] = useState(0);
  // 화면 이탈·틱 끊김으로 자동 일시정지된 상태인가(안내 문구를 보여 주기 위함)
  const [awayPaused, setAwayPaused] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  // 스냅샷에 함께 남길 기록 ID와 루틴 이름
  const metaRef = useRef<Meta | null>(null);
  // 화면 꺼짐 방지 결과(안내 문구를 보여 주기 위함). 아직 요청 전이면 null
  const [wakeLockStatus, setWakeLockStatus] = useState<WakeLockStatus | null>(null);
  // 진행 상태를 저장하지 못했는가(새로고침하면 사라질 수 있다고 알리기 위함)
  const [snapshotFailed, setSnapshotFailed] = useState(false);
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
    (exercises: SessionExercise[], routine: { id: string; name: string }) =>
      void guard.run("start", () => {
        metaRef.current = { recordId: newRecordId(), routine, startedAt: Date.now() };
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
        setAwayPaused(false);
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
        setAwayPaused(false);
        commit(resumeSession(s, now));
      }),
    [commit, guard],
  );

  /** 현재 세트 건너뛰기(운동 중에만 동작). 휴식 없이 3초 카운트다운 후 다음 세트로 간다 */
  const skip = useCallback(
    () =>
      void guard.run("skip", () => {
        const s = sessionRef.current;
        if (!s) return;
        const now = performance.now();
        engine.pause(); // 재생 중이던 음성은 끊는다
        setNowMs(now);
        commit(skipSet(s, now));
      }),
    [commit, engine, guard],
  );

  /**
   * "전체 종료" 탭: 진행 중이면 먼저 일시정지한다(확인창이 떠 있는 동안 시간이 흐르지 않게).
   * 돌려주는 값: 진행 중이었으면 true(계속하기 때 이어가야 함), 이미 멈춰 있거나 준비 화면이면 false,
   * 연속 클릭으로 무시됐으면 null.
   */
  const requestEnd = useCallback((): boolean | null => {
    const result: { value: boolean | null } = { value: null };
    guard.run("end", () => {
      const s = sessionRef.current;
      if (!s) return;
      const now = performance.now();
      setNowMs(now);
      const running = ACTIVE.includes(s.machine.phase);
      if (running) {
        engine.pause();
        commit(pauseSession(s, now));
      }
      result.value = running;
    });
    return result.value;
  }, [commit, engine, guard]);

  /** 확인창 "계속하기": 누르기 전에 진행 중이었다면 멈췄던 상태로 되돌린다 */
  const cancelEnd = useCallback(
    (resumeRunning: boolean) => {
      const s = sessionRef.current;
      if (!s || !resumeRunning) return;
      const now = performance.now();
      setNowMs(now);
      commit(resumeSession(s, now));
    },
    [commit],
  );

  /** 종료 화면에서 세트 하나의 반복 수를 고친다 */
  const editReps = useCallback(
    (exerciseIndex: number, setIndex: number, reps: number) => {
      const s = sessionRef.current;
      if (!s) return;
      commit(setSetReps(s, exerciseIndex, setIndex, reps));
    },
    [commit],
  );

  /**
   * 종료 화면의 "기록 저장": 지금 세션을 기록 하나로 만들어 저장한다.
   * 같은 기록 ID로는 덮어쓰기만 한다. 성공하면 호출하는 쪽이 홈으로 돌아가며 진행 상태를 지운다.
   * 연속 클릭으로 무시됐으면 null.
   */
  const save = useCallback((): SaveResult | null => {
    const result: { value: SaveResult | null } = { value: null };
    guard.run("save", () => {
      const s = sessionRef.current;
      const meta = metaRef.current;
      if (!s || !meta) return;
      result.value = saveRecord(
        buildRecord({
          recordId: meta.recordId,
          routine: meta.routine,
          session: s,
          nowDate: Date.now(),
          startedAt: meta.startedAt,
        }),
      );
    });
    return result.value;
  }, [guard]);

  /** 확인창 "저장 후 종료": 종료를 확정한다(못 한 세트는 미수행). 종료 화면으로 간다 */
  const finish = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    engine.pause();
    commit(endSession(s));
  }, [commit, engine]);

  /**
   * 자동 일시정지: 화면을 벗어났거나 틱이 끊겼을 때. atMs 시각에 멈춘 것으로 처리한다.
   * 화면 이탈은 "지금", 틱 끊김은 "끊기기 전 마지막 정상 시각"을 넘겨서 벗어나 있던 시간이 빠지게 한다.
   * 복귀해도 저절로 이어가지 않고 사용자가 "이어하기"를 누르게 한다.
   */
  const autoPause = useCallback(
    (atMs: number) => {
      const s = sessionRef.current;
      if (!s || !ACTIVE.includes(s.machine.phase)) return;
      engine.pause();
      setNowMs(atMs);
      setAwayPaused(true);
      commit(pauseSession(s, atMs));
    },
    [commit, engine],
  );

  /** 새로고침·재실행 후 저장해 둔 진행 상태를 되살린다(일시정지·준비 화면·종료 화면 중 하나로 시작) */
  const restore = useCallback(
    (r: Exclude<RestoreResult, { kind: "none" }>) => {
      metaRef.current = { recordId: r.recordId, routine: r.routine, startedAt: r.startedAt };
      engine.reset();
      setAwayPaused(false);
      commit(r.session);
    },
    [commit, engine],
  );

  /** 세션을 버리고 홈으로 돌아갈 때 */
  const exit = useCallback(() => {
    engine.pause();
    setAwayPaused(false);
    clearSnapshot(); // 저장해 둔 진행 상태도 지운다
    metaRef.current = null;
    commit(null);
  }, [commit, engine]);

  const active = session !== null && ACTIVE.includes(session.machine.phase);

  useEffect(() => {
    if (!active) return;
    const ticker = createTicker(
      (now) => {
        const s = sessionRef.current;
        if (!s) return;
        // 소리는 "넘어가기 전" 상태 기준으로 낸다(운동이 끝나는 순간의 세트 완료 안내가 빠지지 않게)
        engine.emit(cuesFor(s), elapsedMs(s.clock, now), now);
        const next = tick(s, now);
        if (next !== s) commit(next);
        setNowMs(now);
      },
      // 틱이 2초 이상 끊기면(화면 잠금 등) 끊기기 전 마지막 정상 시각에 멈춘 것으로 처리한다
      { onGap: (_gap, lastTickMs) => autoPause(lastTickMs) },
    );
    ticker.start();
    return ticker.stop;
  }, [active, commit, engine, autoPause]);

  // 1초마다 진행 상태를 저장한다. 어느 순간에 새로고침해도 이어갈 수 있도록 상태가 바뀔 때도 바로 저장한다.
  const hasSession = session !== null;
  useEffect(() => {
    if (!hasSession) return;
    function save() {
      const s = sessionRef.current;
      const meta = metaRef.current;
      if (!s || !meta) return;
      const ok = saveSnapshot(
        buildSnapshot({
          recordId: meta.recordId,
          routine: meta.routine,
          startedAt: meta.startedAt,
          session: s,
          nowMs: performance.now(),
          nowDate: Date.now(),
        }),
      );
      setSnapshotFailed(!ok);
    }
    save();
    const id = setInterval(save, 1000);
    return () => clearInterval(id);
  }, [hasSession, session]);

  // 운동 중(종료 화면 전까지)에는 화면이 꺼지지 않게 요청한다. 화면이 숨겨지면 시스템이 놓으므로 다시 보일 때 다시 요청한다.
  const wantsWakeLock = session !== null && session.machine.phase !== "COMPLETED";
  useEffect(() => {
    if (!wantsWakeLock) return;
    const lock = createWakeLock();
    let cancelled = false;
    const acquire = () =>
      void lock.acquire().then((status) => {
        if (!cancelled) setWakeLockStatus(status);
      });
    acquire();
    const stopWatch = watchVisibility({ onVisible: acquire });
    return () => {
      cancelled = true;
      stopWatch();
      void lock.release();
    };
  }, [wantsWakeLock]);

  // 화면에서 벗어나면(다른 앱 이동·화면 잠금) 자동 일시정지, 돌아오면 끊긴 오디오를 다시 깨운다
  useEffect(() => {
    const stopWatch = watchVisibility({ onHidden: () => autoPause(performance.now()) });
    const stopAudio = keepAudioAlive();
    return () => {
      stopWatch();
      stopAudio();
    };
  }, [autoPause]);

  return { session, nowMs, awayPaused, wakeLockStatus, snapshotFailed, restore, editReps, save, begin, startNext, pause, resume, skip, requestEnd, cancelEnd, finish, exit };
}
