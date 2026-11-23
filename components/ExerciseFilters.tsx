"use client";

import {
  EQUIPMENTS,
  REGIONS,
  REGION_PARTS,
  searchCatalog,
  type BodyPart,
  type CatalogExercise,
  type Equipment,
  type Region,
} from "@/lib/exerciseCatalog";

/** 운동 검색 조건. 운동 찾기 탭과 루틴 편집의 운동 추가 창이 같이 쓴다 */
export type ExerciseFilter = {
  query: string;
  region: Region | null;
  bodyPart: BodyPart | null;
  equipment: Equipment | null;
};

export const EMPTY_FILTER: ExerciseFilter = { query: "", region: null, bodyPart: null, equipment: null };

/** 조건에 맞는 운동(내부 한국어 목록에서만 찾는다) */
export function applyFilter(f: ExerciseFilter): CatalogExercise[] {
  return searchCatalog(f);
}

const chip = (on: boolean, size: "lg" | "sm") =>
  `min-h-11 rounded-full ${size === "lg" ? "px-5 text-base" : "px-4 text-sm"} ${
    on ? "bg-accent font-bold text-on-accent" : "bg-chip"
  }`;

type Props = {
  value: ExerciseFilter;
  onChange: (next: ExerciseFilter) => void;
  /** 검색칸 id(한 화면에 둘 이상 있을 때 겹치지 않게) */
  idPrefix?: string;
};

// 검색창 + 상체/하체 + 세부 부위 + 기구 칩
export default function ExerciseFilters({ value, onChange, idPrefix = "ex" }: Props) {
  const { query, region, bodyPart, equipment } = value;
  return (
    <>
      <label htmlFor={`${idPrefix}-query`} className="sr-only">
        운동 이름
      </label>
      <input
        id={`${idPrefix}-query`}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
        placeholder="운동 이름 (예: 체스트프레스)"
        className="min-h-11 rounded-xl bg-surface shadow-card px-3 text-base outline-none focus:ring-2 focus:ring-accent"
      />

      <div className="flex flex-col gap-2" role="group" aria-label="조건">
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={region === r}
              onClick={() => onChange({ ...value, region: region === r ? null : r, bodyPart: null })}
              className={chip(region === r, "lg")}
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
                onClick={() => onChange({ ...value, bodyPart: bodyPart === b ? null : b })}
                className={chip(bodyPart === b, "sm")}
              >
                {b}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2" aria-label="기구">
          {EQUIPMENTS.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={equipment === q}
              onClick={() => onChange({ ...value, equipment: equipment === q ? null : q })}
              className={chip(equipment === q, "sm")}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
