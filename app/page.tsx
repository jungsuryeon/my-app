"use client";

import { useState } from "react";
import EndDialog from "@/components/EndDialog";
import Home from "@/components/Home";
import Progress from "@/components/Progress";
import Ready from "@/components/Ready";
import { useWorkout } from "@/components/useWorkout";
import { cloneRoutine, type Routine } from "@/lib/routines";

// 앱은 이 한 경로(/)의 클라이언트 컴포넌트에서 화면을 바꿔 가며 동작한다.
// 화면은 상태로 정해진다: 세션이 없으면 홈/첫 준비 화면, 있으면 세션 상태(READY·진행·종료)에 따른 화면.
export default function Page() {
  const workout = useWorkout();
  const { session } = workout;
  // 홈에서 고른 루틴(복사본). 세션이 시작되면 값은 세션이 들고 있다.
  const [selected, setSelected] = useState<Routine | null>(null);
  // 전체 종료 확인창. 열려 있으면 값이 있고, resumeRunning은 "계속하기" 때 진행을 이어가야 하는지
  const [endDialog, setEndDialog] = useState<{ resumeRunning: boolean } | null>(null);

  function goHome() {
    workout.exit();
    setSelected(null);
    setEndDialog(null);
  }

  /** "전체 종료" 탭: 진행 중이면 먼저 멈추고 확인창을 연다 */
  function openEndDialog() {
    const resumeRunning = workout.requestEnd();
    if (resumeRunning === null) return; // 연속 클릭은 무시
    setEndDialog({ resumeRunning });
  }

  const dialog = endDialog && (
    <EndDialog
      onContinue={() => {
        workout.cancelEnd(endDialog.resumeRunning);
        setEndDialog(null);
      }}
      onSaveAndEnd={() => {
        workout.finish();
        setEndDialog(null);
      }}
      onDiscard={goHome}
    />
  );

  // ── 세션 진행 중 ──
  if (session && selected) {
    const phase = session.machine.phase;

    if (phase === "READY") {
      // 운동 사이 다음 운동 준비 화면(같은 화면 재사용). 여기서는 홈으로 나가는 길이 없고 "전체 종료"만 있다
      const idx = session.machine.exerciseIndex;
      return (
        <>
          <Ready
            key={`${selected.id}-${idx}`}
            routine={{ ...selected, exercises: session.exercises }}
            exerciseIndex={idx}
            onBack={openEndDialog}
            backLabel="전체 종료"
            onStart={(values) => workout.startNext(values)}
          />
          {dialog}
        </>
      );
    }

    if (phase === "COUNTDOWN" || phase === "EXERCISE" || phase === "REST" || phase === "PAUSED") {
      return (
        <>
          <Progress
            session={session}
            nowMs={workout.nowMs}
            onPause={workout.pause}
            onResume={workout.resume}
            onSkip={workout.skip}
            onEnd={openEndDialog}
          />
          {dialog}
        </>
      );
    }

    // COMPLETED 등: ⚠ 임시 화면. 종료 화면(반복 수 확인·저장)은 작업 19·20에서 만든다
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-6">
        <h1 className="text-3xl font-bold">운동 끝!</h1>
        <p className="text-sm text-muted">임시 화면: 종료·저장 화면은 작업 19·20에서 만듭니다.</p>
        <button
          type="button"
          onClick={goHome}
          className="min-h-11 rounded-xl bg-surface px-4 text-base"
        >
          홈으로
        </button>
      </main>
    );
  }

  // ── 첫 운동 준비 화면 ──
  if (selected) {
    return (
      <Ready
        key={selected.id}
        routine={selected}
        exerciseIndex={0}
        onBack={() => setSelected(null)}
        onStart={(values) => {
          // 고친 값을 첫 운동에 반영해 세션을 시작한다
          const exercises = selected.exercises.map((e, i) => (i === 0 ? { ...e, ...values } : e));
          workout.begin(exercises);
        }}
      />
    );
  }

  return (
    <Home
      onSelectRoutine={(id) => {
        const routine = cloneRoutine(id); // 원본 샘플을 건드리지 않도록 복사본으로 시작
        if (routine) setSelected(routine);
      }}
    />
  );
}
