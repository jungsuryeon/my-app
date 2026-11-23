"use client";

import { useState } from "react";
import Home from "@/components/Home";
import Ready, { type ReadyValues } from "@/components/Ready";
import { cloneRoutine, type Routine } from "@/lib/routines";

// 앱은 이 한 경로(/)의 클라이언트 컴포넌트에서 화면을 바꿔 가며 동작한다.
type Screen =
  | { name: "home" }
  | { name: "ready"; routine: Routine; exerciseIndex: number }
  // ⚠ 임시: 운동 진행 화면(작업 13)이 생기기 전까지 시작 결과만 보여 준다
  | { name: "started"; routine: Routine; exerciseIndex: number; values: ReadyValues };

export default function Page() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  if (screen.name === "home") {
    return (
      <Home
        onSelectRoutine={(id) => {
          const routine = cloneRoutine(id); // 원본 샘플을 건드리지 않도록 복사본으로 시작
          if (routine) setScreen({ name: "ready", routine, exerciseIndex: 0 });
        }}
      />
    );
  }

  if (screen.name === "ready") {
    return (
      <Ready
        // 운동이 바뀌면 입력칸이 그 운동의 값으로 새로 시작하도록 key를 바꾼다
        key={`${screen.routine.id}-${screen.exerciseIndex}`}
        routine={screen.routine}
        exerciseIndex={screen.exerciseIndex}
        onBack={() => setScreen({ name: "home" })}
        onStart={(values) => {
          // 수정한 값을 이 운동의 설정으로 반영한다
          const exercises = screen.routine.exercises.map((e, i) =>
            i === screen.exerciseIndex ? { ...e, ...values } : e,
          );
          setScreen({
            name: "started",
            routine: { ...screen.routine, exercises },
            exerciseIndex: screen.exerciseIndex,
            values,
          });
        }}
      />
    );
  }

  const ex = screen.routine.exercises[screen.exerciseIndex];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{ex.name}</h1>
      <p className="text-muted">
        반복 {ex.reps}회 · {ex.sets}세트 · 휴식 {ex.restSec}초 · 템포 {ex.tempoSec}초 · 무게{" "}
        {ex.weightKg === null ? "-" : `${ex.weightKg}kg`}
      </p>
      <p className="rounded-2xl border border-dashed border-accent/40 p-4 text-sm text-muted">
        임시 화면: 운동 진행 화면은 작업 13에서 만듭니다.
      </p>
      <button
        type="button"
        onClick={() => setScreen({ name: "home" })}
        className="min-h-11 rounded-xl bg-surface px-4 text-base"
      >
        홈으로
      </button>
    </main>
  );
}
