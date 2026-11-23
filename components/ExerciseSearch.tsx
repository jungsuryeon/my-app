"use client";

import { useState } from "react";
import { MY_ROUTINE_LIMITS } from "@/lib/myRoutines";
import { makeTempRoutine, regionOf, type CatalogExercise } from "@/lib/exerciseCatalog";
import type { Routine } from "@/lib/routines";
import GifView from "./GifView";
import ExerciseFilters, { EMPTY_FILTER, applyFilter, type ExerciseFilter } from "./ExerciseFilters";

type Props = {
  /** "이 운동으로 시작": 만든 임시 루틴을 기존 준비 화면으로 넘긴다 */
  onStart: (routine: Routine) => void;
  /** 루틴에 담은 운동 key들(탭을 옮겨 다녀도 유지되도록 부모가 들고 있다) */
  cart: string[];
  onCartChange: (keys: string[]) => void;
  /** "루틴 만들기": 담은 운동으로 루틴 편집 화면을 연다 */
  onOpenEditor: () => void;
};

// 운동 찾기 탭: 한국어 운동 목록에서 찾고, 고른 운동의 동작 GIF와 정보를 보고, 루틴에 담거나 그 운동으로 바로 시작한다.
export default function ExerciseSearch({ onStart, cart, onCartChange, onOpenEditor }: Props) {
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_FILTER);
  const [selected, setSelected] = useState<CatalogExercise | null>(null);

  const full = cart.length >= MY_ROUTINE_LIMITS.exercisesPerRoutine;

  if (selected) {
    const inCart = cart.includes(selected.key);
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="목록으로"
            className="-ml-2 min-h-11 min-w-11 rounded-xl px-2 text-lg"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">{selected.name}</h1>
        </header>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["구분", regionOf(selected)],
            ["부위", selected.bodyPart],
            ["기구", selected.equipment],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-surface shadow-card px-2 py-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-1 font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <GifView item={selected} />
        <div className="mt-auto grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!inCart && full}
            onClick={() =>
              onCartChange(inCart ? cart.filter((k) => k !== selected.key) : [...cart, selected.key])
            }
            className="min-h-14 rounded-2xl bg-chip px-4 text-lg font-bold disabled:opacity-40"
          >
            {inCart ? "담김 ✓ 빼기" : "루틴에 추가"}
          </button>
          <button
            type="button"
            onClick={() => onStart(makeTempRoutine(selected))}
            className="min-h-14 rounded-2xl bg-accent px-4 text-lg font-bold text-on-accent"
          >
            이 운동으로 시작
          </button>
        </div>
        {!inCart && full && (
          <p className="text-sm text-muted">
            한 루틴에는 운동을 {MY_ROUTINE_LIMITS.exercisesPerRoutine}개까지 담을 수 있어요.
          </p>
        )}
      </main>
    );
  }

  const results = applyFilter(filter);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">운동 찾기</h1>
      </header>

      <ExerciseFilters value={filter} onChange={setFilter} />

      <section aria-label="검색 결과" className="flex flex-col gap-2">
        {results.length === 0 ? (
          <p className="text-base">맞는 운동이 없어요. 다른 이름이나 조건으로 찾아 보세요.</p>
        ) : (
          results.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setSelected(c)}
              className="flex min-h-16 flex-col items-start justify-center rounded-2xl bg-surface shadow-card px-4 py-3 text-left active:opacity-70"
            >
              <span className="text-lg font-bold">
                {c.name}
                {cart.includes(c.key) && <span className="ml-2 text-sm text-accent-ink">담김</span>}
              </span>
              <span className="text-sm text-muted">
                {regionOf(c)} · {c.bodyPart} · {c.equipment}
              </span>
            </button>
          ))
        )}
      </section>

      {cart.length > 0 && (
        <button
          type="button"
          onClick={onOpenEditor}
          className="sticky bottom-[calc(6.25rem+env(safe-area-inset-bottom))] mt-auto min-h-14 rounded-2xl bg-accent px-4 text-lg font-bold text-on-accent shadow-lg"
        >
          담은 운동 {cart.length}개 · 루틴 만들기
        </button>
      )}
    </main>
  );
}
