import { beforeEach, describe, expect, it } from "vitest";
import {
  SAVE_MESSAGES,
  buildRecord,
  countSets,
  formatRecordLine,
  isRecordList,
  latestRecord,
  loadRecords,
  saveRecord,
} from "./records";
import {
  createSession,
  endSession,
  setSetReps,
  skipSet,
  startSession,
  tick,
  type Session,
} from "./session";

const exercises = [
  { id: "a", name: "운동A", sets: 2, reps: 3, tempoSec: 1, restSec: 2, weightKg: null },
  { id: "b", name: "운동B", sets: 1, reps: 2, tempoSec: 1, restSec: 5, weightKg: 40 },
];
const routine = { id: "upper", name: "상체 데이" };
const T0 = 1_700_000_000_000;

function runTo(s: Session, to: number): Session {
  let cur = s;
  for (let t = 250; t <= to; t += 250) cur = tick(cur, t);
  return cur;
}

/** 운동A 2세트 완료 → 운동B 준비에서 전체 종료(B는 미수행) */
function finished(): Session {
  return endSession(runTo(startSession(createSession(exercises), 0), 11_000));
}

describe("기록 만들기", () => {
  it("날짜·루틴·운동별 세트 기록(상태·목표·반복 수)·무게·활성 운동 시간을 담는다", () => {
    const rec = buildRecord({ recordId: "r1", routine, session: finished(), nowDate: T0 });
    expect(rec).toMatchObject({ id: "r1", date: T0, routineName: "상체 데이", activeSec: 6 });
    expect(rec.exercises[0].sets).toEqual([
      { status: "완료", targetReps: 3, reps: 3 },
      { status: "완료", targetReps: 3, reps: 3 },
    ]);
    expect(rec.exercises[1]).toEqual({
      name: "운동B",
      weightKg: 40,
      sets: [{ status: "미수행", targetReps: 2, reps: 0 }],
    });
    expect(rec.exercises[0].weightKg).toBeNull();
  });

  it("건너뛴 세트는 건너뜀으로 저장하고 완료 세트 수에 넣지 않는다", () => {
    const s = skipSet(runTo(startSession(createSession(exercises), 0), 4500), 4500);
    const rec = buildRecord({ recordId: "r", routine, session: s, nowDate: T0 });
    expect(rec.exercises[0].sets[0]).toMatchObject({ status: "건너뜀", reps: 1 });
    expect(countSets(rec).done).toBe(0);
  });

  it("완료 세트 수/전체 세트 수를 센다", () => {
    const rec = buildRecord({ recordId: "r", routine, session: finished(), nowDate: T0 });
    expect(countSets(rec)).toEqual({ done: 2, total: 3 });
  });

  it("고친 반복 수가 기록에 반영되고, 만든 기록은 모양 검사를 통과한다", () => {
    const s = setSetReps(finished(), 0, 1, 2);
    const rec = buildRecord({ recordId: "r", routine, session: s, nowDate: T0 });
    expect(rec.exercises[0].sets[1].reps).toBe(2);
    expect(isRecordList([rec])).toBe(true);
  });
});

describe("최근 기록 한 줄", () => {
  const at = (id: string, date: number) =>
    buildRecord({ recordId: id, routine, session: finished(), nowDate: date });

  it("가장 최근 날짜의 기록을 고른다(저장 순서와 무관)", () => {
    const a = at("a", new Date(2026, 10, 20, 9).getTime());
    const b = at("b", new Date(2026, 10, 23, 9).getTime());
    const c = at("c", new Date(2026, 10, 21, 9).getTime());
    expect(latestRecord([a, b, c])?.id).toBe("b");
    expect(latestRecord([c, a, b])?.id).toBe("b");
  });

  it("기록이 없으면 null", () => {
    expect(latestRecord([])).toBeNull();
  });

  it("날짜·루틴 이름·완료 세트 수/전체 세트 수를 한 줄로 만든다", () => {
    const rec = at("a", new Date(2026, 10, 23, 18, 30).getTime());
    expect(formatRecordLine(rec)).toBe("11월 23일 · 상체 데이 · 완료 2/3세트");
  });

  it("건너뛴·미수행 세트는 완료 수에 넣지 않는다", () => {
    const s = skipSet(runTo(startSession(createSession(exercises), 0), 4500), 4500);
    const rec = buildRecord({ recordId: "s", routine, session: endSession(s), nowDate: new Date(2026, 0, 5).getTime() });
    expect(formatRecordLine(rec)).toBe("1월 5일 · 상체 데이 · 완료 0/3세트");
  });
});

