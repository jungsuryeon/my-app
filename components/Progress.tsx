"use client";

import { currentReps, type Session } from "@/lib/session";
import { countdownDisplay, elapsedMs, restRemainingMs } from "@/lib/timer";

type Props = {
  session: Session;
  /** 지금 시각(performance.now). 틱마다 바뀌어 화면이 다시 그려진다 */
  nowMs: number;
  /** ⚠ 임시: 일시정지(작업 14)·전체 종료(작업 15) 버튼이 생기기 전까지 중단용으로만 둔다 */
  onAbort: () => void;
};

// 운동 진행 화면: COUNTDOWN / EXERCISE / REST 세 상태를 보여 준다.
// 계산은 하지 않고 lib/의 결과만 보여 준다.
export default function Progress({ session, nowMs, onAbort }: Props) {
  const m = session.machine;
  const ex = session.exercises[m.exerciseIndex];
  const el = elapsedMs(session.clock, nowMs);

  let label = "";
  let big = "";
  let sub = "";
  let gauge: number | null = null; // 0~1, 휴식일 때만

  if (m.phase === "COUNTDOWN") {
    label = "준비";
    big = String(countdownDisplay(el));
    sub = "곧 시작해요";
  } else if (m.phase === "EXERCISE") {
    label = "운동";
    big = String(currentReps(session, nowMs));
    sub = `/ ${ex.reps}`;
  } else if (m.phase === "REST") {
    const remaining = restRemainingMs(el, ex.restSec);
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
        <p
          className={`text-lg font-medium ${m.phase === "REST" ? "text-sky-300" : "text-accent"}`}
        >
          {label}
        </p>
        <p className="text-[9rem] font-bold leading-none tabular-nums">{big}</p>
        <p className="text-2xl text-muted">{sub}</p>

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

      {/* ⚠ 임시 버튼(작업 14·15에서 일시정지·건너뛰기·전체 종료로 교체) */}
      <button
        type="button"
        onClick={onAbort}
        className="min-h-11 rounded-xl bg-surface px-4 text-base text-muted"
      >
        임시: 중단하고 홈으로
      </button>
    </main>
  );
}
