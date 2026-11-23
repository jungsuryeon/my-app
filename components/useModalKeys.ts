"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createModalStack, nextFocusIndex } from "@/lib/modalStack";

// 열려 있는 모달 목록(앱 전체에서 하나). 맨 위 모달만 키보드를 처리한다.
const stack = createModalStack();

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getAttribute("aria-hidden") !== "true" && el.getClientRects().length > 0,
  );
}

/** 모달을 연 버튼이 사라졌을 때(예: 삭제) 포커스를 잃지 않도록 화면의 본문으로 보낸다 */
function focusFallback() {
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.style.outline = "none";
  main.focus({ preventScroll: true });
}

type Options = {
  /** ESC를 눌렀을 때. 없으면 ESC를 무시한다. 중요한 작업(삭제·초기화·종료)은 반드시 "취소·계속하기"에 연결한다 */
  onEscape?: () => void;
  /** 열릴 때 포커스를 둘 요소(가장 안전한 버튼). 없으면 첫 번째 요소 */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * 모달 키보드 접근성: 열리면 안으로 포커스, Tab·Shift+Tab은 모달 안에서만 순환, ESC 처리,
 * 닫히면 열었던 요소로 포커스 복귀. 중첩 모달이면 맨 위 모달만 키를 받는다.
 * @param containerRef 모달 본문(role="dialog" 요소)
 */
export function useModalKeys(containerRef: RefObject<HTMLElement | null>, options: Options = {}) {
  // 최신 콜백을 쓰되 효과(이벤트 등록)는 모달이 열린 동안 한 번만 하도록 ref에 담는다
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const id = Symbol("modal");
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stack.push(id);

    // 안쪽으로 포커스 이동
    const initial = optionsRef.current.initialFocusRef?.current ?? focusablesIn(container)[0] ?? container;
    if (!initial.hasAttribute("tabindex") && initial === container) container.setAttribute("tabindex", "-1");
    initial.focus({ preventScroll: true });

    function onKeyDown(e: KeyboardEvent) {
      if (!stack.isTop(id) || e.isComposing) return; // 맨 위 모달만
      if (e.key === "Escape") {
        const esc = optionsRef.current.onEscape;
        if (!esc) return;
        e.preventDefault();
        esc();
        return;
      }
      if (e.key !== "Tab" || !container) return;
      const items = focusablesIn(container);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = nextFocusIndex(items.length, current, e.shiftKey);
      // 안에서 평범하게 이동하면 브라우저에 맡기고, 끝에서 넘어가거나 밖에 있을 때만 직접 옮긴다
      const edge = current < 0 || (e.shiftKey ? current === 0 : current === items.length - 1);
      if (edge && next >= 0) {
        e.preventDefault();
        items[next].focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      stack.remove(id);
      // 열었던 버튼이 아직 있으면 돌아가고, 사라졌으면 본문으로 보낸다. 위에 다른 모달이 남아 있으면 건드리지 않는다.
      if (stack.size() === 0 || opener?.isConnected) {
        if (opener?.isConnected) opener.focus({ preventScroll: true });
        else focusFallback();
      }
    };
  }, [containerRef]);
}
