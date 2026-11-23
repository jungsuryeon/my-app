"use client";

import { SAMPLE_ROUTINES } from "@/lib/routines";

type Props = {
  /** 루틴 카드를 누르면 그 루틴의 id로 호출 */
  onSelectRoutine: (routineId: string) => void;
};

// 홈 화면. 닉네임·최근 기록·데이터 초기화는 이후 작업에서 채운다.
export default function Home({ onSelectRoutine }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">RepTimer</h1>
        <p className="mt-1 text-sm text-muted">
          반복·세트·휴식을 자동으로 진행해 드려요.
        </p>
      </header>

      <section aria-labelledby="recent-title" className="rounded-2xl bg-surface p-4">
        <h2 id="recent-title" className="text-sm font-medium text-muted">
          최근 기록
        </h2>
        <p className="mt-2 text-base">아직 기록이 없습니다</p>
      </section>

      <section aria-labelledby="routine-title" className="flex flex-col gap-3">
        <h2 id="routine-title" className="text-sm font-medium text-muted">
          루틴
        </h2>
        {SAMPLE_ROUTINES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelectRoutine(r.id)}
            className="flex min-h-16 flex-col items-start justify-center rounded-2xl bg-surface px-4 py-3 text-left active:opacity-70"
          >
            <span className="text-lg font-bold">{r.name}</span>
            <span className="text-sm text-muted">
              {r.exercises.map((e) => e.name).join(" · ")}
            </span>
          </button>
        ))}
      </section>
    </main>
  );
}
