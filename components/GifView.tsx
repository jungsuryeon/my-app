"use client";

import { useEffect, useState } from "react";
import type { CatalogExercise } from "@/lib/exerciseCatalog";
import { isSafeGifUrl } from "@/lib/exerciseDb";

/** GIF 조회 결과. key로 어느 운동의 결과인지 구분한다(다른 운동으로 옮겨 가면 다시 조회) */
type GifState = { key: string; status: "ok"; url: string } | { key: string; status: "none" | "error" };

// 운동 하나의 동작 GIF와 안내 문구. 보이는 순간에만 조회하고 응답은 저장하지 않는다.
export default function GifView({ item }: { item: CatalogExercise }) {
  const [result, setResult] = useState<GifState | null>(null);
  const [imgFailed, setImgFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 운동 설명을 열 때만 조회한다. 응답은 저장하지 않는다(PRD §7·§8).
    fetch(`/api/exercise/${encodeURIComponent(item.key)}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 404) return { key: item.key, status: "none" } as const;
        if (!res.ok) return { key: item.key, status: "error" } as const;
        const body = (await res.json()) as { gifUrl?: unknown };
        // 서버가 이미 검증했지만 브라우저에서도 한 번 더 확인한다(ExerciseDB의 https GIF 주소만 화면에 쓴다)
        return isSafeGifUrl(body.gifUrl)
          ? ({ key: item.key, status: "ok", url: body.gifUrl } as const)
          : ({ key: item.key, status: "error" } as const);
      })
      .catch(() => ({ key: item.key, status: "error" }) as const)
      .then((r) => {
        if (!cancelled) setResult(r);
      });
    return () => {
      cancelled = true;
    };
  }, [item.key]);

  const loading = result?.key !== item.key;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-2xl bg-white">
        {loading ? (
          <p className="text-sm text-neutral-500">동작 영상을 불러오는 중…</p>
        ) : result.status === "ok" && imgFailed !== result.url ? (
          // 외부 GIF는 next/image(서버 변환·저장)를 거치지 않고 그대로 보여 준다(저장 금지 약관)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.url}
            alt={`${item.name} 동작`}
            referrerPolicy="no-referrer"
            className="max-h-72 w-full object-contain"
            onError={() => setImgFailed(result.url)}
          />
        ) : (
          <p className="px-4 text-center text-sm text-neutral-600">
            {result.status === "none"
              ? "이 운동은 맞는 동작 영상이 없어요."
              : "동작 영상을 불러오지 못했어요. 운동은 그대로 시작할 수 있어요."}
          </p>
        )}
      </div>
      <p className="text-xs text-muted">
        동작 영상은 ExerciseDB에서 불러와요. 이때 이 폰의 IP 주소 등이 ExerciseDB 서버에 전달될 수 있어요. 닉네임과
        운동 기록은 보내지 않아요.
      </p>
    </div>
  );
}
