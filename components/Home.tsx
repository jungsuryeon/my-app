"use client";

import { useEffect, useState } from "react";
import { greeting, loadProfile, saveProfile, validateNickname, NICKNAME_MAX, type ProfileState } from "@/lib/profile";
import { formatRecordLine, latestRecord, loadRecords } from "@/lib/records";
import { copyRoutine, deleteRoutine, loadMyRoutines } from "@/lib/myRoutines";
import { SAMPLE_ROUTINES, cloneRoutine, type Routine } from "@/lib/routines";
import { loadPrefs, savePrefs, showDefaultRoutines, type PrefsState } from "@/lib/prefs";
import { clearAll } from "@/lib/storage";
import DeleteRecordDialog from "./DeleteRecordDialog";
import ResetDialog from "./ResetDialog";

/** 최근 기록 칸에 보여 줄 내용 */
type Recent = { kind: "none" } | { kind: "line"; text: string } | { kind: "unreadable" };

type Props = {
  /** 루틴 카드를 누르면 그 루틴의 복사본으로 호출(시작 전 값 수정이 원본을 바꾸지 않도록) */
  onSelectRoutine: (routine: Routine) => void;
  /** "루틴 만들기" 버튼 */
  onCreateRoutine: () => void;
  /** 내 루틴의 "수정" 버튼 */
  onEditRoutine: (routine: Routine) => void;
};

