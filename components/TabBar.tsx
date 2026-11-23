"use client";

export type Tab = "home" | "search" | "records";

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

const ICON = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-6 w-6",
  "aria-hidden": true,
} as const;

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" {...ICON}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" {...ICON}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

const TABS: { id: Tab; label: string; icon: () => React.ReactNode }[] = [
  { id: "home", label: "홈", icon: HomeIcon },
  { id: "search", label: "운동 찾기", icon: SearchIcon },
  { id: "records", label: "운동 기록", icon: CalendarIcon },
];

/** 이 높이만큼 화면 내용 아래에 여백을 둬서 탭에 가려지지 않게 한다(탭 56px + 아래 Safe Area) */
export const TAB_BAR_PADDING = "pb-[calc(4.5rem+env(safe-area-inset-bottom))]";

// 하단 3탭. 운동 진행 중에는 부르는 쪽에서 아예 그리지 않는다(타이머 화면을 방해하지 않기 위함).
export default function TabBar({ active, onChange }: Props) {
  return (
    <nav
      aria-label="하단 탭"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => onChange(id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs active:opacity-70 ${
                on ? "font-bold text-accent-ink" : "text-muted"
              }`}
            >
              <Icon />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
