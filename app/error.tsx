"use client";

import { clearSnapshot } from "@/lib/records";

// 화면을 그리다 예상하지 못한 오류가 났을 때 보이는 화면.
// 저장된 진행 상태가 깨져서 매번 같은 오류가 나는 경우에도 빠져나올 수 있게 "진행 상태 지우기"를 둔다.
// (운동 기록·내 루틴·설정은 지우지 않는다)
export default function ErrorScreen({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-2xl font-bold">문제가 생겼어요</h1>
      <p className="text-sm text-muted">
        화면을 불러오다 오류가 났어요. 다시 시도해 보세요. 계속 같은 오류가 나면 진행 중이던 운동 상태를 지우고 다시
        시작할 수 있어요. 저장된 운동 기록과 내 루틴은 지워지지 않아요.
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-12 w-full rounded-3xl bg-accent px-4 text-lg font-bold text-on-accent shadow-button press"
      >
        다시 시도
      </button>
      <button
        type="button"
        onClick={() => {
          clearSnapshot();
          window.location.reload();
        }}
        className="min-h-12 w-full rounded-2xl bg-chip px-4 text-base font-bold press"
      >
        진행 중이던 운동 상태 지우고 다시 시작
      </button>
    </main>
  );
}
