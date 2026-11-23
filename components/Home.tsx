"use client";

import { useState } from "react";
import { initAudio, playBeep, speakKorean } from "@/lib/audio";
import { setDonePhrase } from "@/lib/cues";

// 홈 화면 뼈대. 닉네임·최근 기록·루틴 카드·데이터 초기화는 이후 작업에서 채운다.
export default function Home() {
  // ⚠ 임시: 작업 8~11 소리 확인용. 정식 "운동 시작"·"소리 테스트" 버튼이 생기는 작업 12·18에서 지운다.
  const [audioMsg, setAudioMsg] = useState("");
  function handleTempInit() {
    // 오디오는 반드시 버튼을 누른 이 클릭 처리 안에서 켠다
    const ok = initAudio();
    if (ok) playBeep("rep");
    setAudioMsg(ok ? "오디오 켬 — 짧은 소리가 났나요?" : "이 브라우저에서는 오디오를 켤 수 없어요");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">RepTimer</h1>
        <p className="mt-1 text-sm text-muted">
          반복·세트·휴식을 자동으로 진행해 드려요.
        </p>
      </header>

      <section aria-labelledby="recent-title" className="rounded-2xl bg-surface p-4">
        <h2 id="recent-title" className="text-sm font-medium text-muted">
          최근 기록
        </h2>
        <p className="mt-2 text-base">아직 기록이 없습니다</p>
      </section>

      <section aria-labelledby="routine-title" className="flex flex-col gap-3">
        <h2 id="routine-title" className="text-sm font-medium text-muted">
          루틴
        </h2>
        <div className="flex min-h-11 items-center rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-muted">
          샘플 루틴이 여기에 표시됩니다
        </div>
      </section>

      {/* ⚠ 임시 소리 확인 영역 (작업 12·18에서 제거) */}
      <section className="flex flex-col gap-2 rounded-2xl border border-dashed border-accent/40 p-4">
        <h2 className="text-sm font-medium text-accent">임시: 소리 확인</h2>
        <button
          type="button"
          onClick={handleTempInit}
          className="min-h-11 rounded-xl bg-surface px-4 text-base"
        >
          오디오 켜기 + 반복 비프
        </button>
        <button
          type="button"
          onClick={() => playBeep("setDone")}
          className="min-h-11 rounded-xl bg-surface px-4 text-base"
        >
          세트 완료 비프(길게)
        </button>
        <button
          type="button"
          onClick={() => {
            // 휴식 마지막 3·2·1초 비프를 1초 간격으로 미리 들어 본다
            [0, 1, 2].forEach((s) => playBeep("countdown", s));
          }}
          className="min-h-11 rounded-xl bg-surface px-4 text-base"
        >
          휴식 3·2·1 비프 듣기
        </button>
        <button
          type="button"
          onClick={() => {
            // 한국어 음성이 없으면 말하지 못하므로(작업 11에서 비프로 대체) 결과를 화면에 알린다
            const ok = speakKorean(setDonePhrase(1, 30));
            setAudioMsg(ok ? "음성 재생 요청함" : "한국어 음성을 쓸 수 없어요(오디오 켜기를 먼저 누르세요)");
          }}
          className="min-h-11 rounded-xl bg-surface px-4 text-base"
        >
          음성 듣기 (1번째 세트 완료)
        </button>
        {audioMsg && <p className="text-sm text-muted">{audioMsg}</p>}
      </section>
    </main>
  );
}
