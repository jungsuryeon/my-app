"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** 무엇을 지우는지 보여 주는 한 줄(예: "11월 3일 · 상체 데이") */
  label: string;
  /** 제목. 기본은 기록 삭제 문구 */
  title?: string;
  /** 되돌릴 수 없다는 안내. 기본은 기록 문구 */
  note?: string;
  /** 확인 버튼 글자. 기본 "삭제" */
  confirmText?: string;
  /** 취소 버튼 글자. 기본 "취소" */
  cancelText?: string;
  /** 삭제 실패 안내. 없으면 보이지 않는다 */
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

// 기록 하나를 지우기 전 확인창. "삭제"를 눌러야만 지워진다.
export default function DeleteRecordDialog({
  label,
  title = "이 기록을 삭제할까요?",
  note = "삭제한 기록은 되돌릴 수 없어요.",
  confirmText = "삭제",
  cancelText = "취소",
  error,
  onCancel,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 열리면 "취소"에 초점을 둔다(실수로 지워지지 않도록 가장 안전한 선택)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-4 pb-8 sm:items-center"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="del-title"
        aria-describedby="del-desc"
        className="flex w-full max-w-md flex-col gap-3 rounded-3xl bg-surface shadow-card p-5"
      >
        <h2 id="del-title" className="text-xl font-bold">
          {title}
        </h2>
        <p id="del-desc" className="text-base">
          {label}
        </p>
        <p className="text-sm text-muted">{note}</p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-2xl bg-chip px-4 text-lg font-bold press"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-12 rounded-2xl bg-danger-soft px-4 text-lg font-bold text-danger"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
