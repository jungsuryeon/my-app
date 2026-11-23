"use client";

import { useEffect, useState } from "react";
import EndDialog from "@/components/EndDialog";
import Finish from "@/components/Finish";
import Home from "@/components/Home";
import Progress from "@/components/Progress";
import Ready from "@/components/Ready";
import { useWorkout } from "@/components/useWorkout";
import { loadSnapshot } from "@/lib/records";
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

  // 복원했을 때 보여 주는 안내 문구(닫을 수 있다)
  const [notice, setNotice] = useState<string | null>(null);

  // 화면이 그려진 뒤 한 번, 저장해 둔 진행 상태가 있으면 되살린다(localStorage는 여기서만 읽는다)
  const { restore } = workout;
  useEffect(() => {
    const r = loadSnapshot(Date.now());
    if (r.kind === "none") return;
    // PRD: localStorage는 화면이 그려진 뒤(useEffect)에만 읽는다. 저장소(외부 시스템) 값을 한 번 상태로 옮기는
    // 것이라 effect 안에서 상태를 바꿀 수밖에 없다(마운트 때 한 번만 실행).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected({ ...r.routine, exercises: r.session.exercises });
    restore(r);
    setNotice(r.notice);
  }, [restore]);

  function goHome() {
    workout.exit();
    setSelected(null);
    setEndDialog(null);
    setNotice(null);
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

  // 복원 안내와 저장 실패 경고. 어느 화면에서든 맨 위에 보인다
  const banners = (
    <>
      {notice && (
        <div
          role="status"
          className="mx-auto flex w-full max-w-md items-start justify-between gap-3 bg-amber-300/15 px-4 py-3 text-sm text-amber-100"
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="min-h-6 shrink-0 underline">
            닫기
          </button>
        </div>
      )}
      {workout.snapshotFailed && (
        <p role="alert" className="mx-auto w-full max-w-md bg-red-400/15 px-4 py-2 text-sm text-red-200">
          진행 상태를 저장하지 못했어요. 지금 새로고침하면 운동이 사라질 수 있어요.
        </p>
      )}
    </>
  );

  const screen = (() => {
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
              awayPaused={workout.awayPaused}
            wakeLockStatus={workout.wakeLockStatus}
              onSkip={workout.skip}
              onEnd={openEndDialog}
            />
            {dialog}
          </>
        );
      }

      // COMPLETED: 종료 화면. 세트별 반복 수를 확인·수정한다(저장 버튼은 작업 20에서 만든다)
      return <Finish session={session} onEditReps={workout.editReps} onHome={goHome} />;
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
            workout.begin(exercises, { id: selected.id, name: selected.name });
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
  })();

  return (
    <>
      {banners}
      {screen}
    </>
  );
}
