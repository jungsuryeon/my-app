"use client";

import { currentReps, type Session } from "@/lib/session";
import { COUNTDOWN_MS, countdownDisplay, elapsedMs, restRemainingMs } from "@/lib/timer";

type Props = {
  session: Session;
  /** 지금 시각(performance.now). 틱마다 바뀌어 화면이 다시 그려진다 */
  nowMs: number;
  /** 일시정지 버튼 */
  onPause: () => void;
  /** 이어하기 버튼 */
  onResume: () => void;
  /** 화면 이탈·틱 끊김으로 자동 일시정지된 상태인가 */
  awayPaused: boolean;
  /** 화면 꺼짐 방지 결과. 켜지지 않았으면 안내를 보여 준다 */
  wakeLockStatus: "on" | "unsupported" | "failed" | null;
  /** 현재 세트 건너뛰기(운동 중에만 켜짐) */
  onSkip: () => void;
  /** 전체 종료(확인창을 띄운다) */
  onEnd: () => void;
};

// 운동 진행 화면: COUNTDOWN / EXERCISE / REST 세 상태를 보여 준다.
// 계산은 하지 않고 lib/의 결과만 보여 준다.
export default function Progress({ session, nowMs, onPause, onResume, awayPaused, wakeLockStatus, onSkip, onEnd }: Props) {
  const m = session.machine;
  const ex = session.exercises[m.exerciseIndex];
  const el = elapsedMs(session.clock, nowMs);

  const paused = m.phase === "PAUSED";
  // 일시정지 중에는 멈추기 전 상태(pausedFrom)의 값을 그대로 보여 준다
  const shown = paused ? m.pausedFrom : m.phase;
  const pausedRemaining = paused ? (m.remainingMs ?? 0) : null;

  let label = "";
  let big = "";
  let sub = "";
  let gauge: number | null = null; // 0~1, 휴식일 때만

  if (shown === "COUNTDOWN") {
    label = "준비";
    big = String(countdownDisplay(pausedRemaining !== null ? COUNTDOWN_MS - pausedRemaining : el));
    sub = "곧 시작해요";
  } else if (shown === "EXERCISE") {
    label = "운동";
    big = String(currentReps(session, nowMs));
    sub = `/ ${ex.reps}`;
  } else if (shown === "REST") {
    const remaining = pausedRemaining ?? restRemainingMs(el, ex.restSec);
    label = "휴식";
    big = String(Math.ceil(remaining / 1000));
    sub = "초";
    gauge = ex.restSec > 0 ? remaining / (ex.restSec * 1000) : 0;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">{ex.name}</h1>
        <p className="text-sm text-muted">
          세트 {m.setIndex + 1}/{ex.sets}
        </p>
      </header>

      <div
        className="flex flex-1 flex-col items-center justify-center gap-2"
        role="status"
        aria-live="off"
      >
        {paused ? (
          <p className="text-lg font-bold text-amber-300">일시정지 · {label}</p>
        ) : (
          <p
            className={`text-lg font-medium ${shown === "REST" ? "text-sky-300" : "text-accent"}`}
          >
            {label}
          </p>
        )}
        <p
          className={`text-[9rem] font-bold leading-none tabular-nums ${paused ? "opacity-40" : ""}`}
        >
          {big}
        </p>
        <p className="text-2xl text-muted">{sub}</p>
        {paused && awayPaused && (
          <p role="alert" className="mt-4 text-center text-base text-amber-200">
            화면에서 벗어나 일시정지했어요. 이어하기를 눌러 계속하세요.
          </p>
        )}

        {gauge !== null && (
          <div
            className="mt-6 h-3 w-full overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-label="남은 휴식 시간"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(gauge * 100)}
          >
            <div
              className="h-full rounded-full bg-sky-300"
              style={{ width: `${gauge * 100}%` }}
            />
          </div>
        )}
      </div>

      {(wakeLockStatus === "unsupported" || wakeLockStatus === "failed") && (
        <p className="mb-3 text-center text-sm text-muted">
          {wakeLockStatus === "unsupported"
            ? "이 기기에서는 화면 꺼짐 방지를 쓸 수 없어요. 화면이 꺼지지 않게 직접 설정해 주세요."
            : "화면 꺼짐 방지를 켜지 못했어요. 화면이 꺼지면 소리가 끊길 수 있어요."}
        </p>
      )}
      <div className="mb-3 grid grid-cols-2 gap-3">
        {paused ? (
          <button
            type="button"
            onClick={onResume}
            className="min-h-14 rounded-2xl bg-accent px-4 text-xl font-bold text-black"
          >
            이어하기
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className="min-h-14 rounded-2xl bg-surface px-4 text-xl font-bold"
          >
            일시정지
          </button>
        )}
        {/* 세트 건너뛰기는 운동 중(EXERCISE)에만 켠다. 카운트다운·휴식·일시정지 중에는 꺼 둔다 */}
        <button
          type="button"
          onClick={onSkip}
          disabled={m.phase !== "EXERCISE"}
          className="min-h-14 rounded-2xl bg-surface px-4 text-xl font-bold disabled:cursor-not-allowed disabled:opacity-30"
        >
          건너뛰기
        </button>
      </div>
      <button
        type="button"
        onClick={onEnd}
        className="min-h-11 rounded-xl px-4 text-base text-muted"
      >
        전체 종료
      </button>
    </main>
  );
}
