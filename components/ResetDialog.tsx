"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** 삭제 실패 안내. 없으면 보이지 않는다 */
  error: string | null;
  /** 취소: 아무것도 지우지 않고 닫는다 */
  onCancel: () => void;
  /** 삭제: 저장된 모든 데이터를 지운다 */
  onConfirm: () => void;
};

// 데이터 초기화 확인창. "삭제"를 눌러야만 지워진다.
export default function ResetDialog({ error, onCancel, onConfirm }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 열리면 "취소"에 초점을 둔다(실수로 지워지지 않도록 가장 안전한 선택)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-8 sm:items-center"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
        className="flex w-full max-w-md flex-col gap-3 rounded-3xl bg-surface p-5"
      >
        <h2 id="reset-title" className="text-xl font-bold">
          데이터 초기화
        </h2>
        <p id="reset-desc" className="text-base">
          저장된 기록과 닉네임·진행 상태가 모두 삭제됩니다
        </p>
        <p className="text-sm text-muted">삭제한 데이터는 되돌릴 수 없어요.</p>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-2xl bg-white/10 px-4 text-lg font-bold"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-12 rounded-2xl bg-red-400/25 px-4 text-lg font-bold text-red-200"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
