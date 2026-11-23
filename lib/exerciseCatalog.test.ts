import { describe, expect, it } from "vitest";
import {
  CATALOG,
  REGION_PARTS,
  findCatalog,
  makeTempRoutine,
  normalize,
  regionOf,
  searchCatalog,
} from "./exerciseCatalog";
import { SAMPLE_ROUTINES, validateInput } from "./routines";

describe("검증된 운동 목록", () => {
  it("기존 샘플 운동 7개가 모두 들어 있고 ID가 샘플 루틴과 같다", () => {
    const sampleIds = SAMPLE_ROUTINES.flatMap((r) => r.exercises.map((e) => e.id));
    expect(sampleIds).toHaveLength(7);
    for (const id of sampleIds) expect(findCatalog(id)).not.toBeNull();
    expect(CATALOG).toHaveLength(7);
  });

  it("샘플 루틴의 이름과 목록의 이름이 같다", () => {
    for (const r of SAMPLE_ROUTINES) {
      for (const e of r.exercises) expect(findCatalog(e.id)!.name).toBe(e.name);
    }
  });

  it("key가 겹치지 않고, ExerciseDB ID는 있으면 7자의 영숫자이며 서로 다르다", () => {
    expect(new Set(CATALOG.map((c) => c.key)).size).toBe(CATALOG.length);
    const ids = CATALOG.map((c) => c.exerciseDbId).filter((x): x is string => x !== null);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("검증 근거가 모두 적혀 있다", () => {
    for (const c of CATALOG) expect(c.checked.length).toBeGreaterThan(0);
  });
});

describe("한국어 검색", () => {
  it("이름 일부로 찾는다", () => {
    expect(searchCatalog({ query: "프레스" }).map((c) => c.name)).toEqual(["체스트프레스", "숄더프레스", "레그프레스"]);
  });

  it("공백·대소문자를 가리지 않고 다른 이름으로도 찾는다", () => {
    expect(searchCatalog({ query: "체스트 프레스" })[0].key).toBe("chest-press");
    expect(searchCatalog({ query: "Lat Pulldown" })[0].key).toBe("lat-pulldown");
    expect(searchCatalog({ query: "힙 어브덕션" })[0].key).toBe("hip-abduction");
    expect(searchCatalog({ query: "안쪽허벅지" })[0].key).toBe("hip-adduction");
  });

  it("부위·기구 조건으로 거른다", () => {
    expect(searchCatalog({ region: "하체" }).map((c) => c.key)).toEqual([
      "leg-press",
      "hip-abduction",
      "hip-adduction",
      "squat",
    ]);
    expect(searchCatalog({ region: "상체" }).map((c) => c.key)).toEqual([
      "lat-pulldown",
      "chest-press",
      "shoulder-press",
    ]);
    expect(searchCatalog({ equipment: "바벨" }).map((c) => c.key)).toEqual(["squat"]);
    expect(searchCatalog({ region: "하체", equipment: "머신" })).toHaveLength(3);
    expect(searchCatalog({ query: "프레스", bodyPart: "가슴" })).toHaveLength(1);
  });

  it("상체/하체를 고른 뒤 세부 부위로 더 좁힌다", () => {
    expect(searchCatalog({ region: "하체", bodyPart: "허벅지" }).map((c) => c.key)).toEqual([
      "leg-press",
      "hip-adduction",
      "squat",
    ]);
    expect(searchCatalog({ region: "상체", bodyPart: "엉덩이" })).toEqual([]);
    expect(searchCatalog({ query: "상체" })).toHaveLength(3);
    expect(searchCatalog({ query: "하체" })).toHaveLength(4);
  });

  it("모든 운동이 상체/하체 중 하나에 속하고, 세부 부위가 겹치지 않는다", () => {
    for (const c of CATALOG) expect(REGION_PARTS[regionOf(c)]).toContain(c.bodyPart);
    const all = [...REGION_PARTS.상체, ...REGION_PARTS.하체];
    expect(new Set(all).size).toBe(all.length);
  });

  it("검색어가 없으면 전체, 맞는 게 없으면 빈 목록", () => {
    expect(searchCatalog()).toHaveLength(7);
    expect(searchCatalog({ query: "  " })).toHaveLength(7);
    expect(searchCatalog({ query: "없는운동" })).toEqual([]);
  });

  it("normalize", () => {
    expect(normalize(" Lat-Pull Down ")).toBe("latpulldown");
  });
});

describe("임시 루틴", () => {
  it("고른 운동 하나와 기본값으로 만들고, 시작 전 검사를 통과한다", () => {
    const r = makeTempRoutine(findCatalog("squat")!);
    expect(r.id).toBe("temp-squat");
    expect(r.name).toBe("스쿼트");
    expect(r.exercises).toHaveLength(1);
    const e = r.exercises[0];
    expect(
      validateInput({
        reps: String(e.reps),
        sets: String(e.sets),
        restSec: String(e.restSec),
        tempoSec: String(e.tempoSec),
        weightKg: e.weightKg === null ? "" : String(e.weightKg),
      }).values,
    ).not.toBeNull();
  });

  it("만들 때마다 새 객체라 샘플 원본을 바꾸지 않는다", () => {
    const a = makeTempRoutine(findCatalog("squat")!);
    const b = makeTempRoutine(findCatalog("squat")!);
    expect(a).not.toBe(b);
    expect(a.exercises[0]).not.toBe(b.exercises[0]);
  });
});
