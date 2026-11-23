"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { copyRoutine, deleteRoutine, loadMyRoutines } from "@/lib/myRoutines";
import { loadPrefs, savePrefs, showDefaultRoutines, type PrefsState } from "@/lib/prefs";
import { greeting, loadProfile, type ProfileState } from "@/lib/profile";
import { formatRecordLine, latestRecord, loadRecords } from "@/lib/records";
import { SAMPLE_ROUTINES, cloneRoutine, type Routine } from "@/lib/routines";
import AssetImage, { DumbbellIcon, SoftBlob } from "./AssetImage";
import DeleteRecordDialog from "./DeleteRecordDialog";
import Mascot from "./Mascot";
import SettingsSheet from "./SettingsSheet";
import type { Tab } from "./TabBar";

/** 카드 등장 순서(globals.css의 .rise가 --i 값만큼 늦게 시작한다) */
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

/** 최근 기록 칸에 보여 줄 내용 */
type Recent = { kind: "none" } | { kind: "line"; text: string } | { kind: "unreadable" };

type Props = {
  /** 루틴 카드를 누르면 그 루틴의 복사본으로 호출(시작 전 값 수정이 원본을 바꾸지 않도록) */
  onSelectRoutine: (routine: Routine) => void;
  /** "루틴 만들기" 버튼 */
  onCreateRoutine: () => void;
  /** 내 루틴의 "수정" 버튼 */
  onEditRoutine: (routine: Routine) => void;
  /** "운동 캘린더 보기"·"운동 찾기" 바로가기: 해당 탭으로 */
  onGoTab: (tab: Tab) => void;
};

/** 기본 루틴 카드 색: 상체 = 민트, 하체 = 라벤더 */
const DEFAULT_STYLE: Record<string, { card: string; play: string; art: string; tone: "mint" | "lavender" }> = {
  upper: { card: "bg-card-mint", play: "text-accent-ink", art: "/mascot/routine-upper.webp", tone: "mint" },
  lower: { card: "bg-card-lavender", play: "text-lavender-ink", art: "/mascot/routine-lower.webp", tone: "lavender" },
};

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

/** 일러스트 자리(에셋이 없으면 파스텔 도형) */
function RoutineArt({ src, tone }: { src: string; tone: "mint" | "lavender" | "peach" }) {
  return (
    <AssetImage
      src={src}
      alt=""
      width={84}
      fallback={
        <SoftBlob tone={tone}>
          <DumbbellIcon className="h-1/2 w-1/2 text-on-accent" />
        </SoftBlob>
      }
    />
  );
}

function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-lg font-bold">
      {icon}
      {children}
    </div>
  );
}

