"use client";

import { useEffect, useState } from "react";
import { greeting, loadProfile, saveProfile, validateNickname, NICKNAME_MAX, type ProfileState } from "@/lib/profile";
import { formatRecordLine, latestRecord, loadRecords } from "@/lib/records";
import { SAMPLE_ROUTINES } from "@/lib/routines";
import { clearAll } from "@/lib/storage";
import ResetDialog from "./ResetDialog";

/** 최근 기록 칸에 보여 줄 내용 */
type Recent = { kind: "none" } | { kind: "line"; text: string } | { kind: "unreadable" };

type Props = {
  /** 루틴 카드를 누르면 그 루틴의 id로 호출 */
  onSelectRoutine: (routineId: string) => void;
  /** "운동 기록 보기" 버튼: 캘린더 화면으로 */
  onOpenCalendar: () => void;
};

// 홈 화면. 닉네임·최근 기록·데이터 초기화는 이후 작업에서 채운다.
export default function Home({ onSelectRoutine, onOpenCalendar }: Props) {
  // 처음 그릴 때는 기록이 없는 것으로 두고(서버 화면과 같게), 그려진 뒤에 저장소에서 읽는다
  const [recent, setRecent] = useState<Recent>({ kind: "none" });
  // 닉네임 상태. null = 아직 읽기 전(입력 카드가 번쩍 보였다 사라지지 않게 읽기 전에는 아무것도 안 보인다)
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [nickInput, setNickInput] = useState("");
  const [nickError, setNickError] = useState<string | null>(null);
  // 데이터 초기화 확인창. null = 닫힘, 문자열 = 열림(값은 삭제 실패 안내, 빈 문자열이면 안내 없음)
  const [resetDialog, setResetDialog] = useState<string | null>(null);

  useEffect(() => {
    const r = loadRecords();
    // PRD: localStorage는 화면이 그려진 뒤(useEffect)에만 읽는다. 저장소 값을 한 번 상태로 옮기는 것이라
    // effect 안에서 상태를 바꿀 수밖에 없다(홈이 나타날 때마다 한 번 실행).
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!r.ok || r.invalid) {
      setRecent({ kind: "unreadable" });
      return;
    }
    const latest = latestRecord(r.records);
    setRecent(latest ? { kind: "line", text: formatRecordLine(latest) } : { kind: "none" });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    // 위와 같은 이유로 effect 안에서 저장소 값을 상태로 옮긴다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(loadProfile());
  }, []);

  function handleSaveNickname() {
    const v = validateNickname(nickInput);
    if (!v.ok) {
      setNickError(v.error);
      return;
    }
    if (!saveProfile(v.nickname)) {
      setNickError("저장하지 못했어요. 다시 시도하거나 건너뛰기를 눌러 주세요.");
      return;
    }
    setNickError(null);
    setProfile({ kind: "set", nickname: v.nickname });
  }

  function handleSkipNickname() {
    saveProfile(null); // 저장에 실패해도 이번에는 그냥 넘어간다(다음에 다시 물어볼 수 있다)
    setProfile({ kind: "set", nickname: null });
  }

  /** 확인창에서 "삭제"를 눌렀을 때: 이 앱의 저장 데이터를 모두 지우고 화면을 처음 상태로 되돌린다 */
  function handleReset() {
    const r = clearAll();
    if (!r.ok) {
      setResetDialog("삭제하지 못했어요. 브라우저 설정을 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    setResetDialog(null);
    setRecent({ kind: "none" });
    setProfile({ kind: "none" }); // 닉네임을 새로 물어본다
    setNickInput("");
    setNickError(null);
  }

  const hello = profile?.kind === "set" ? greeting(profile.nickname) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">RepTimer</h1>
        {hello && <p className="mt-1 text-lg">{hello}</p>}
        <p className="mt-1 text-sm text-muted">
          반복·세트·휴식을 자동으로 진행해 드려요.
        </p>
      </header>

      {/* 첫 실행: 닉네임 입력(선택). 건너뛰기를 누르면 다시 묻지 않는다 */}
      {profile?.kind === "none" && (
        <form
          aria-labelledby="nick-title"
          className="flex flex-col gap-3 rounded-2xl bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveNickname();
          }}
        >
          <h2 id="nick-title" className="text-base font-bold">
            닉네임을 알려 주세요 <span className="text-sm font-normal text-muted">(선택)</span>
          </h2>
          <p className="text-sm text-muted">입력하면 홈 인사말에 표시돼요. 이 폰에만 저장돼요.</p>
          <label htmlFor="nickname" className="sr-only">
            닉네임
          </label>
          <input
            id="nickname"
            type="text"
            autoComplete="off"
            maxLength={NICKNAME_MAX * 2}
            value={nickInput}
            onChange={(e) => setNickInput(e.target.value)}
            aria-invalid={nickError ? true : undefined}
            aria-describedby={nickError ? "nick-error" : undefined}
            placeholder={`최대 ${NICKNAME_MAX}글자`}
            className={`min-h-11 rounded-xl bg-background px-3 text-base outline-none focus:ring-2 ${
              nickError ? "ring-2 ring-red-400" : "focus:ring-accent"
            }`}
          />
          {nickError && (
            <p id="nick-error" role="alert" className="text-sm text-red-400">
              {nickError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSkipNickname}
              className="min-h-11 rounded-xl bg-white/10 px-4"
            >
              건너뛰기
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-accent px-4 font-bold text-black"
            >
              저장
            </button>
          </div>
        </form>
      )}

      <section aria-labelledby="recent-title" className="rounded-2xl bg-surface p-4">
        <h2 id="recent-title" className="text-sm font-medium text-muted">
          최근 기록
        </h2>
        <p className="mt-2 text-base">
          {recent.kind === "line"
            ? recent.text
            : recent.kind === "unreadable"
              ? "저장된 기록을 읽을 수 없어요"
              : "아직 기록이 없습니다"}
        </p>
        <button
          type="button"
          onClick={onOpenCalendar}
          className="mt-3 min-h-11 w-full rounded-xl bg-white/10 px-4 font-bold"
        >
          운동 캘린더 보기
        </button>
      </section>

      <section aria-labelledby="routine-title" className="flex flex-col gap-3">
        <h2 id="routine-title" className="text-sm font-medium text-muted">
          루틴
        </h2>
        {SAMPLE_ROUTINES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelectRoutine(r.id)}
            className="flex min-h-16 flex-col items-start justify-center rounded-2xl bg-surface px-4 py-3 text-left active:opacity-70"
          >
            <span className="text-lg font-bold">{r.name}</span>
            <span className="text-sm text-muted">
              {r.exercises.map((e) => e.name).join(" · ")}
            </span>
          </button>
        ))}
      </section>

      <button
        type="button"
        onClick={() => setResetDialog("")}
        className="mt-auto min-h-11 self-center rounded-xl px-4 text-sm text-muted underline"
      >
        데이터 초기화
      </button>

      {resetDialog !== null && (
        <ResetDialog
          error={resetDialog || null}
          onCancel={() => setResetDialog(null)}
          onConfirm={handleReset}
        />
      )}
    </main>
  );
}
