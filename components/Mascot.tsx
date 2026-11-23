"use client";

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
// 둥실·터치 반응 같은 움직임은 6단계에서 이 컴포넌트에 붙인다.
export default function Mascot({ pose = "idle", size = 176, className = "" }: Props) {
  return (
    <AssetImage
      src={`/mascot/mascot-${pose}.webp`}
      alt={pose === "cheer" ? "축하하는 RepTimer 캐릭터" : "덤벨을 든 RepTimer 캐릭터"}
      width={size}
      className={className}
      fallback={
        <SoftBlob tone={pose === "cheer" ? "mint" : "lavender"}>
          <DumbbellIcon />
        </SoftBlob>
      }
    />
  );
}
