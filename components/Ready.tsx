"use client";

import { useState } from "react";
import { initAudio, playBeep, speakKorean, waitSpeechReady } from "@/lib/audio";
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
  /** 왼쪽 위 버튼. 첫 운동 준비 화면에서는 "←"(홈으로), 운동 사이 준비 화면에서는 "전체 종료" */
  onBack: () => void;
  /** 왼쪽 위 버튼 글자. 기본은 "←" */
  backLabel?: string;
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
export default function Ready({ routine, exerciseIndex, onBack, backLabel = "←", onStart }: Props) {
  const exercise: Exercise = routine.exercises[exerciseIndex];
  const [input, setInput] = useState<ExerciseInput>(() => toInput(exercise));
  const [testMsg, setTestMsg] = useState("");

  const { errors, values } = validateInput(input);

  function change(name: FieldName, value: string) {
    setInput((prev) => ({ ...prev, [name]: value }));
  }

  /** 소리 테스트: 비프음 두 번과 한국어 음성을 들려준다. 버튼을 누른 탭 안에서 오디오를 켠다(iPhone 규칙). */
  async function handleSoundTest() {
    if (!initAudio()) {
      setTestMsg("이 브라우저에서는 오디오를 켤 수 없어요.");
      return;
    }
    playBeep("rep");
    playBeep("rep", 0.3);
    setTestMsg("소리를 확인하는 중이에요…");
    // 한국어 음성 목록은 늦게 채워질 수 있어 준비될 때까지 기다린다
    const ready = await waitSpeechReady();
    const spoke = ready && speakKorean("소리 테스트입니다. 이 목소리가 들리면 준비됐어요.");
    setTestMsg(
      spoke
        ? "비프음과 음성이 들렸나요? 안 들리면 무음 모드와 이어폰 연결을 확인해 주세요."
        : "한국어 음성을 쓸 수 없어요. 이 기기에서는 비프음으로 안내해요. 비프음이 안 들리면 무음 모드와 이어폰 연결을 확인해 주세요.",
    );
  }

  function handleStart() {
    if (!values) return; // 값이 틀리면 시작하지 않는다(버튼도 막혀 있다)
    // 오디오는 반드시 이 버튼을 누른 클릭 처리 안에서 켠다(iPhone 규칙)
    // 시작 음성은 내지 않는다: 바로 이어지는 3초 카운트다운 삑·삑·삑이 묻히지 않게 하기 위함
    initAudio();
    onStart(values);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel === "←" ? "홈으로" : backLabel}
          className="min-h-11 min-w-11 rounded-full bg-surface shadow-card px-3 text-lg press"
        >
          {backLabel}
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
                  className={`min-h-11 w-full rounded-xl bg-surface shadow-card px-3 text-base outline-none focus:ring-2 ${
                    errors[f.name] ? "ring-2 ring-red-400" : "focus:ring-accent"
                  }`}
                />
                <span className="text-sm text-muted">{f.unit}</span>
              </div>
              {errors[f.name] && (
                <p id={`e-${f.name}`} role="alert" className="mt-1 text-sm text-danger">
                  {errors[f.name]}
                </p>
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={!values}
          className="min-h-12 rounded-3xl bg-accent px-4 text-lg font-bold text-on-accent shadow-button press disabled:cursor-not-allowed disabled:opacity-40"
        >
          운동 시작
        </button>
        {!values && (
          <p className="text-sm text-danger">값을 올바르게 고치면 시작할 수 있어요.</p>
        )}
      </form>

      {/* 소리 안내와 테스트 */}
      <section className="mt-auto flex flex-col gap-3 rounded-3xl bg-surface shadow-card p-4">
        <div className="flex gap-2 text-sm text-muted">
          <span aria-hidden="true">ⓘ</span>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>iPhone이 무음 모드이거나 이어폰 연결이 끊기면 소리가 나지 않거나 폰 스피커로 나올 수 있어요.</li>
            <li>화면이 꺼지면 소리가 끊길 수 있어요. 운동 중에는 화면을 켜 두세요(가능한 기기에서는 꺼지지 않게 해 둬요).</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={handleSoundTest}
          className="min-h-11 rounded-xl bg-chip px-4 text-base font-medium"
        >
          소리 테스트
        </button>
        {testMsg && (
          <p role="status" className="text-sm text-muted">
            {testMsg}
          </p>
        )}
      </section>
    </main>
  );
}
