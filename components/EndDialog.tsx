"use client";

import { useRef } from "react";
import { useModalKeys } from "./useModalKeys";

type Props = {
  /** 계속하기: 창을 닫고 누르기 전 상태로 돌아간다 */
  onContinue: () => void;
  /** 저장 후 종료: 종료 화면으로 가서 반복 수를 확인하고 저장한다 */
  onSaveAndEnd: () => void;
  /** 저장 안 하고 종료: 기록 없이 홈으로 */
  onDiscard: () => void;
};

// 전체 종료 확인창. 화면 전체를 덮고, 세 버튼 중 하나를 골라야 닫힌다.
export default function EndDialog({ onContinue, onSaveAndEnd, onDiscard }: Props) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // 열리면 "계속하기"에 초점을 둔다(실수로 종료되지 않도록 가장 안전한 선택). Tab은 창 안에서만 돌고,
  // ESC는 "계속하기"와 같다(종료·저장은 하지 않는다. 일시정지 중이었다면 일시정지 상태 그대로).
  useModalKeys(dialogRef, { onEscape: onContinue, initialFocusRef: firstRef });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-4 pb-8 sm:items-center"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-title"
        className="flex w-full max-w-md flex-col gap-3 rounded-3xl bg-surface shadow-card p-5"
      >
        <h2 id="end-title" className="text-xl font-bold">
          운동을 끝낼까요?
        </h2>
        <p className="text-sm text-muted">
          못 한 세트는 &quot;미수행&quot;으로 남아요. 지금까지 한 세트만 저장할 수 있어요.
        </p>
        <button
          ref={firstRef}
          type="button"
          onClick={onContinue}
          className="min-h-12 rounded-3xl bg-accent px-4 text-lg font-bold text-on-accent shadow-button press"
        >
          계속하기
        </button>
        <button
          type="button"
          onClick={onSaveAndEnd}
          className="min-h-12 rounded-2xl bg-chip px-4 text-lg font-bold press"
        >
          저장 후 종료
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="min-h-12 rounded-2xl px-4 text-lg text-danger"
        >
          저장 안 하고 종료
        </button>
      </div>
    </div>
  );
}
