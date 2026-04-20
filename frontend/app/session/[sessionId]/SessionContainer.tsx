"use client";

import { useState } from "react";
import PrepStage from "@/components/session/PrepStage";
import DebateStage, { JudgeResult } from "@/components/session/DebateStage";
import JudgeStage from "@/components/session/JudgeStage";
import { PrepResult } from "@/lib/api";

const DEMO_TOPIC = "학교에서 스마트폰 사용을 허용해야 한다";

type Phase = "prep" | "debate" | "judge_done";

interface DebateSession {
  sessionId: string;
  playerSide: "pro" | "con";
  initialPhase: string;
  initialMcMessage: string;
  initialDurationSec: number;
  initialIsStudentTurn: boolean;
}

export default function SessionContainer() {
  const [phase, setPhase]               = useState<Phase>("prep");
  const [debateSession, setDebateSession] = useState<DebateSession | null>(null);
  const [judgeResult, setJudgeResult]   = useState<JudgeResult | null>(null);

  async function handlePrepComplete(result: PrepResult) {
    // 건너뛰기(stance="")면 찬성(pro) 기본 — phase_1_pro_1이 학생 차례
    const side: "pro" | "con" = result.stance === "반대" ? "con" : "pro";

    const res = await fetch("/api/debate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: DEMO_TOPIC,
        student_side: side,
        difficulty: "medium",
      }),
    });
    const data = await res.json();

    // orientation 자동 스킵 → phase_1 진입
    const skipRes = await fetch("/api/debate/timeout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: data.session_id }),
    });
    const skipData = await skipRes.json();

    setDebateSession({
      sessionId:            data.session_id,
      playerSide:          side,
      initialPhase:         skipData.phase,
      initialMcMessage:     skipData.mc_message ?? data.mc_message,
      initialDurationSec:   skipData.duration_sec ?? 120,
      initialIsStudentTurn: skipData.is_student_turn ?? true,
    });
    setPhase("debate");
  }

  function handleJudged(result: JudgeResult) {
    setJudgeResult(result);
    setPhase("judge_done");
  }

  if (phase === "judge_done" && judgeResult) {
    return (
      <JudgeStage
        result={judgeResult}
        topic={DEMO_TOPIC}
        studentSide={debateSession?.playerSide ?? "pro"}
        onRestart={() => {
          setPhase("prep");
          setDebateSession(null);
          setJudgeResult(null);
        }}
      />
    );
  }

  if (phase === "debate" && debateSession) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b px-4 py-3 text-center shadow-sm shrink-0">
          <p className="text-sm font-bold text-blue-600">토론 수업 AI</p>
          <p className="text-xs text-gray-400 truncate">{DEMO_TOPIC}</p>
        </header>
        <div className="flex-1 overflow-hidden">
          <DebateStage
            sessionId={debateSession.sessionId}
            playerSide={debateSession.playerSide}
            initialPhase={debateSession.initialPhase}
            initialMcMessage={debateSession.initialMcMessage}
            initialDurationSec={debateSession.initialDurationSec}
            initialIsStudentTurn={debateSession.initialIsStudentTurn}
            onJudged={handleJudged}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 text-center shadow-sm">
        <p className="text-sm font-bold text-blue-600 tracking-wide">토론 수업 AI</p>
      </header>
      <div className="flex-1 overflow-hidden py-3">
        <PrepStage topic={DEMO_TOPIC} onComplete={handlePrepComplete} />
      </div>
    </main>
  );
}
