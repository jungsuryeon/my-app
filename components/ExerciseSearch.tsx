"use client";

import { useEffect, useState } from "react";
import { MY_ROUTINE_LIMITS, createRoutine, exercisesFromKeys, moveItem } from "@/lib/myRoutines";
import {
  EQUIPMENTS,
  REGIONS,
  REGION_PARTS,
  findCatalog,
  makeTempRoutine,
  regionOf,
  searchCatalog,
  type BodyPart,
  type CatalogExercise,
  type Equipment,
  type Region,
} from "@/lib/exerciseCatalog";
import type { Routine } from "@/lib/routines";

type Props = {
  /** 홈으로 돌아간다 */
  onBack: () => void;
  /** "이 운동으로 시작": 만든 임시 루틴을 기존 준비 화면으로 넘긴다 */
  onStart: (routine: Routine) => void;
  /** 내 루틴을 저장했을 때(홈으로 돌아가 안내를 보여 준다) */
  onSaved: () => void;
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
export default function ExerciseSearch({ onBack, onStart, onSaved }: Props) {
  // 루틴으로 저장할 담은 운동(key 순서 = 루틴 순서)
  const [cart, setCart] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [buildError, setBuildError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<Region | null>(null);
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [selected, setSelected] = useState<CatalogExercise | null>(null);

  const full = cart.length >= MY_ROUTINE_LIMITS.exercisesPerRoutine;

  function handleSave() {
    const r = createRoutine(routineName, exercisesFromKeys(cart));
    if (!r.ok) {
      setBuildError(r.message);
      return;
    }
    onSaved();
  }

  // ── 루틴 만들기: 담은 운동의 순서를 정하고 이름을 붙여 저장 ──
  if (building) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBuilding(false);
              setBuildError(null);
            }}
            aria-label="운동 찾기로"
            className="-ml-2 min-h-11 min-w-11 rounded-xl px-2 text-lg"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">내 루틴 만들기</h1>
        </header>

        <label htmlFor="routine-name" className="text-sm text-muted">
          루틴 이름
        </label>
        <input
          id="routine-name"
          type="text"
          autoComplete="off"
          maxLength={MY_ROUTINE_LIMITS.nameMax * 2}
          value={routineName}
          onChange={(e) => setRoutineName(e.target.value)}
          placeholder={`최대 ${MY_ROUTINE_LIMITS.nameMax}글자 (예: 가슴 데이)`}
          className="min-h-11 rounded-xl bg-surface px-3 text-base outline-none focus:ring-2 focus:ring-accent"
        />

        <section aria-label="담은 운동" className="flex flex-col gap-2">
          {cart.map((key, i) => {
            const c = findCatalog(key);
            if (!c) return null;
            return (
              <div key={key} className="flex items-center gap-1 rounded-2xl bg-surface pl-4">
                <span className="flex-1 py-3">
                  <span className="text-muted">{i + 1}. </span>
                  <span className="font-bold">{c.name}</span>
                </span>
                <button
                  type="button"
                  aria-label={`${c.name} 위로`}
                  disabled={i === 0}
                  onClick={() => setCart(moveItem(cart, i, -1))}
                  className="min-h-11 min-w-11 rounded-xl text-lg disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`${c.name} 아래로`}
                  disabled={i === cart.length - 1}
                  onClick={() => setCart(moveItem(cart, i, 1))}
                  className="min-h-11 min-w-11 rounded-xl text-lg disabled:opacity-30"
                >
                  ▼
                </button>
                <button
                  type="button"
                  aria-label={`${c.name} 빼기`}
                  onClick={() => {
                    const next = cart.filter((k) => k !== key);
                    setCart(next);
                    if (next.length === 0) setBuilding(false);
                  }}
                  className="min-h-11 min-w-11 rounded-xl text-lg text-red-300"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </section>

        <p className="text-sm text-muted">
          운동마다 반복 15·세트 3·휴식 30초·템포 3초로 시작하고, 운동 전 준비 화면에서 바꿀 수 있어요. 이 루틴은 이
          폰에만 저장돼요.
        </p>
        {buildError && (
          <p role="alert" className="text-sm text-red-300">
            {buildError}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="mt-auto min-h-14 rounded-2xl bg-accent px-4 text-lg font-bold text-black"
        >
          루틴 저장
        </button>
      </main>
    );
  }

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
        <p className="text-sm text-muted">
          {regionOf(selected)} · {selected.bodyPart} · {selected.equipment}
        </p>
        <GifView item={selected} />
        <div className="mt-auto grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!inCart && full}
            onClick={() => setCart(inCart ? cart.filter((k) => k !== selected.key) : [...cart, selected.key])}
            className="min-h-14 rounded-2xl bg-white/10 px-4 text-lg font-bold disabled:opacity-40"
          >
            {inCart ? "담김 ✓ 빼기" : "루틴에 담기"}
          </button>
          <button
            type="button"
            onClick={() => onStart(makeTempRoutine(selected))}
            className="min-h-14 rounded-2xl bg-accent px-4 text-lg font-bold text-black"
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

  const results = searchCatalog({ query, region, bodyPart, equipment });

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
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={region === r}
              onClick={() => {
                setRegion(region === r ? null : r);
                setBodyPart(null); // 큰 구분을 바꾸면 세부 부위는 처음으로
              }}
              className={`min-h-11 rounded-full px-5 text-base ${region === r ? "bg-accent font-bold text-black" : "bg-white/10"}`}
            >
              {r}
            </button>
          ))}
        </div>
        {region && (
          <div className="flex flex-wrap gap-2" aria-label={`${region} 세부 부위`}>
            {REGION_PARTS[region].map((b) => (
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
        )}
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
                {regionOf(c)} · {c.bodyPart} · {c.equipment}
              </span>
            </button>
          ))
        )}
      </section>

      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => setBuilding(true)}
          className="sticky bottom-4 mt-auto min-h-14 rounded-2xl bg-accent px-4 text-lg font-bold text-black shadow-lg"
        >
          담은 운동 {cart.length}개 · 루틴 만들기
        </button>
      )}
    </main>
  );
}
