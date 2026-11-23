"use client";

import { useEffect, useState } from "react";
import { WEEKDAYS, buildMonthGrid, countByDay, shiftMonth, type YearMonth } from "@/lib/calendar";
import { loadRecords } from "@/lib/records";

type Props = {
  /** 홈으로 돌아간다 */
  onBack: () => void;
};

type Loaded =
  | { kind: "loading" }
  | { kind: "ok"; counts: Map<string, number> }
  | { kind: "unreadable" };

// 운동 기록 캘린더. 운동한 날에 점을 찍어 보여 준다(날짜별 조회는 STEP 2).
export default function Calendar({ onBack }: Props) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  // 처음 그릴 때는 서버 화면과 같도록 비워 두고, 그려진 뒤 오늘 날짜로 채운다
  const [ym, setYm] = useState<YearMonth | null>(null);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    // PRD: localStorage는 화면이 그려진 뒤(useEffect)에만 읽는다. 저장소 값을 한 번 상태로 옮기는 것이라
    // effect 안에서 상태를 바꿀 수밖에 없다.
    /* eslint-disable react-hooks/set-state-in-effect */
    const now = new Date();
    setYm({ year: now.getFullYear(), month: now.getMonth() + 1 });
    setToday(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    );
    const r = loadRecords();
    setLoaded(r.ok && !r.invalid ? { kind: "ok", counts: countByDay(r.records) } : { kind: "unreadable" });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const cells = ym ? buildMonthGrid(ym.year, ym.month) : [];
  const counts = loaded.kind === "ok" ? loaded.counts : new Map<string, number>();

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
        <h1 className="text-2xl font-bold">운동 기록</h1>
      </header>

      {loaded.kind === "unreadable" && (
        <p role="alert" className="rounded-2xl bg-red-400/15 px-4 py-3 text-sm text-red-200">
          저장된 기록을 읽을 수 없어요.
        </p>
      )}

      <section aria-label="월간 달력" className="rounded-2xl bg-surface p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={!ym}
            onClick={() => ym && setYm(shiftMonth(ym, -1))}
            aria-label="이전 달"
            className="min-h-11 min-w-11 rounded-xl text-xl"
          >
            ‹
          </button>
          <h2 className="text-lg font-bold" aria-live="polite">
            {ym ? `${ym.year}년 ${ym.month}월` : " "}
          </h2>
          <button
            type="button"
            disabled={!ym}
            onClick={() => ym && setYm(shiftMonth(ym, 1))}
            aria-label="다음 달"
            className="min-h-11 min-w-11 rounded-xl text-xl"
          >
            ›
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7 text-center text-xs text-muted">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {cells.map((c, i) =>
            c === null ? (
              <span key={`e${i}`} className="h-11" />
            ) : (
              <span
                key={c.key}
                aria-label={counts.has(c.key) ? `${c.day}일 운동 ${counts.get(c.key)}회` : `${c.day}일`}
                className={`flex h-11 flex-col items-center justify-center rounded-xl text-base ${
                  c.key === today ? "ring-1 ring-accent" : ""
                }`}
              >
                {c.day}
                <span
                  aria-hidden="true"
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${counts.has(c.key) ? "bg-accent" : "bg-transparent"}`}
                />
              </span>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
