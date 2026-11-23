"use client";

import { useEffect, useState } from "react";
import {
  WEEKDAYS,
  buildMonthGrid,
  countByDay,
  dayKey,
  formatClock,
  monthStats,
  recordTime,
  recordsOnDay,
  shiftMonth,
  type YearMonth,
} from "@/lib/calendar";
import { countSets, deleteRecord, loadRecords, type WorkoutRecord } from "@/lib/records";
import DeleteRecordDialog from "./DeleteRecordDialog";
import RecordDetail, { recordTitle } from "./RecordDetail";

type Props = {
  /** 홈으로 돌아간다 */
  onBack: () => void;
};

// 운동 기록 캘린더. 운동한 날에 점을 찍고, 날짜를 누르면 그 날의 기록을, 기록을 누르면 상세를 보여 준다.
export default function Calendar({ onBack }: Props) {
  // null = 아직 읽기 전, "unreadable" = 읽을 수 없음
  const [records, setRecords] = useState<WorkoutRecord[] | "unreadable" | null>(null);
  // 처음 그릴 때는 서버 화면과 같도록 비워 두고, 그려진 뒤 오늘 날짜로 채운다
  const [ym, setYm] = useState<YearMonth | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  // 삭제 확인창: null = 닫힘, 문자열 = 열림(값은 실패 안내, 빈 문자열이면 안내 없음)
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  useEffect(() => {
    // PRD: localStorage는 화면이 그려진 뒤(useEffect)에만 읽는다. 저장소 값을 한 번 상태로 옮기는 것이라
    // effect 안에서 상태를 바꿀 수밖에 없다.
    /* eslint-disable react-hooks/set-state-in-effect */
    const now = new Date();
    setYm({ year: now.getFullYear(), month: now.getMonth() + 1 });
    setToday(dayKey(now.getFullYear(), now.getMonth() + 1, now.getDate()));
    const r = loadRecords();
    setRecords(r.ok && !r.invalid ? r.records : "unreadable");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const list = Array.isArray(records) ? records : [];
  const counts = countByDay(list);
  const cells = ym ? buildMonthGrid(ym.year, ym.month) : [];
  // 보고 있는 달의 운동 일수·횟수. 삭제하면 records가 바뀌므로 바로 다시 계산된다
  const stats = ym ? monthStats(list, ym.year, ym.month) : null;
  const dayRecords = selected ? recordsOnDay(list, selected) : [];
  const detail = detailId ? (list.find((r) => r.id === detailId) ?? null) : null;

  function handleDelete() {
    if (!detail) return;
    const r = deleteRecord(detail.id);
    if (!r.ok) {
      setDeleteDialog(r.message);
      return;
    }
    // 지운 뒤 남은 목록으로 바로 바꿔서 달력의 점과 날짜별 목록에 즉시 반영한다
    setRecords(r.records);
    setDeleteDialog(null);
    setDetailId(null);
  }

  if (detail) {
    return (
      <>
        <RecordDetail record={detail} onBack={() => setDetailId(null)} onDelete={() => setDeleteDialog("")} />
        {deleteDialog !== null && (
          <DeleteRecordDialog
            label={`${recordTitle(detail)} · ${detail.routineName}`}
            error={deleteDialog || null}
            onCancel={() => setDeleteDialog(null)}
            onConfirm={handleDelete}
          />
        )}
      </>
    );
  }

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

      {records === "unreadable" && (
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
              <button
                key={c.key}
                type="button"
                onClick={() => setSelected(c.key)}
                aria-pressed={selected === c.key}
                aria-label={counts.has(c.key) ? `${c.day}일 운동 ${counts.get(c.key)}회` : `${c.day}일`}
                className={`flex h-11 flex-col items-center justify-center rounded-xl text-base ${
                  selected === c.key ? "bg-white/15" : ""
                } ${c.key === today ? "ring-1 ring-accent" : ""}`}
              >
                {c.day}
                <span
                  aria-hidden="true"
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${counts.has(c.key) ? "bg-accent" : "bg-transparent"}`}
                />
              </button>
            ),
          )}
        </div>
      </section>

      <section aria-label="월간 통계" className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface p-4">
          <p className="text-sm text-muted">운동한 날</p>
          <p className="mt-1 text-2xl font-bold">{stats ? `${stats.days}일` : "-"}</p>
        </div>
        <div className="rounded-2xl bg-surface p-4">
          <p className="text-sm text-muted">운동 횟수</p>
          <p className="mt-1 text-2xl font-bold">{stats ? `${stats.count}회` : "-"}</p>
        </div>
      </section>

      <section aria-label="선택한 날의 기록" className="flex flex-col gap-2">
        {selected === null ? (
          <p className="text-sm text-muted">날짜를 눌러 그날의 운동 기록을 확인하세요.</p>
        ) : dayRecords.length === 0 ? (
          <p className="text-base">이 날은 운동 기록이 없어요.</p>
        ) : (
          dayRecords.map((r) => {
            const { done, total } = countSets(r);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setDetailId(r.id)}
                className="flex min-h-16 flex-col items-start justify-center rounded-2xl bg-surface px-4 py-3 text-left active:opacity-70"
              >
                <span className="text-lg font-bold">{r.routineName}</span>
                <span className="text-sm text-muted">
                  {formatClock(recordTime(r))} · 완료 {done}/{total}세트
                </span>
              </button>
            );
          })
        )}
      </section>
    </main>
  );
}
