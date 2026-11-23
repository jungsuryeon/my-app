"use client";

import { formatClock, formatDuration, recordTime } from "@/lib/calendar";
import { countSets, type WorkoutRecord } from "@/lib/records";

type Props = {
  record: WorkoutRecord;
  onBack: () => void;
  /** "기록 삭제" 버튼: 확인창을 여는 쪽에서 처리한다 */
  onDelete: () => void;
};

/** "11월 3일 (월) 오후 3:05" */
export function recordTitle(rec: WorkoutRecord): string {
  const d = new Date(recordTime(rec));
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd}) ${formatClock(d.getTime())}`;
}

// 운동 기록 상세: 운동별 세트 결과와 무게, 총 운동 시간
export default function RecordDetail({ record, onBack, onDelete }: Props) {
  const { done, total } = countSets(record);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="달력으로"
          className="-ml-2 min-h-11 min-w-11 rounded-xl px-2 text-lg"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">{record.routineName}</h1>
      </header>

      <section className="rounded-2xl bg-surface p-4">
        <p className="text-base">{recordTitle(record)}</p>
        <p className="mt-1 text-sm text-muted">
          완료 {done}/{total}세트 · 운동 시간 {formatDuration(record.activeSec)}
        </p>
      </section>

      {record.exercises.map((ex, i) => (
        <section key={i} className="rounded-2xl bg-surface p-4">
          <h2 className="text-lg font-bold">{ex.name}</h2>
          <p className="text-sm text-muted">무게 {ex.weightKg === null ? "-" : `${ex.weightKg}kg`}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {ex.sets.map((s, j) => (
              <li key={j} className="flex justify-between text-base">
                <span>{j + 1}세트</span>
                <span className={s.status === "완료" ? "" : "text-muted"}>
                  {s.status} · {s.reps}/{s.targetReps}회
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <button
        type="button"
        onClick={onDelete}
        className="mt-auto min-h-12 rounded-2xl bg-red-400/20 px-4 text-lg font-bold text-red-200"
      >
        기록 삭제
      </button>
    </main>
  );
}