// 홈 탭: 로고·캐릭터, 최근 기록, 기본 루틴·내 루틴, 바로가기. 닉네임·체중·기본 루틴 보이기·초기화는 톱니 설정 시트에 있다.
export default function Home({ onSelectRoutine, onCreateRoutine, onEditRoutine, onGoTab }: Props) {
  // 처음 그릴 때는 기록이 없는 것으로 두고(서버 화면과 같게), 그려진 뒤에 저장소에서 읽는다
  const [recent, setRecent] = useState<Recent>({ kind: "none" });
  // 닉네임 상태(인사말에만 쓴다. 입력은 설정 시트에서). null = 아직 읽기 전
  const [profile, setProfile] = useState<ProfileState | null>(null);
  // 내 루틴. null = 읽기 전, "unreadable" = 읽을 수 없음
  const [myRoutines, setMyRoutines] = useState<Routine[] | "unreadable" | null>(null);
  // 삭제 확인창: 대상 루틴 id와 실패 안내
  const [deleting, setDeleting] = useState<{ id: string; error: string | null } | null>(null);
  // 기본 루틴을 보일지 정한 설정. null = 읽기 전
  const [prefs, setPrefs] = useState<PrefsState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 저장소 값은 화면이 그려진 뒤(useEffect)에만 읽고, 한 번 상태로 옮기는 것이라 effect 안에서 상태를 바꾼다(PRD)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPrefs(loadPrefs());
    setProfile(loadProfile());
    const m = loadMyRoutines();
    setMyRoutines(m.ok && !m.invalid ? m.routines : "unreadable");
    const r = loadRecords();
    if (!r.ok || r.invalid) {
      setRecent({ kind: "unreadable" });
      return;
    }
    const latest = latestRecord(r.records);
    setRecent(latest ? { kind: "line", text: formatRecordLine(latest) } : { kind: "none" });
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** 설정 시트에서 데이터 초기화가 끝났을 때: 화면을 처음 상태로 되돌린다 */
  function handleResetDone() {
    setMyRoutines([]);
    setPrefs({ kind: "none" }); // 기본 루틴을 다시 보여 주고 한 번 더 묻는다
    setRecent({ kind: "none" });
    setProfile({ kind: "none" });
  }

  /** 기본 루틴 보기 선택을 저장한다(저장에 실패해도 이번 화면에는 바로 반영한다) */
  function chooseDefaults(choice: "show" | "hide") {
    savePrefs({ defaultRoutines: choice });
    setPrefs({ kind: "set", prefs: { defaultRoutines: choice } });
  }

  const defaultsVisible = showDefaultRoutines(prefs);
  // 아직 고른 적이 없으면 처음 한 번 묻는다
  const askDefaults = prefs?.kind === "none";

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      {/* 상단: 로고 + 문구 + 설정 + 캐릭터 */}
      <header className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute -right-6 top-6 h-44 w-44 rounded-full bg-lavender/50" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-8 top-28 h-24 w-40 rounded-full bg-peach/50" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AssetImage
                src="/mascot/logo-dumbbell.webp"
                alt=""
                width={44}
                fallback={
                  <span className="flex h-full w-full items-center justify-center rounded-2xl bg-accent/70 text-on-accent">
                    <DumbbellIcon className="h-3/5 w-3/5" />
                  </span>
                }
              />
              <h1 className="text-3xl font-extrabold tracking-tight">
                Rep<span className="text-accent-ink">Timer</span>
              </h1>
            </div>
            {hello && <p className="mt-1 text-lg font-medium">{hello}</p>}
            <p className="mt-1 text-sm text-muted">반복·세트·휴식을 자동으로 진행해 드려요.</p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="설정"
            className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-2xl bg-surface text-muted shadow-card press active:opacity-70"
          >
            <GearIcon />
          </button>
        </div>
        <div className="relative mt-3 flex items-end justify-between">
          <p className="mb-8 rounded-3xl rounded-bl-md bg-lavender px-5 py-3 text-lg font-bold leading-snug text-lavender-ink shadow-card">
            오늘도
            <br />
            운동 시작!
          </p>
          <Mascot size={176} />
        </div>
      </header>

      {/* 1. 내 루틴 */}
      <section style={stagger(0)} aria-labelledby="mine-title" className="rise flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="mine-title">
            <SectionTitle
              icon={
                <span className="text-lavender-ink">
                  <DumbbellIcon className="h-6 w-6" />
                </span>
              }
            >
              내 루틴
            </SectionTitle>
          </h2>
          <button
            type="button"
            onClick={onCreateRoutine}
            className="min-h-11 rounded-full bg-lavender px-4 text-base font-bold text-lavender-ink shadow-card press active:opacity-80"
          >
            + 루틴 만들기
          </button>
        </div>
        {myRoutines === "unreadable" && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            저장된 내 루틴을 읽을 수 없어요.
          </p>
        )}
        {mine.length === 0 && myRoutines !== "unreadable" && (
          <p className="rounded-2xl border-2 border-dashed border-line px-4 py-3 text-sm text-muted">
            아직 만든 루틴이 없어요. 위의 &quot;+ 루틴 만들기&quot;로 나만의 루틴을 만들어 보세요.
          </p>
        )}
        {mine.map((r) => (
          <div key={r.id} className="flex items-stretch gap-1 rounded-3xl bg-card-peach shadow-card">
            <button
              type="button"
              onClick={() => onSelectRoutine(copyRoutine(r))}
              className="flex min-h-[5.5rem] min-w-0 flex-1 items-center gap-3 rounded-3xl px-4 py-3 text-left press active:opacity-80"
            >
              <RoutineArt src="/mascot/routine-custom.webp" tone="peach" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-bold">{r.name}</span>
                <span className="block truncate text-sm text-muted">{r.exercises.map((e) => e.name).join(" · ")}</span>
              </span>
            </button>
            <div className="flex flex-col justify-center pr-1">
              <button
                type="button"
                aria-label={`${r.name} 수정`}
                onClick={() => onEditRoutine(copyRoutine(r))}
                className="min-h-11 min-w-11 rounded-xl px-2 text-sm text-muted underline"
              >
                수정
              </button>
              <button
                type="button"
                aria-label={`${r.name} 삭제`}
                onClick={() => setDeleting({ id: r.id, error: null })}
                className="min-h-11 min-w-11 rounded-xl px-2 text-sm text-danger underline"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* 처음 한 번: 기본 루틴을 쓸지 묻는다 */}
      {askDefaults && (
        <section style={stagger(1)} aria-labelledby="defaults-title" className="rise flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-card">
          <h2 id="defaults-title" className="text-base font-bold">
            기본 루틴을 쓸까요?
          </h2>
          <p className="text-sm text-muted">
            상체 데이·하체 데이는 바로 써 볼 수 있는 예시 루틴이에요. 내 루틴만 쓰려면 숨길 수 있고, 나중에 설정(톱니)
            에서 다시 볼 수 있어요.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => chooseDefaults("hide")} className="min-h-11 rounded-xl bg-chip px-3">
              내 루틴만 쓸게요
            </button>
            <button
              type="button"
              onClick={() => chooseDefaults("show")}
              className="min-h-11 rounded-xl bg-accent px-3 font-bold text-on-accent shadow-button"
            >
              기본 루틴 쓸게요
            </button>
          </div>
        </section>
      )}

      {/* 2. 기본 루틴(숨길 수 있다. 다시 보이기는 설정 시트) */}
      {defaultsVisible && (
        <section style={stagger(2)} aria-labelledby="routine-title" className="rise flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="routine-title">
              <SectionTitle>기본 루틴</SectionTitle>
            </h2>
            {prefs?.kind === "set" && (
              <button
                type="button"
                onClick={() => chooseDefaults("hide")}
                className="min-h-11 rounded-full bg-chip px-4 text-sm text-muted press active:opacity-80"
              >
                숨기기
              </button>
            )}
          </div>
          {SAMPLE_ROUTINES.map((r) => {
            const s = DEFAULT_STYLE[r.id] ?? DEFAULT_STYLE.upper;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  const routine = cloneRoutine(r.id); // 원본 샘플을 건드리지 않도록 복사본으로 시작
                  if (routine) onSelectRoutine(routine);
                }}
                aria-label={`${r.name} 시작`}
                className={`flex min-h-[7rem] items-center gap-3 rounded-3xl ${s.card} p-4 text-left shadow-card press active:opacity-80`}
              >
                <RoutineArt src={s.art} tone={s.tone} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-bold">{r.name}</span>
                  <span className="mt-1 block text-sm text-muted">{r.exercises.map((e) => e.name).join(" · ")}</span>
                </span>
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface shadow-card ${s.play}`}>
                  <PlayIcon />
                </span>
              </button>
            );
          })}
        </section>
      )}

      {/* 3. 최근 기록 */}
      <section style={stagger(3)} aria-labelledby="recent-title" className="rise flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-card">
        <h2 id="recent-title" className="flex items-center gap-2 text-lg font-bold">
          <span className="text-accent-ink">
            <CalendarIcon />
          </span>
          최근 기록
        </h2>
        {recent.kind === "line" ? (
          <p className="rounded-2xl bg-background px-4 py-3 text-base">{recent.text}</p>
        ) : recent.kind === "unreadable" ? (
          <p className="rounded-2xl bg-danger-soft px-4 py-3 text-base text-danger">저장된 기록을 읽을 수 없어요</p>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-3">
            <AssetImage
              src="/mascot/empty-record.webp"
              alt=""
              width={56}
              fallback={
                <SoftBlob tone="peach">
                  <DumbbellIcon className="h-1/2 w-1/2 text-peach-ink" />
                </SoftBlob>
              }
            />
            <p className="text-base text-muted">아직 기록이 없습니다</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => onGoTab("records")}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-base font-bold text-on-accent shadow-button press active:opacity-80"
        >
          <CalendarIcon />
          운동 캘린더 보기
          <span aria-hidden="true">›</span>
        </button>
      </section>

      <button
        type="button"
        onClick={() => onGoTab("search")}
        className="flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-accent px-4 text-lg font-bold text-on-accent shadow-button press active:opacity-80"
      >
        <SearchIcon />
        운동 찾기
      </button>

      {settingsOpen && (
        <SettingsSheet
          onClose={() => setSettingsOpen(false)}
          onProfileChange={setProfile}
          onPrefsChange={setPrefs}
          onReset={handleResetDone}
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
    </main>
  );
}