// 홈 탭. 닉네임, 최근 기록, 기본 루틴, 내 루틴, 데이터 초기화를 보여 준다(캘린더·운동 찾기는 하단 탭으로 간다).
export default function Home({ onSelectRoutine, onCreateRoutine, onEditRoutine }: Props) {
  // 처음 그릴 때는 기록이 없는 것으로 두고(서버 화면과 같게), 그려진 뒤에 저장소에서 읽는다
  const [recent, setRecent] = useState<Recent>({ kind: "none" });
  // 닉네임 상태. null = 아직 읽기 전(입력 카드가 번쩍 보였다 사라지지 않게 읽기 전에는 아무것도 안 보인다)
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [nickInput, setNickInput] = useState("");
  const [nickError, setNickError] = useState<string | null>(null);
  // 데이터 초기화 확인창. null = 닫힘, 문자열 = 열림(값은 삭제 실패 안내, 빈 문자열이면 안내 없음)
  const [resetDialog, setResetDialog] = useState<string | null>(null);
  // 내 루틴. null = 읽기 전, "unreadable" = 읽을 수 없음
  const [myRoutines, setMyRoutines] = useState<Routine[] | "unreadable" | null>(null);
  // 삭제 확인창: 대상 루틴 id와 실패 안내
  const [deleting, setDeleting] = useState<{ id: string; error: string | null } | null>(null);

  // 기본 루틴을 보일지 정한 설정. null = 읽기 전
  const [prefs, setPrefs] = useState<PrefsState | null>(null);
  // "기본 루틴 숨기기" 확인창
  const [hideDialog, setHideDialog] = useState(false);

  useEffect(() => {
    // 위와 같은 이유로 effect 안에서 저장소 값을 상태로 옮긴다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(loadPrefs());
  }, []);

  useEffect(() => {
    // 위와 같은 이유로 effect 안에서 저장소 값을 상태로 옮긴다
    const m = loadMyRoutines();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyRoutines(m.ok && !m.invalid ? m.routines : "unreadable");
  }, []);

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
    setMyRoutines([]);
    setPrefs({ kind: "none" }); // 처음 상태로: 기본 루틴을 다시 보여 주고 한 번 더 묻는다
    setRecent({ kind: "none" });
    setProfile({ kind: "none" }); // 닉네임을 새로 물어본다
    setNickInput("");
    setNickError(null);
  }

  /** 기본 루틴 보기 선택을 저장한다(저장에 실패해도 이번 화면에는 바로 반영한다) */
  function chooseDefaults(choice: "show" | "hide") {
    savePrefs({ defaultRoutines: choice });
    setPrefs({ kind: "set", prefs: { defaultRoutines: choice } });
    setHideDialog(false);
  }

  const defaultsVisible = showDefaultRoutines(prefs);
  // 닉네임 카드에 답한 뒤(또는 이미 답한 상태)에 처음 한 번 묻는다
  const askDefaults = prefs?.kind === "none" && profile !== null && profile.kind !== "none";

  const mine = Array.isArray(myRoutines) ? myRoutines : [];
  const deleteTarget = deleting ? mine.find((r) => r.id === deleting.id) : undefined;

  function handleDeleteRoutine() {
    if (!deleting) return;
    const r = deleteRoutine(deleting.id);
    if (!r.ok) {
      setDeleting({ id: deleting.id, error: r.message });
      return;
    }
    setMyRoutines(r.routines);
    setDeleting(null);
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
      </section>

      {/* 처음 한 번: 기본 루틴을 쓸지 묻는다 */}
      {askDefaults && (
        <section aria-labelledby="defaults-title" className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <h2 id="defaults-title" className="text-base font-bold">
            기본 루틴을 쓸까요?
          </h2>
          <p className="text-sm text-muted">
            상체 데이·하체 데이는 바로 써 볼 수 있는 예시 루틴이에요. 내 루틴만 쓰려면 숨길 수 있고, 나중에 홈에서
            다시 볼 수 있어요.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => chooseDefaults("hide")}
              className="min-h-11 rounded-xl bg-white/10 px-3"
            >
              내 루틴만 쓸게요
            </button>
            <button
              type="button"
              onClick={() => chooseDefaults("show")}
              className="min-h-11 rounded-xl bg-accent px-3 font-bold text-black"
            >
              기본 루틴 쓸게요
            </button>
          </div>
        </section>
      )}

      {defaultsVisible && (
      <section aria-labelledby="routine-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="routine-title" className="text-sm font-medium text-muted">
            기본 루틴
          </h2>
          {!askDefaults && (
            <button
              type="button"
              onClick={() => setHideDialog(true)}
              className="-mr-2 min-h-11 rounded-xl px-2 text-sm text-muted underline"
            >
              숨기기
            </button>
          )}
        </div>
        {SAMPLE_ROUTINES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              const routine = cloneRoutine(r.id); // 원본 샘플을 건드리지 않도록 복사본으로 시작
              if (routine) onSelectRoutine(routine);
            }}
            className="flex min-h-16 flex-col items-start justify-center rounded-2xl bg-surface px-4 py-3 text-left active:opacity-70"
          >
            <span className="text-lg font-bold">{r.name}</span>
            <span className="text-sm text-muted">
              {r.exercises.map((e) => e.name).join(" · ")}
            </span>
          </button>
        ))}
      </section>
      )}

      {myRoutines === "unreadable" && (
        <p role="alert" className="rounded-2xl bg-red-400/15 px-4 py-3 text-sm text-red-200">
          저장된 내 루틴을 읽을 수 없어요.
        </p>
      )}

      <section aria-labelledby="mine-title" className="flex flex-col gap-3">
        <h2 id="mine-title" className="text-sm font-medium text-muted">
          내 루틴
        </h2>
        {mine.length === 0 && myRoutines !== "unreadable" && (
          <p className="text-sm text-muted">아직 만든 루틴이 없어요. 아래 버튼으로 나만의 루틴을 만들어 보세요.</p>
        )}
        {mine.map((r) => (
            <div key={r.id} className="flex items-stretch gap-1 rounded-2xl bg-surface">
              <button
                type="button"
                onClick={() => onSelectRoutine(copyRoutine(r))}
                className="flex min-h-16 flex-1 flex-col items-start justify-center rounded-2xl px-4 py-3 text-left active:opacity-70"
              >
                <span className="text-lg font-bold">{r.name}</span>
                <span className="text-sm text-muted">{r.exercises.map((e) => e.name).join(" · ")}</span>
              </button>
              <button
                type="button"
                aria-label={`${r.name} 수정`}
                onClick={() => onEditRoutine(copyRoutine(r))}
                className="min-h-11 min-w-11 self-center rounded-xl px-2 text-sm text-muted underline"
              >
                수정
              </button>
              <button
                type="button"
                aria-label={`${r.name} 삭제`}
                onClick={() => setDeleting({ id: r.id, error: null })}
                className="mr-1 min-h-11 min-w-11 self-center rounded-xl px-2 text-sm text-red-300 underline"
              >
                삭제
              </button>
            </div>
          ))}
        <button
          type="button"
          onClick={onCreateRoutine}
          className="min-h-14 rounded-2xl bg-accent px-4 text-lg font-bold text-black"
        >
          + 루틴 만들기
        </button>
      </section>

      {!defaultsVisible && (
        <button
          type="button"
          onClick={() => chooseDefaults("show")}
          className="min-h-11 self-center rounded-xl px-4 text-sm text-muted underline"
        >
          기본 루틴 다시 보기
        </button>
      )}

      <button
        type="button"
        onClick={() => setResetDialog("")}
        className="mt-auto min-h-11 self-center rounded-xl px-4 text-sm text-muted underline"
      >
        데이터 초기화
      </button>

      {hideDialog && (
        <DeleteRecordDialog
          title="기본 루틴을 숨길까요?"
          note="상체 데이·하체 데이가 홈에서 사라져요. 지워지는 건 아니고, 홈 아래쪽 '기본 루틴 다시 보기'로 언제든 되돌릴 수 있어요."
          label="상체 데이 · 하체 데이"
          confirmText="숨기기"
          error={null}
          onCancel={() => setHideDialog(false)}
          onConfirm={() => chooseDefaults("hide")}
        />
      )}

      {deleting && deleteTarget && (
        <DeleteRecordDialog
          title="이 루틴을 삭제할까요?"
          note="삭제한 루틴은 되돌릴 수 없어요. 이미 저장된 운동 기록은 그대로 남아요."
          label={deleteTarget.name}
          error={deleting.error}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDeleteRoutine}
        />
      )}

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
