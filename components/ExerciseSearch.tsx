"use client";

import { useEffect, useState } from "react";
import {
  BODY_PARTS,
  EQUIPMENTS,
  makeTempRoutine,
  searchCatalog,
  type BodyPart,
  type CatalogExercise,
  type Equipment,
} from "@/lib/exerciseCatalog";
import type { Routine } from "@/lib/routines";

type Props = {
  /** 홈으로 돌아간다 */
  onBack: () => void;
  /** "이 운동으로 시작": 만든 임시 루틴을 기존 준비 화면으로 넘긴다 */
  onStart: (routine: Routine) => void;
};

/** GIF 조회 결과. key로 어느 운동의 결과인지 구분한다(다른 운동으로 옮겨 가면 다시 조회) */
type GifState = { key: string; status: "ok"; url: string } | { key: string; status: "none" | "error" };

function GifView({ item }: { item: CatalogExercise }) {
  const [result, setResult] = useState<GifState | null>(null);
  const [imgFailed, setImgFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 운동 설명을 열 때만 조회한다. 응답은 저장하지 않는다(PRD §7·§8).
    fetch(`/api/exercise/${encodeURIComponent(item.key)}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 404) return { key: item.key, status: "none" } as const;
        if (!res.ok) return { key: item.key, status: "error" } as const;
        const body = (await res.json()) as { gifUrl?: unknown };
        return typeof body.gifUrl === "string"
          ? ({ key: item.key, status: "ok", url: body.gifUrl } as const)
          : ({ key: item.key, status: "error" } as const);
      })
      .catch(() => ({ key: item.key, status: "error" }) as const)
      .then((r) => {
        if (!cancelled) setResult(r);
      });
    return () => {
      cancelled = true;
    };
  }, [item.key]);

  const loading = result?.key !== item.key;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-2xl bg-white">
        {loading ? (
          <p className="text-sm text-neutral-500">동작 영상을 불러오는 중…</p>
        ) : result.status === "ok" && imgFailed !== result.url ? (
          // 외부 GIF는 next/image(서버 변환·저장)를 거치지 않고 그대로 보여 준다(저장 금지 약관)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.url}
            alt={`${item.name} 동작`}
            className="max-h-72 w-full object-contain"
            onError={() => setImgFailed(result.url)}
          />
        ) : (
          <p className="px-4 text-center text-sm text-neutral-600">
            {result.status === "none"
              ? "이 운동은 맞는 동작 영상이 없어요."
              : "동작 영상을 불러오지 못했어요. 운동은 그대로 시작할 수 있어요."}
          </p>
        )}
      </div>
      <p className="text-xs text-muted">
        동작 영상은 ExerciseDB에서 불러와요. 이때 이 폰의 IP 주소 등이 ExerciseDB 서버에 전달될 수 있어요. 닉네임과
        운동 기록은 보내지 않아요.
      </p>
    </div>
  );
}

// 운동 찾기: 한국어 운동 목록에서 찾고, 고른 운동의 동작 GIF를 보고, 그 운동으로 바로 시작한다.
export default function ExerciseSearch({ onBack, onStart }: Props) {
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [selected, setSelected] = useState<CatalogExercise | null>(null);

  if (selected) {
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
        <p className="text-sm text-muted">
          {selected.bodyPart} · {selected.equipment}
        </p>
        <GifView item={selected} />
        <button
          type="button"
          onClick={() => onStart(makeTempRoutine(selected))}
          className="mt-auto min-h-14 rounded-2xl bg-accent px-4 text-lg font-bold text-black"
        >
          이 운동으로 시작
        </button>
      </main>
    );
  }

  const results = searchCatalog({ query, bodyPart, equipment });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="홈으로"
          className="-ml-2 min-h-11 min-w-11 rounded-xl px-2 text-lg"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">운동 찾기</h1>
      </header>

      <label htmlFor="exercise-query" className="sr-only">
        운동 이름
      </label>
      <input
        id="exercise-query"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="운동 이름 (예: 체스트프레스)"
        className="min-h-11 rounded-xl bg-surface px-3 text-base outline-none focus:ring-2 focus:ring-accent"
      />

      <div className="flex flex-col gap-2" role="group" aria-label="조건">
        <div className="flex flex-wrap gap-2">
          {BODY_PARTS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={bodyPart === b}
              onClick={() => setBodyPart(bodyPart === b ? null : b)}
              className={`min-h-11 rounded-full px-4 text-sm ${bodyPart === b ? "bg-accent font-bold text-black" : "bg-white/10"}`}
            >
              {b}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENTS.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={equipment === q}
              onClick={() => setEquipment(equipment === q ? null : q)}
              className={`min-h-11 rounded-full px-4 text-sm ${equipment === q ? "bg-accent font-bold text-black" : "bg-white/10"}`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <section aria-label="검색 결과" className="flex flex-col gap-2">
        {results.length === 0 ? (
          <p className="text-base">맞는 운동이 없어요. 다른 이름이나 조건으로 찾아 보세요.</p>
        ) : (
          results.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setSelected(c)}
              className="flex min-h-16 flex-col items-start justify-center rounded-2xl bg-surface px-4 py-3 text-left active:opacity-70"
            >
              <span className="text-lg font-bold">{c.name}</span>
              <span className="text-sm text-muted">
                {c.bodyPart} · {c.equipment}
              </span>
            </button>
          ))
        )}
      </section>
    </main>
  );
}
