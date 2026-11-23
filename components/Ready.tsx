"use client";

import { useState } from "react";
import { initAudio, playBeep, speakKorean } from "@/lib/audio";
import { PHRASES, setDonePhrase } from "@/lib/cues";
import {
  toInput,
  validateInput,
  type Exercise,
  type ExerciseInput,
  type FieldName,
  type Routine,
} from "@/lib/routines";

export type ReadyValues = NonNullable<ReturnType<typeof validateInput>["values"]>;

type Props = {
  routine: Routine;
  exerciseIndex: number;
  /** 왼쪽 위 "←": 홈으로 */
  onBack: () => void;
  /** 입력 값이 모두 올바를 때 "운동 시작"을 누르면 호출 */
  onStart: (values: ReadyValues) => void;
};

const FIELDS: { name: FieldName; label: string; unit: string; decimal?: boolean; optional?: boolean }[] = [
  { name: "reps", label: "반복", unit: "회" },
  { name: "sets", label: "세트", unit: "개" },
  { name: "restSec", label: "휴식", unit: "초" },
  { name: "tempoSec", label: "템포", unit: "초", decimal: true },
  { name: "weightKg", label: "무게", unit: "kg", decimal: true, optional: true },
];

// 운동 준비 화면(READY). 첫 운동과 운동 사이 준비 화면에서 같은 화면을 쓴다.
// 부모가 운동이 바뀔 때 key를 바꿔 주면 입력칸이 그 운동의 값으로 새로 시작한다.
export default function Ready({ routine, exerciseIndex, onBack, onStart }: Props) {
  const exercise: Exercise = routine.exercises[exerciseIndex];
  const [input, setInput] = useState<ExerciseInput>(() => toInput(exercise));
  const [audioMsg, setAudioMsg] = useState("");

  const { errors, values } = validateInput(input);

  function change(name: FieldName, value: string) {
    setInput((prev) => ({ ...prev, [name]: value }));
  }

  function handleStart() {
    if (!values) return; // 값이 틀리면 시작하지 않는다(버튼도 막혀 있다)
    // 오디오는 반드시 이 버튼을 누른 클릭 처리 안에서 켠다(iPhone 규칙)
    initAudio();
    speakKorean(PHRASES.start);
    onStart(values);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="홈으로"
          className="min-h-11 min-w-11 rounded-xl bg-surface px-3 text-lg"
        >
          ←
        </button>
        <p className="text-sm text-muted">
          {routine.name} · {exerciseIndex + 1}/{routine.exercises.length}
        </p>
      </header>

      <h1 className="text-2xl font-bold">{exercise.name}</h1>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleStart();
        }}
        noValidate
      >
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.name} className={f.name === "weightKg" ? "col-span-2" : ""}>
              <label htmlFor={`f-${f.name}`} className="mb-1 block text-sm text-muted">
                {f.label}
                {f.optional ? " (선택)" : ""}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`f-${f.name}`}
                  type="text"
                  inputMode={f.decimal ? "decimal" : "numeric"}
                  autoComplete="off"
                  value={input[f.name]}
                  onChange={(e) => change(f.name, e.target.value)}
                  aria-invalid={errors[f.name] ? true : undefined}
                  aria-describedby={errors[f.name] ? `e-${f.name}` : undefined}
                  className={`min-h-11 w-full rounded-xl bg-surface px-3 text-base outline-none focus:ring-2 ${
                    errors[f.name] ? "ring-2 ring-red-400" : "focus:ring-accent"
                  }`}
                />
                <span className="text-sm text-muted">{f.unit}</span>
              </div>
              {errors[f.name] && (
                <p id={`e-${f.name}`} role="alert" className="mt-1 text-sm text-red-400">
                  {errors[f.name]}
                </p>
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={!values}
          className="min-h-12 rounded-2xl bg-accent px-4 text-lg font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          운동 시작
        </button>
        {!values && (
          <p className="text-sm text-red-400">값을 올바르게 고치면 시작할 수 있어요.</p>
        )}
      </form>

      {/* ⚠ 임시: 작업 8~11 소리 확인용. 정식 "소리 테스트" 버튼과 안내문이 생기는 작업 18에서 지운다. */}
      <section className="mt-auto flex flex-col gap-2 rounded-2xl border border-dashed border-accent/40 p-4">
        <h2 className="text-sm font-medium text-accent">임시: 소리 확인</h2>
        <button
          type="button"
          onClick={() => {
            const ok = initAudio();
            if (ok) playBeep("rep");
            setAudioMsg(ok ? "오디오 켬 — 짧은 소리가 났나요?" : "이 브라우저에서는 오디오를 켤 수 없어요");
          }}
          className="min-h-11 rounded-xl bg-surface px-4 text-base"
        >
          오디오 켜기 + 반복 비프
        </button>
        <button
          type="button"
          onClick={() => playBeep("setDone")}
          className="min-h-11 rounded-xl bg-surface px-4 text-base"
        >
          세트 완료 비프(길게)
        </button>
        <button
          type="button"
          onClick={() => [0, 1, 2].forEach((s) => playBeep("countdown", s))}
          className="min-h-11 rounded-xl bg-surface px-4 text-base"
        >
          휴식 3·2·1 비프 듣기
        </button>
        <button
          type="button"
          onClick={() => {
            const ok = speakKorean(setDonePhrase(1, exercise.restSec));
            setAudioMsg(ok ? "음성 재생 요청함" : "한국어 음성을 쓸 수 없어요(오디오 켜기를 먼저 누르세요)");
          }}
          className="min-h-11 rounded-xl bg-surface px-4 text-base"
        >
          음성 듣기 (1번째 세트 완료)
        </button>
        {audioMsg && <p className="text-sm text-muted">{audioMsg}</p>}
      </section>
    </main>
  );
}