describe("기록 저장", () => {
  let store: Map<string, string>;
  let failWrites = false;
  let dropWrites = false; // 쓰기는 성공한 척하지만 실제로는 저장 안 되는 상황
  beforeEach(() => {
    store = new Map();
    failWrites = false;
    dropWrites = false;
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
          if (failWrites) throw new Error("QuotaExceededError");
          if (!dropWrites) store.set(k, v);
        },
        removeItem: (k: string) => void store.delete(k),
        get length() {
          return store.size;
        },
        key: (i: number) => [...store.keys()][i] ?? null,
      },
    };
  });

  const make = (id: string, nowDate = T0) =>
    buildRecord({ recordId: id, routine, session: finished(), nowDate });

  it("저장하면 다시 읽었을 때 같은 값이다", () => {
    const rec = make("a");
    expect(saveRecord(rec)).toEqual({ ok: true });
    const r = loadRecords();
    expect(r.ok && r.records).toEqual([rec]);
  });

  it("다른 ID는 목록에 더해지고, 같은 ID로 다시 저장하면 덮어쓰기만 한다", () => {
    saveRecord(make("a"));
    saveRecord(make("b"));
    saveRecord(make("a", T0 + 5000));
    const r = loadRecords();
    if (!r.ok) throw new Error("읽기 실패");
    expect(r.records.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r.records[0].date).toBe(T0 + 5000);
  });

  it("20번 저장하고 읽은 값이 모두 일치한다", () => {
    for (let i = 0; i < 20; i++) {
      const rec = make(`id-${i}`);
      expect(saveRecord(rec).ok).toBe(true);
      const r = loadRecords();
      expect(r.ok && r.records.find((x) => x.id === rec.id)).toEqual(rec);
    }
  });

  it("저장 공간 오류는 조용히 넘기지 않고 실패와 안내 문구를 돌려준다", () => {
    failWrites = true;
    expect(saveRecord(make("a"))).toEqual({
      ok: false,
      reason: "storage",
      message: SAVE_MESSAGES.storage,
    });
  });

  it("쓰기가 성공한 것처럼 보여도 실제로 안 들어갔다면 실패로 알린다", () => {
    dropWrites = true;
    expect(saveRecord(make("a")).ok).toBe(false);
  });

  it("실패한 뒤 같은 기록을 다시 저장할 수 있다", () => {
    const rec = make("a");
    failWrites = true;
    expect(saveRecord(rec).ok).toBe(false);
    failWrites = false;
    expect(saveRecord(rec).ok).toBe(true);
    const r = loadRecords();
    expect(r.ok && r.records).toHaveLength(1);
  });

  it("기존 기록 목록이 손상돼 있으면 덮어쓰지 않고 알린다", () => {
    store.set("reptimer:records", "{깨짐");
    expect(saveRecord(make("a"))).toEqual({
      ok: false,
      reason: "corrupt",
      message: SAVE_MESSAGES.corrupt,
    });
    expect(store.get("reptimer:records")).toBe("{깨짐");
  });

  it("replaceCorrupt를 켜면 손상된 목록을 버리고 이 기록 하나로 새로 시작한다", () => {
    store.set("reptimer:records", "{깨짐");
    const rec = make("a");
    expect(saveRecord(rec, { replaceCorrupt: true })).toEqual({ ok: true });
    const r = loadRecords();
    expect(r.ok && !r.invalid && r.records).toEqual([rec]);
  });

  it("replaceCorrupt를 켜도 멀쩡한 목록은 지우지 않는다", () => {
    expect(saveRecord(make("a")).ok).toBe(true);
    expect(saveRecord(make("b"), { replaceCorrupt: true }).ok).toBe(true);
    const r = loadRecords();
    expect(r.ok && r.records.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("모양이 다른 기록이 섞여 있어도 덮어쓰지 않는다", () => {
    store.set("reptimer:records", JSON.stringify({ v: 1, data: [{ id: 1 }] }));
    expect(saveRecord(make("a")).ok).toBe(false);
  });
});
