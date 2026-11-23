import { beforeEach, describe, expect, it } from "vitest";
import {
  MY_ROUTINE_LIMITS,
  MY_ROUTINE_PREFIX,
  copyRoutine,
  createRoutine,
  deleteRoutine,
  exercisesFromKeys,
  isRoutineList,
  loadMyRoutines,
  moveItem,
  renameRoutine,
  validateRoutineName,
} from "./myRoutines";

const exs = () => exercisesFromKeys(["chest-press", "squat"]);

describe("이름 검사", () => {
  it("앞뒤 공백을 지우고 받는다", () => {
    expect(validateRoutineName("  가슴 데이 ")).toEqual({ ok: true, name: "가슴 데이" });
  });
  it("비었거나 12자를 넘으면 오류, 12자까지는 허용", () => {
    expect(validateRoutineName("   ").ok).toBe(false);
    expect(validateRoutineName("가".repeat(12)).ok).toBe(true);
    expect(validateRoutineName("가".repeat(13)).ok).toBe(false);
  });
  it("제어 문자는 뺀다", () => {
    expect(validateRoutineName("가\u0000나\n")).toEqual({ ok: true, name: "가나" });
  });
});

describe("만들기 계산", () => {
  it("담은 key로 기본값 운동을 만들고 모르는 key는 건너뛴다", () => {
    const r = exercisesFromKeys(["lat-pulldown", "없는운동", "squat"]);
    expect(r.map((e) => e.id)).toEqual(["lat-pulldown", "squat"]);
    expect(r[0].reps).toBe(15);
  });
  it("순서 바꾸기: 끝에서는 그대로", () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 3, 2]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });
  it("복사본을 고쳐도 원본이 안 바뀐다", () => {
    const base = { id: "my-a", name: "a", exercises: exs() };
    const c = copyRoutine(base);
    c.exercises[0].reps = 99;
    expect(base.exercises[0].reps).toBe(15);
  });
});

describe("저장·불러오기·이름 변경·삭제", () => {
  let store: Map<string, string>;
  let failWrites = false;
  beforeEach(() => {
    store = new Map();
    failWrites = false;
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
          if (failWrites) throw new Error("quota");
          store.set(k, v);
        },
        removeItem: (k: string) => void store.delete(k),
        get length() {
          return store.size;
        },
        key: (i: number) => [...store.keys()][i] ?? null,
      },
    };
  });

  it("처음에는 비어 있다", () => {
    const r = loadMyRoutines();
    expect(r.ok && r.routines).toEqual([]);
  });

  it("만들면 저장되고 다시 읽힌다(id는 my-로 시작)", () => {
    const r = createRoutine("가슴 데이", exs());
    expect(r.ok).toBe(true);
    const l = loadMyRoutines();
    expect(l.ok && l.routines).toHaveLength(1);
    expect(l.ok && l.routines[0].id.startsWith(MY_ROUTINE_PREFIX)).toBe(true);
    expect(l.ok && l.routines[0].name).toBe("가슴 데이");
    expect(l.ok && l.routines[0].exercises.map((e) => e.id)).toEqual(["chest-press", "squat"]);
  });

  it("이름이 틀렸거나 운동이 없거나 10개를 넘으면 저장하지 않는다", () => {
    expect(createRoutine("", exs()).ok).toBe(false);
    expect(createRoutine("a", []).ok).toBe(false);
    const eleven = Array.from({ length: 11 }, () => exs()[0]);
    const r = createRoutine("a", eleven);
    expect(!r.ok && r.reason).toBe("invalid");
    expect(store.size).toBe(0);
  });

  it("루틴 20개가 차면 더 만들 수 없다", () => {
    for (let i = 0; i < MY_ROUTINE_LIMITS.routines; i++) expect(createRoutine(`r${i}`, exs()).ok).toBe(true);
    const r = createRoutine("넘침", exs());
    expect(!r.ok && r.reason).toBe("limit");
    const l = loadMyRoutines();
    expect(l.ok && l.routines).toHaveLength(20);
  });

  it("이름 바꾸기와 삭제는 해당 루틴만", () => {
    createRoutine("a", exs());
    const made = createRoutine("b", exs());
    const id = made.ok ? made.routines[1].id : "";
    const renamed = renameRoutine(id, "새이름");
    expect(renamed.ok && renamed.routines.map((r) => r.name)).toEqual(["a", "새이름"]);
    const del = deleteRoutine(id);
    expect(del.ok && del.routines.map((r) => r.name)).toEqual(["a"]);
    const again = deleteRoutine(id);
    expect(!again.ok && again.reason).toBe("missing");
    expect(renameRoutine("my-없음", "x").ok).toBe(false);
  });

  it("저장 실패는 알리고 기존 목록은 그대로", () => {
    createRoutine("a", exs());
    failWrites = true;
    const r = createRoutine("b", exs());
    expect(!r.ok && r.reason).toBe("storage");
    failWrites = false;
    const l = loadMyRoutines();
    expect(l.ok && l.routines).toHaveLength(1);
  });

  it("손상된 목록은 덮어쓰지 않는다", () => {
    store.set("reptimer:routines", "{깨짐");
    const r = createRoutine("a", exs());
    expect(!r.ok && r.reason).toBe("corrupt");
    expect(store.get("reptimer:routines")).toBe("{깨짐");
    const l = loadMyRoutines();
    expect(l.ok && l.invalid).toBe(true);
  });

  it("모양 검사: 접두사 없는 id·빈 운동 목록은 거부", () => {
    const good = { id: "my-1", name: "a", exercises: exs() };
    expect(isRoutineList([good])).toBe(true);
    expect(isRoutineList([{ ...good, id: "upper" }])).toBe(false);
    expect(isRoutineList([{ ...good, exercises: [] }])).toBe(false);
    expect(isRoutineList("x")).toBe(false);
  });
});
