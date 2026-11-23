"use client";

import { useState } from "react";
import AssetImage, { DumbbellIcon, SoftBlob } from "./AssetImage";

/** idle = 덤벨 든 기본 포즈, cheer = 축하 포즈(운동 완료 때 전환) */
export type MascotPose = "idle" | "cheer";

type Props = {
  pose?: MascotPose;
  /** 표시 크기(px) */
  size?: number;
  className?: string;
};

// 캐릭터 영역을 맡는 독립 컴포넌트. 별도로 제작한 투명 배경 WebP(public/mascot/)를 쓰고,
// 이미지가 없거나 불러오지 못하면 같은 크기의 대체 화면을 보여 준다(MASCOT-에셋.md 참고).
// 움직임은 CSS만 쓴다(globals.css). idle은 둥실 + 누르면 통통, cheer는 폴짝.
// 움직임 줄이기 설정이면 CSS 쪽에서 모두 꺼진다.
export default function Mascot({ pose = "idle", size = 176, className = "" }: Props) {
  // 누르면 통통 클래스를 붙이고, 애니메이션이 끝나면 떼서 다음 터치에 다시 재생한다
  const [bouncing, setBouncing] = useState(false);

  return (
    <div className={`shrink-0 ${pose === "cheer" ? "motion-cheer" : "motion-float"} ${className}`}>
      <div
        onPointerDown={() => setBouncing(true)}
        onAnimationEnd={() => setBouncing(false)}
        className={`${bouncing ? "motion-bounce" : ""} cursor-pointer select-none`}
      >
        <AssetImage
          src={`/mascot/mascot-${pose}.webp`}
          alt={pose === "cheer" ? "축하하는 RepTimer 캐릭터" : "덤벨을 든 RepTimer 캐릭터"}
          width={size}
          fallback={
            <SoftBlob tone={pose === "cheer" ? "mint" : "lavender"}>
              <DumbbellIcon />
            </SoftBlob>
          }
        />
      </div>
    </div>
  );
}
