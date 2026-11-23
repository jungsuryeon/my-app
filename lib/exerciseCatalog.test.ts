import { describe, expect, it } from "vitest";
import {
  CATALOG,
  EQUIPMENTS,
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
    expect(CATALOG.length).toBeGreaterThanOrEqual(30);
  });

  it("모든 세부 부위·기구가 목록에서 실제로 쓰이고 칩에 나온다", () => {
    const parts = new Set(CATALOG.map((c) => c.bodyPart));
    for (const p of [...REGION_PARTS.상체, ...REGION_PARTS.하체]) expect(parts.has(p)).toBe(true);
    const equips = new Set(CATALOG.map((c) => c.equipment));
    for (const q of EQUIPMENTS) expect(equips.has(q)).toBe(true);
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
    const names = searchCatalog({ query: "프레스" }).map((c) => c.name);
    for (const n of ["체스트프레스", "숄더프레스", "레그프레스", "벤치프레스"]) expect(names).toContain(n);
    expect(names.every((n) => n.includes("프레스"))).toBe(true);
  });

  it("별칭으로도 찾는다(턱걸이→풀업, 삼두→삼두 운동, 종아리)", () => {
    expect(searchCatalog({ query: "턱걸이" }).map((c) => c.key)).toContain("pull-up");
    expect(searchCatalog({ query: "삼두" }).every((c) => c.bodyPart === "팔")).toBe(true);
    expect(searchCatalog({ query: "종아리" }).length).toBeGreaterThanOrEqual(2);
  });

  it("공백·대소문자를 가리지 않고 다른 이름으로도 찾는다", () => {
    expect(searchCatalog({ query: "체스트 프레스" })[0].key).toBe("chest-press");
    expect(searchCatalog({ query: "Lat Pulldown" })[0].key).toBe("lat-pulldown");
    expect(searchCatalog({ query: "힙 어브덕션" })[0].key).toBe("hip-abduction");
    expect(searchCatalog({ query: "안쪽허벅지" })[0].key).toBe("hip-adduction");
  });

  it("부위·기구 조건으로 거른다", () => {
    const lower = searchCatalog({ region: "하체" });
    const upper = searchCatalog({ region: "상체" });
    expect(lower.map((c) => c.key)).toEqual(expect.arrayContaining(["leg-press", "hip-abduction", "hip-adduction", "squat"]));
    expect(upper.map((c) => c.key)).toEqual(expect.arrayContaining(["lat-pulldown", "chest-press", "shoulder-press"]));
    expect(lower.every((c) => regionOf(c) === "하체")).toBe(true);
    expect(upper.every((c) => regionOf(c) === "상체")).toBe(true);
    expect(lower.length + upper.length).toBe(CATALOG.length);
    const bar = searchCatalog({ equipment: "바벨" });
    expect(bar.map((c) => c.key)).toContain("squat");
    expect(bar.every((c) => c.equipment === "바벨")).toBe(true);
    const machineLower = searchCatalog({ region: "하체", equipment: "머신" });
    expect(machineLower.map((c) => c.key)).toEqual(expect.arrayContaining(["leg-press", "hip-abduction", "hip-adduction"]));
    expect(machineLower.every((c) => c.equipment === "머신" && regionOf(c) === "하체")).toBe(true);
    const chestPress = searchCatalog({ query: "프레스", bodyPart: "가슴" });
    expect(chestPress.map((c) => c.key)).toContain("chest-press");
    expect(chestPress.every((c) => c.bodyPart === "가슴")).toBe(true);
  });

  it("상체/하체를 고른 뒤 세부 부위로 더 좁힌다", () => {
    const thigh = searchCatalog({ region: "하체", bodyPart: "허벅지" });
    expect(thigh.map((c) => c.key)).toEqual(expect.arrayContaining(["leg-press", "hip-adduction", "squat"]));
    expect(thigh.every((c) => c.bodyPart === "허벅지")).toBe(true);
    expect(searchCatalog({ region: "상체", bodyPart: "엉덩이" })).toEqual([]);
    expect(searchCatalog({ query: "상체" })).toHaveLength(searchCatalog({ region: "상체" }).length);
    expect(searchCatalog({ query: "하체" })).toHaveLength(searchCatalog({ region: "하체" }).length);
  });

  it("모든 운동이 상체/하체 중 하나에 속하고, 세부 부위가 겹치지 않는다", () => {
    for (const c of CATALOG) expect(REGION_PARTS[regionOf(c)]).toContain(c.bodyPart);
    const all = [...REGION_PARTS.상체, ...REGION_PARTS.하체];
    expect(new Set(all).size).toBe(all.length);
  });

  it("검색어가 없으면 전체, 맞는 게 없으면 빈 목록", () => {
    expect(searchCatalog()).toHaveLength(CATALOG.length);
    expect(searchCatalog({ query: "  " })).toHaveLength(CATALOG.length);
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
