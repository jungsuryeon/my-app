"use client";

import { useRef, useState } from "react";
import { regionOf } from "@/lib/exerciseCatalog";
import {
  MY_ROUTINE_LIMITS,
  checkRoutineInput,
  createRoutine,
  exerciseFromCatalog,
  moveItem,
  updateRoutine,
} from "@/lib/myRoutines";
import { toInput, validateInput, type Exercise, type ExerciseInput, type FieldName } from "@/lib/routines";
import DeleteRecordDialog from "./DeleteRecordDialog";
import ExerciseFilters, { EMPTY_FILTER, applyFilter, type ExerciseFilter } from "./ExerciseFilters";

/** 편집을 시작할 때의 내용. id가 null이면 새 루틴 */
export type RoutineDraft = { id: string | null; name: string; exercises: Exercise[] };

type Props = {
  draft: RoutineDraft;
  /** 저장하지 않고 나간다 */
  onCancel: () => void;
  /** 저장했다. 부르는 쪽이 안내를 띄우고 홈으로 돌아간다 */
  onSaved: (message: string, wasNew: boolean) => void;
};

/** 편집 중인 운동 한 칸: uid는 같은 운동이 두 번 들어가도 구분하기 위한 번호 */
type Item = { uid: number; exercise: Exercise; input: ExerciseInput };

const FIELDS: { name: FieldName; label: string; unit: string; decimal?: boolean; optional?: boolean }[] = [
  { name: "reps", label: "반복", unit: "회" },
  { name: "sets", label: "세트", unit: "개" },
  { name: "restSec", label: "휴식", unit: "초" },
  { name: "tempoSec", label: "템포", unit: "초", decimal: true },
  { name: "weightKg", label: "무게", unit: "kg", decimal: true, optional: true },
];

