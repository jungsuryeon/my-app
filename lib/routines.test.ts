import { describe, expect, it } from "vitest";
import { SAMPLE_ROUTINES, cloneRoutine, toInput, validateInput, type ExerciseInput } from "./routines";

const ok: ExerciseInput = { reps: "15", sets: "3", restSec: "30", tempoSec: "3", weightKg: "" };
const withField = (k: keyof ExerciseInput, v: string): ExerciseInput => ({ ...ok, [k]: v });

describe("샘플 루틴", () => {
  it("상체 3운동·하체 4운동이고 모두 기본값(3세트·30초·템포 3초)이다", () => {
    const [upper, lower] = SAMPLE_ROUTINES;
    expect(upper.exercises.map((e) => `${e.name}${e.reps}`)).toEqual([
      "랫풀다운15",
      "체스트프레스15",
      "숄더프레스12",
    ]);
    expect(lower.exercises.map((e) => `${e.name}${e.reps}`)).toEqual([
      "레그프레스15",
      "아웃타이15",
      "인타이15",
      "스쿼트12",
    ]);
    for (const e of SAMPLE_ROUTINES.flatMap((r) => r.exercises)) {
      expect([e.sets, e.restSec, e.tempoSec, e.weightKg]).toEqual([3, 30, 3, null]);
    }
  });

  it("복사본을 고쳐도 원본은 바뀌지 않고, 없는 id는 null", () => {
    const c = cloneRoutine("upper")!;
    c.exercises[0].reps = 1;
    expect(SAMPLE_ROUTINES[0].exercises[0].reps).toBe(15);
    expect(cloneRoutine("nope")).toBeNull();
  });

  it("모든 샘플 운동의 기본값이 검증을 통과한다", () => {
    for (const e of SAMPLE_ROUTINES.flatMap((r) => r.exercises)) {
      expect(validateInput(toInput(e)).values).not.toBeNull();
    }
  });
});

describe("입력 값 검증", () => {
  it("기본 입력은 통과하고 숫자로 바뀐다(무게 비움 → null)", () => {
    const r = validateInput(ok);
    expect(r.errors).toEqual({});
    expect(r.values).toEqual({ reps: 15, sets: 3, restSec: 30, tempoSec: 3, weightKg: null });
  });

  it.each([
    ["reps", "0"],
    ["reps", "51"],
    ["reps", "1.5"],
    ["reps", "abc"],
    ["reps", ""],
    ["sets", "0"],
    ["sets", "11"],
    ["restSec", "9"],
    ["restSec", "601"],
    ["restSec", ""],
    ["tempoSec", "0.9"],
    ["tempoSec", "10.1"],
    ["tempoSec", "2.55"],
    ["tempoSec", ""],
  ] as const)("%s = '%s' 는 오류(시작 막음)", (field, value) => {
    const r = validateInput(withField(field, value));
    expect(r.errors[field]).toBeTruthy();
    expect(r.values).toBeNull();
  });

  it.each([
    ["reps", "1"],
    ["reps", "50"],
    ["sets", "1"],
    ["sets", "10"],
    ["restSec", "10"],
    ["restSec", "600"],
    ["tempoSec", "1"],
    ["tempoSec", "10"],
    ["tempoSec", "2.5"],
  ] as const)("경계값 %s = '%s' 는 통과", (field, value) => {
    expect(validateInput(withField(field, value)).values).not.toBeNull();
  });

  it("무게는 비워 둘 수 있고, 입력하면 0~500kg·0.5 단위", () => {
    expect(validateInput(withField("weightKg", "")).values?.weightKg).toBeNull();
    expect(validateInput(withField("weightKg", "  ")).values?.weightKg).toBeNull();
    expect(validateInput(withField("weightKg", "0")).values?.weightKg).toBe(0);
    expect(validateInput(withField("weightKg", "42.5")).values?.weightKg).toBe(42.5);
    expect(validateInput(withField("weightKg", "500")).values?.weightKg).toBe(500);
    for (const bad of ["-1", "500.5", "42.3", "abc"]) {
      expect(validateInput(withField("weightKg", bad)).errors.weightKg).toBeTruthy();
    }
  });

  it("여러 칸이 틀리면 칸마다 이유를 모두 알려 준다", () => {
    const r = validateInput({ reps: "0", sets: "", restSec: "5", tempoSec: "3", weightKg: "x" });
    expect(Object.keys(r.errors).sort()).toEqual(["reps", "restSec", "sets", "weightKg"]);
  });
});
