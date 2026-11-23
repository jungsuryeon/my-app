// 모달 키보드 처리에 쓰는 순수 로직(화면 없이 시험할 수 있게 lib에 둔다).

/**
 * 열려 있는 모달을 열린 순서대로 기억한다. 키보드(Tab·ESC)는 맨 위(마지막으로 열린) 모달만 처리한다.
 * 설정 시트 위에 초기화 확인창이 열리면 확인창만 키를 받는다.
 */
export function createModalStack() {
  const ids: symbol[] = [];
  return {
    /** 모달이 열릴 때 등록한다. 이미 있으면 중복 등록하지 않는다 */
    push(id: symbol) {
      if (!ids.includes(id)) ids.push(id);
    },
    /** 모달이 닫힐 때 뺀다. 없으면 아무 일도 없다 */
    remove(id: symbol) {
      const i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1);
    },
    /** 이 모달이 맨 위인가 */
    isTop(id: symbol) {
      return ids.length > 0 && ids[ids.length - 1] === id;
    },
    size() {
      return ids.length;
    },
  };
}

/**
 * Tab 한 번에 포커스가 가야 할 칸 번호. 모달 안에서만 돌게 한다.
 * @param count 모달 안 포커스 가능한 요소 수
 * @param current 지금 포커스가 있는 칸 번호(모달 밖이거나 모르면 -1)
 * @param shift Shift+Tab이면 true
 * @returns 이동할 칸 번호. 요소가 없으면 -1
 */
export function nextFocusIndex(count: number, current: number, shift: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return shift ? count - 1 : 0; // 밖에 있으면 안으로 끌어온다
  if (shift) return current === 0 ? count - 1 : current - 1;
  return current === count - 1 ? 0 : current + 1;
}
