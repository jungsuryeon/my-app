"use client";

import { useEffect, useState } from "react";
import { loadBody, weightOf, type BodyState } from "@/lib/body";
import { sessionKcal } from "@/lib/calories";
import type { SaveResult } from "@/lib/records";
import { completedSetCount, totalSetCount, type SetStatus } from "@/lib/machine";
import { EDIT_REPS_MAX, EDIT_REPS_MIN, activeTotalMs, type Session } from "@/lib/session";

type Props = {
  session: Session;
  /** 세트 하나의 반복 수를 고쳤을 때 */
  onEditReps: (exerciseIndex: number, setIndex: number, reps: number) => void;
  /** 기록 저장. 연속 클릭으로 무시되면 null */
  onSave: () => SaveResult | null;
  /** 저장에 성공한 뒤(홈으로 돌아가며 안내를 보여 준다) */
  onSaved: () => void;
  /** 저장 안 하고 버리기를 확인했을 때, 또는 기록할 세트가 없을 때의 [홈으로] */
  onHome: () => void;
};

const STATUS_LABEL: Record<SetStatus, string> = {
  pending: "대기",
  done: "완료",
  skipped: "건너뜀",
  notDone: "미수행",
};

/** 밀리초 → "3분 12초" */
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

// 종료 화면: 세트별 반복 수를 확인하고 고친다. 운동 중에는 고치지 않고 끝난 뒤에만 고칠 수 있다.
// 고치지 않으면 자동으로 센 값(예상값)이 그대로 기록된다.
export default function Finish({ session, onEditReps, onSave, onSaved, onHome }: Props) {
  // 저장 버튼은 한 번 누르면 비활성화한다. 실패하면 다시 눌러 같은 기록을 다시 저장할 수 있다.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // 칼로리 계산용 체중(PRD: localStorage는 화면이 그려진 뒤에 읽는다). null = 읽기 전
  const [body, setBody] = useState<BodyState | null>(null);
  useEffect(() => {
    // 저장소 값을 한 번 상태로 옮기는 것이라 effect 안에서 상태를 바꿀 수밖에 없다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBody(loadBody());
  }, []);

  function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = onSave();
    if (result === null) {
      setSaving(false); // 연속 클릭으로 무시됨
    } else if (result.ok) {
      onSaved();
    } else {
      setError(result.message); // 조용히 넘기지 않고 알린다
      setSaving(false);
    }
  }

  const m = session.machine;
  const done = completedSetCount(m);
  const total = totalSetCount(m);
  const activeMs = activeTotalMs(session, 0);
  // 체중이 있을 때만 계산한다(저장되는 값은 저장 시점의 체중으로 같은 식으로 다시 계산한다)
  const kcal = sessionKcal(weightOf(body), session);

  // 완료한 세트가 하나도 없으면 기록할 것이 없다
  if (done === 0) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-6">
        <h1 className="text-2xl font-bold">기록할 세트가 없어요</h1>
        <p className="text-center text-sm text-muted">완료한 세트가 없어서 저장하지 않아요.</p>
        <button
          type="button"
          onClick={onHome}
          className="min-h-12 w-full rounded-2xl bg-accent px-4 text-lg font-bold text-on-accent"
        >
          홈으로
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">운동 끝!</h1>
        <p className="mt-1 text-sm text-muted">
          완료 {done}/{total}세트 · 운동 시간 {formatDuration(activeMs)}
        </p>
        <p className="mt-1 text-sm text-muted">
          반복 수는 설정한 템포로 센 예상값이에요. 실제와 다르면 고쳐 주세요.
        </p>
      </header>

      {body !== null && (
        <section aria-label="예상 소모 칼로리" className="rounded-2xl bg-surface shadow-card p-4">
          {kcal !== null ? (
            <>
              <p className="text-sm text-muted">예상 소모 칼로리</p>
              <p className="mt-1 text-2xl font-bold">
                약 {kcal} <span className="text-base font-normal text-muted">kcal</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                체중과 운동·휴식 시간으로 계산한 참고용 추정값이에요. 의학적 조언이나 정확한 측정값이 아니에요.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              홈에서 체중(선택)을 입력하면 예상 소모 칼로리를 볼 수 있어요.
            </p>
          )}
        </section>
      )}

      <div className="flex flex-col gap-4">
        {session.exercises.map((ex, ei) => (
          <section key={ex.id} aria-labelledby={`ex-${ei}`} className="rounded-2xl bg-surface shadow-card p-4">
            <h2 id={`ex-${ei}`} className="mb-2 text-lg font-bold">
              {ex.name}
              <span className="ml-2 text-sm font-normal text-muted">
                {ex.weightKg === null ? "무게 -" : `${ex.weightKg}kg`}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {m.sets[ei].map((set, si) => {
                const muted = set.status === "skipped" || set.status === "notDone";
                return (
                  <li key={si} className="flex items-center justify-between gap-2">
                    <span className={`w-24 text-sm ${muted ? "text-muted" : ""}`}>
                      {si + 1}세트{" "}
                      <span
                        className={
                          set.status === "done" ? "text-accent-ink" : "text-warn"
                        }
                      >
                        {STATUS_LABEL[set.status]}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`${ex.name} ${si + 1}세트 반복 수 줄이기`}
                        onClick={() => onEditReps(ei, si, set.reps - 1)}
                        disabled={set.reps <= EDIT_REPS_MIN}
                        className="min-h-11 min-w-11 rounded-xl bg-chip text-xl disabled:opacity-30"
                      >
                        −
                      </button>
                      <span
                        className="w-16 text-center text-lg font-bold tabular-nums"
                        aria-label={`${ex.name} ${si + 1}세트 반복 수`}
                      >
                        {set.reps}
                        <span className="text-xs font-normal text-muted">/{set.targetReps}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`${ex.name} ${si + 1}세트 반복 수 늘리기`}
                        onClick={() => onEditReps(ei, si, set.reps + 1)}
                        disabled={set.reps >= EDIT_REPS_MAX}
                        className="min-h-11 min-w-11 rounded-xl bg-chip text-xl disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="min-h-14 rounded-2xl bg-accent px-4 text-xl font-bold text-on-accent disabled:opacity-40"
      >
        {error ? "다시 저장" : saving ? "저장하는 중…" : "기록 저장"}
      </button>

      {confirmDiscard ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface shadow-card p-4">
          <p className="text-sm">이 운동 기록이 삭제돼요. 저장하지 않고 나갈까요?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className="min-h-11 rounded-xl bg-chip px-4"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onHome}
              className="min-h-11 rounded-xl bg-danger-soft px-4 text-danger"
            >
              버리기
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDiscard(true)}
          className="min-h-11 rounded-xl px-4 text-base text-muted"
        >
          저장 안 하고 버리기
        </button>
      )}
    </main>
  );
}