// 루틴 만들기·수정 화면: 이름, 운동 추가·순서·빼기, 운동별 반복·세트·휴식·템포·무게를 정해 저장한다.
export default function RoutineEditor({ draft, onCancel, onSaved }: Props) {
  const nextUid = useRef(draft.exercises.length);
  const [name, setName] = useState(draft.name);
  const [items, setItems] = useState<Item[]>(() =>
    draft.exercises.map((e, i) => ({ uid: i, exercise: e, input: toInput(e) })),
  );
  const [picking, setPicking] = useState(false);
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_FILTER);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const editing = draft.id !== null;
  const full = items.length >= MY_ROUTINE_LIMITS.exercisesPerRoutine;
  // 처음과 달라졌으면 나갈 때 한 번 더 묻는다
  const dirty =
    JSON.stringify([name, items.map((it) => [it.exercise.id, it.input])]) !==
    JSON.stringify([draft.name, draft.exercises.map((e) => [e.id, toInput(e)])]);

  function setInput(uid: number, field: FieldName, value: string) {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, input: { ...it.input, [field]: value } } : it)));
  }

  function handleSave() {
    setShowErrors(true);
    const exercises: Exercise[] = [];
    for (const it of items) {
      const v = validateInput(it.input).values;
      if (!v) {
        setError("빨간 표시된 값을 고쳐 주세요.");
        return;
      }
      exercises.push({ ...it.exercise, ...v });
    }
    const check = checkRoutineInput(name, exercises);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    const r = draft.id ? updateRoutine(draft.id, name, exercises) : createRoutine(name, exercises);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    onSaved(draft.id ? "루틴을 수정했어요." : "내 루틴을 저장했어요.", draft.id === null);
  }

  // ── 운동 추가: 검색해서 고르면 목록 끝에 기본값으로 들어간다 ──
  if (picking) {
    const results = applyFilter(filter);
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPicking(false)}
            aria-label="루틴 편집으로"
            className="-ml-2 min-h-11 min-w-11 rounded-xl px-2 text-lg"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">운동 추가</h1>
        </header>
        <ExerciseFilters value={filter} onChange={setFilter} idPrefix="pick" />
        <section aria-label="추가할 운동" className="flex flex-col gap-2">
          {results.length === 0 ? (
            <p className="text-base">맞는 운동이 없어요. 다른 이름이나 조건으로 찾아 보세요.</p>
          ) : (
            results.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  const ex = exerciseFromCatalog(c);
                  setItems((prev) => [...prev, { uid: nextUid.current++, exercise: ex, input: toInput(ex) }]);
                  setPicking(false);
                }}
                className="flex min-h-16 flex-col items-start justify-center rounded-2xl bg-surface px-4 py-3 text-left active:opacity-70"
              >
                <span className="text-lg font-bold">{c.name}</span>
                <span className="text-sm text-muted">
                  {regionOf(c)} · {c.bodyPart} · {c.equipment}
                </span>
              </button>
            ))
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (dirty ? setConfirmCancel(true) : onCancel())}
          aria-label="취소"
          className="-ml-2 min-h-11 min-w-11 rounded-xl px-2 text-lg"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">{editing ? "루틴 수정" : "루틴 만들기"}</h1>
      </header>

      <div>
        <label htmlFor="routine-name" className="mb-1 block text-sm text-muted">
          루틴 이름
        </label>
        <input
          id="routine-name"
          type="text"
          autoComplete="off"
          maxLength={MY_ROUTINE_LIMITS.nameMax * 2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`최대 ${MY_ROUTINE_LIMITS.nameMax}글자 (예: 가슴 데이)`}
          className="min-h-11 w-full rounded-xl bg-surface px-3 text-base outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <section aria-label="루틴 운동" className="flex flex-col gap-3">
        {items.length === 0 && <p className="text-sm text-muted">아직 운동이 없어요. 아래에서 추가해 주세요.</p>}
        {items.map((it, i) => {
          const { errors } = validateInput(it.input);
          return (
            <div key={it.uid} className="rounded-2xl bg-surface p-3">
              <div className="flex items-center gap-1">
                <p className="flex-1 pl-1">
                  <span className="text-muted">{i + 1}. </span>
                  <span className="font-bold">{it.exercise.name}</span>
                </p>
                <button
                  type="button"
                  aria-label={`${it.exercise.name} 위로`}
                  disabled={i === 0}
                  onClick={() => setItems(moveItem(items, i, -1))}
                  className="min-h-11 min-w-11 rounded-xl text-lg disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`${it.exercise.name} 아래로`}
                  disabled={i === items.length - 1}
                  onClick={() => setItems(moveItem(items, i, 1))}
                  className="min-h-11 min-w-11 rounded-xl text-lg disabled:opacity-30"
                >
                  ▼
                </button>
                <button
                  type="button"
                  aria-label={`${it.exercise.name} 빼기`}
                  onClick={() => setItems(items.filter((x) => x.uid !== it.uid))}
                  className="min-h-11 min-w-11 rounded-xl text-lg text-red-300"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FIELDS.map((f) => {
                  const err = showErrors ? errors[f.name] : undefined;
                  return (
                    <div key={f.name} className={f.name === "weightKg" ? "col-span-2" : ""}>
                      <label htmlFor={`f-${it.uid}-${f.name}`} className="mb-1 block text-xs text-muted">
                        {f.label}
                        {f.optional ? " (선택)" : ""}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id={`f-${it.uid}-${f.name}`}
                          type="text"
                          inputMode={f.decimal ? "decimal" : "numeric"}
                          autoComplete="off"
                          value={it.input[f.name]}
                          onChange={(e) => setInput(it.uid, f.name, e.target.value)}
                          aria-invalid={err ? true : undefined}
                          aria-label={`${it.exercise.name} ${f.label}`}
                          className={`min-h-11 w-full rounded-xl bg-background px-3 text-base outline-none focus:ring-2 ${
                            err ? "ring-2 ring-red-400" : "focus:ring-accent"
                          }`}
                        />
                        <span className="text-sm text-muted">{f.unit}</span>
                      </div>
                      {err && (
                        <p role="alert" className="mt-1 text-xs text-red-400">
                          {err}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          disabled={full}
          onClick={() => setPicking(true)}
          className="min-h-12 rounded-2xl bg-white/10 px-4 text-base font-bold disabled:opacity-40"
        >
          + 운동 추가
        </button>
        {full && (
          <p className="text-sm text-muted">한 루틴에는 운동을 {MY_ROUTINE_LIMITS.exercisesPerRoutine}개까지 담을 수 있어요.</p>
        )}
      </section>

      <p className="text-sm text-muted">
        여기서 정한 값이 루틴의 기본값이에요. 운동 전 준비 화면에서는 이번 운동에만 바꿀 수 있어요. 이 루틴은 이
        폰에만 저장돼요.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleSave}
        className="sticky bottom-4 mt-auto min-h-14 rounded-2xl bg-accent px-4 text-lg font-bold text-black shadow-lg"
      >
        {editing ? "수정 저장" : "루틴 저장"}
      </button>

      {confirmCancel && (
        <DeleteRecordDialog
          title="작성을 그만둘까요?"
          label={name.trim() || (editing ? "루틴 수정" : "새 루틴")}
          note="저장하지 않은 내용은 사라져요."
          confirmText="나가기"
          cancelText="계속 작성"
          error={null}
          onCancel={() => setConfirmCancel(false)}
          onConfirm={onCancel}
        />
      )}
    </main>
  );
}
