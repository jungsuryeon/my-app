"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  /** `public/` 기준 주소(예: /mascot/mascot-idle.webp) */
  src: string;
  alt: string;
  /** 표시 크기(px). 미리 잡아 두므로 이미지가 늦게 떠도 화면이 밀리지 않는다 */
  width: number;
  height?: number;
  className?: string;
  /** 이미지가 없거나 불러오지 못했을 때 같은 자리에 보여 줄 화면 */
  fallback: ReactNode;
};

// 정적 이미지(WebP) 하나를 같은 크기의 자리에 그린다. 없거나 실패하면 fallback을 대신 보여 준다.
// 외부 서버가 아니라 앱과 같은 서버의 파일만 쓰고, next/image(서버 변환)는 쓰지 않는다.
export default function AssetImage({ src, alt, width, height = width, className = "", fallback }: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // 화면이 그려지기 전에 이미 실패한 이미지(onError가 붙기 전)도 잡는다
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width, height }}>
      {failed ? (
        <div className="flex h-full w-full items-center justify-center">{fallback}</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={src}
          alt={alt}
          width={width}
          height={height}
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full select-none object-contain"
        />
      )}
    </div>
  );
}

/** 에셋이 없을 때 쓰는 부드러운 파스텔 도형(최종 디자인이 아니라 자리 표시용) */
export function SoftBlob({ tone = "lavender", children }: { tone?: "mint" | "lavender" | "peach"; children?: ReactNode }) {
  const bg = tone === "mint" ? "bg-accent/60" : tone === "peach" ? "bg-peach/70" : "bg-lavender/70";
  return (
    <div
      aria-hidden="true"
      className={`flex h-[78%] w-[78%] items-center justify-center rounded-[38%] text-lavender-ink shadow-card ${bg}`}
    >
      {children}
    </div>
  );
}

/** 덤벨 선 그림(자리 표시용 아이콘) */
export function DumbbellIcon({ className = "h-1/2 w-1/2" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </svg>
  );
}
