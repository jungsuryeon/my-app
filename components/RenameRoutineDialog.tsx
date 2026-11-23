"use client";

import { useEffect, useRef, useState } from "react";
import { MY_ROUTINE_LIMITS } from "@/lib/myRoutines";

type Props = {
  /** 지금 이름 */
  initialName: string;
  /** 저장 실패·이름 오류 안내. 없으면 보이지 않는다 */
  error: string | null;
  onCancel: () => void;
  /** 입력한 이름으로 바꾼다. 검사는 부르는 쪽에서 한다 */
  onConfirm: (name: string) => void;
};

// 루틴 이름 바꾸기 창
export default function RenameRoutineDialog({ initialName, error, onCancel, onConfirm }: Props) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-8 sm:items-center"
      role="presentation"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        className="flex w-full max-w-md flex-col gap-3 rounded-3xl bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(name);
        }}
      >
        <h2 id="rename-title" className="text-xl font-bold">
          루틴 이름 바꾸기
        </h2>
        <label htmlFor="rename-input" className="sr-only">
          루틴 이름
        </label>
        <input
          id="rename-input"
          ref={inputRef}
          type="text"
          autoComplete="off"
          maxLength={MY_ROUTINE_LIMITS.nameMax * 2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`최대 ${MY_ROUTINE_LIMITS.nameMax}글자`}
          className="min-h-11 rounded-xl bg-background px-3 text-base outline-none focus:ring-2 focus:ring-accent"
        />
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl bg-white/10 px-4 text-lg font-bold">
            취소
          </button>
          <button type="submit" className="min-h-12 rounded-2xl bg-accent px-4 text-lg font-bold text-black">
            저장
          </button>
        </div>
      </form>
    </div>
  );
}
