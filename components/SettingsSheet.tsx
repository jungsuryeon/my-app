"use client";

import { useEffect, useRef, useState } from "react";
import { WEIGHT_LIMITS, loadBody, saveBody, validateWeight, weightOf, type BodyState } from "@/lib/body";
import { loadPrefs, savePrefs, showDefaultRoutines, type PrefsState } from "@/lib/prefs";
import { NICKNAME_MAX, loadProfile, saveProfile, validateNickname, type ProfileState } from "@/lib/profile";
import { clearAll } from "@/lib/storage";
import ResetDialog from "./ResetDialog";
import { useModalKeys } from "./useModalKeys";

type Props = {
  onClose: () => void;
  /** 닉네임이 바뀌었을 때(홈 인사말을 갱신) */
  onProfileChange: (p: ProfileState) => void;
  /** 기본 루틴 보이기 설정이 바뀌었을 때 */
  onPrefsChange: (p: PrefsState) => void;
  /** 데이터 초기화가 끝났을 때(홈이 처음 상태로 돌아간다) */
  onReset: () => void;
};

// 설정 시트(톱니): 닉네임·체중·기본 루틴 보이기·데이터 초기화. 초기화는 실수로 누르지 않도록 맨 아래에 두고 확인창을 거친다.
export default function SettingsSheet({ onClose, onProfileChange, onPrefsChange, onReset }: Props) {
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [body, setBody] = useState<BodyState | null>(null);
  const [prefs, setPrefs] = useState<PrefsState | null>(null);
  const [nickInput, setNickInput] = useState("");
  const [nickError, setNickError] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [weightError, setWeightError] = useState<string | null>(null);
  const [editingWeight, setEditingWeight] = useState(false);
  // 데이터 초기화 확인창: null = 닫힘, 문자열 = 열림(값은 실패 안내, 빈 문자열이면 안내 없음)
  const [resetDialog, setResetDialog] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // 열리면 닫기 버튼에 초점, Tab은 시트 안에서만 돈다. ESC는 시트를 닫는다(초기화 확인창이 위에 있으면 그 창만 반응).
  useModalKeys(dialogRef, { onEscape: onClose, initialFocusRef: closeRef });

  useEffect(() => {
    // 저장소 값을 한 번 상태로 옮기는 것이라 effect 안에서 상태를 바꿀 수밖에 없다(PRD: 화면이 그려진 뒤에 읽는다)
    /* eslint-disable react-hooks/set-state-in-effect */
    const p = loadProfile();
    setProfile(p);
    if (p.kind === "set" && p.nickname) setNickInput(p.nickname);
    setBody(loadBody());
    setPrefs(loadPrefs());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const nickname = profile?.kind === "set" ? profile.nickname : null;
  const savedWeight = weightOf(body);
  const defaultsOn = showDefaultRoutines(prefs);

  function handleSaveNickname() {
    const v = validateNickname(nickInput);
    if (!v.ok) {
      setNickError(v.error);
      return;
    }
    if (!saveProfile(v.nickname)) {
      setNickError("저장하지 못했어요. 다시 시도해 주세요.");
      return;
    }
    const next: ProfileState = { kind: "set", nickname: v.nickname };
    setNickError(null);
    setProfile(next);
    onProfileChange(next);
  }

  function handleClearNickname() {
    if (!saveProfile(null)) {
      setNickError("지우지 못했어요. 다시 시도해 주세요.");
      return;
    }
    const next: ProfileState = { kind: "set", nickname: null };
    setNickError(null);
    setNickInput("");
    setProfile(next);
    onProfileChange(next);
  }

  function handleSaveWeight() {
    const v = validateWeight(weightInput);
    if (!v.ok) {
      setWeightError(v.error);
      return;
    }
    if (!saveBody(v.weightKg)) {
      setWeightError("저장하지 못했어요. 다시 시도해 주세요.");
      return;
    }
    setWeightError(null);
    setBody({ kind: "set", weightKg: v.weightKg });
    setEditingWeight(false);
  }

  function handleClearWeight() {
    if (!saveBody(null)) {
      setWeightError("지우지 못했어요. 다시 시도해 주세요.");
      return;
    }
    setWeightError(null);
    setBody({ kind: "set", weightKg: null });
    setWeightInput("");
    setEditingWeight(false);
  }

  function toggleDefaults() {
    const choice = defaultsOn ? "hide" : "show";
    savePrefs({ defaultRoutines: choice }); // 저장에 실패해도 이번 화면에는 바로 반영한다
    const next: PrefsState = { kind: "set", prefs: { defaultRoutines: choice } };
    setPrefs(next);
    onPrefsChange(next);
  }

  function handleReset() {
    const r = clearAll();
    if (!r.ok) {
      setResetDialog("삭제하지 못했어요. 브라우저 설정을 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    setResetDialog(null);
    onReset();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-3 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="mb-3 flex max-h-[88dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-3xl bg-surface p-5 shadow-card"
      >
        <header className="flex items-center justify-between">
          <h2 id="settings-title" className="text-xl font-bold">
            설정
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="설정 닫기"
            className="-mr-2 min-h-11 min-w-11 rounded-xl px-2 text-lg"
          >
            ✕
          </button>
        </header>

        <section aria-labelledby="set-nick" className="flex flex-col gap-2">
          <h3 id="set-nick" className="text-sm font-medium text-muted">
            닉네임 <span className="font-normal">(선택)</span>
          </h3>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveNickname();
            }}
          >
            <label htmlFor="set-nick-input" className="sr-only">
              닉네임
            </label>
            <input
              id="set-nick-input"
              type="text"
              autoComplete="off"
              maxLength={NICKNAME_MAX * 2}
              value={nickInput}
              onChange={(e) => setNickInput(e.target.value)}
              aria-invalid={nickError ? true : undefined}
              placeholder={`최대 ${NICKNAME_MAX}글자`}
              className={`min-h-11 w-full rounded-xl bg-background px-3 text-base outline-none focus:ring-2 ${
                nickError ? "ring-2 ring-red-400" : "focus:ring-accent"
              }`}
            />
            <button type="submit" className="min-h-11 shrink-0 rounded-xl bg-accent px-4 font-bold text-on-accent">
              저장
            </button>
          </form>
          {nickname && (
            <button
              type="button"
              onClick={handleClearNickname}
              className="min-h-11 self-start rounded-xl px-2 text-sm text-danger underline"
            >
              닉네임 지우기
            </button>
          )}
          {nickError && (
            <p role="alert" className="text-sm text-danger">
              {nickError}
            </p>
          )}
        </section>

        <section aria-labelledby="set-weight" className="flex flex-col gap-2">
          <h3 id="set-weight" className="text-sm font-medium text-muted">
            체중 <span className="font-normal">(선택 · 칼로리 계산용)</span>
          </h3>
          {savedWeight !== null && !editingWeight ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-bold">{savedWeight}kg</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setWeightInput(String(savedWeight));
                    setEditingWeight(true);
                  }}
                  className="min-h-11 rounded-xl px-3 text-sm text-muted underline"
                >
                  바꾸기
                </button>
                <button
                  type="button"
                  onClick={handleClearWeight}
                  className="min-h-11 rounded-xl px-3 text-sm text-danger underline"
                >
                  지우기
                </button>
              </div>
            </div>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveWeight();
              }}
            >
              <label htmlFor="weight" className="sr-only">
                체중(kg)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="weight"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  aria-invalid={weightError ? true : undefined}
                  placeholder={`${WEIGHT_LIMITS.min}~${WEIGHT_LIMITS.max}`}
                  className={`min-h-11 w-full rounded-xl bg-background px-3 text-base outline-none focus:ring-2 ${
                    weightError ? "ring-2 ring-red-400" : "focus:ring-accent"
                  }`}
                />
                <span className="text-sm text-muted">kg</span>
                <button type="submit" className="min-h-11 shrink-0 rounded-xl bg-accent px-4 font-bold text-on-accent">
                  저장
                </button>
              </div>
              {weightError && (
                <p role="alert" className="text-sm text-danger">
                  {weightError}
                </p>
              )}
              <p className="text-xs text-muted">
                이 폰에만 저장되고 서버로 보내지 않아요. 입력하지 않아도 모든 기능을 쓸 수 있어요. 칼로리는 참고용
                추정값이에요.
              </p>
            </form>
          )}
        </section>

        <section aria-labelledby="set-defaults" className="flex items-center justify-between gap-3">
          <div>
            <h3 id="set-defaults" className="text-sm font-medium text-muted">
              기본 루틴 보이기
            </h3>
            <p className="text-sm">상체 데이 · 하체 데이</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={defaultsOn}
            aria-labelledby="set-defaults"
            onClick={toggleDefaults}
            className={`relative min-h-11 w-16 shrink-0 rounded-full transition-colors ${
              defaultsOn ? "bg-accent" : "bg-chip-strong"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-surface shadow-card transition-all ${
                defaultsOn ? "left-[calc(100%-2.25rem)]" : "left-1"
              }`}
            />
          </button>
        </section>

        <section aria-labelledby="set-privacy" className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 id="set-privacy" className="text-sm font-medium text-muted">
            개인정보 안내
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
            <li>
              닉네임·체중·운동 기록·내 루틴은 이 폰의 브라우저에만 저장되고 서버로 보내지 않아요. 암호화되어 있지
              않으니 폰을 함께 쓰면 다른 사람이 볼 수 있어요.
            </li>
            <li>
              동작 영상(GIF)을 열면 이 폰의 IP 주소 등이 ExerciseDB에 전달될 수 있어요. 사이트 서버(Vercel)의 접속
              기록에도 IP가 남을 수 있어요. 닉네임과 운동 기록은 보내지 않아요.
            </li>
            <li>
              브라우저 데이터를 지우거나 오래 쓰지 않으면(특히 iPhone Safari) 저장된 기록이 사라질 수 있어요. 아래
              버튼으로 직접 지울 수도 있어요.
            </li>
          </ul>
        </section>

        <section aria-labelledby="set-reset" className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 id="set-reset" className="text-sm font-medium text-muted">
            데이터
          </h3>
          <button
            type="button"
            onClick={() => setResetDialog("")}
            className="min-h-12 rounded-2xl bg-card-peach px-4 text-base font-bold text-peach-ink"
          >
            데이터 초기화
          </button>
          <p className="text-xs text-muted">누르면 확인창이 떠요. 확인하기 전에는 아무것도 지워지지 않아요.</p>
        </section>
      </div>

      {resetDialog !== null && (
        <ResetDialog error={resetDialog || null} onCancel={() => setResetDialog(null)} onConfirm={handleReset} />
      )}
    </div>
  );
}
