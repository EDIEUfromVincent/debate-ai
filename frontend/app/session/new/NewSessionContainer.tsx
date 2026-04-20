"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import PrepStage from "@/components/session/PrepStage";
import DebateStage, { JudgeResult, PrepNote } from "@/components/session/DebateStage";
import JudgeStage from "@/components/session/JudgeStage";
import { PrepResult } from "@/lib/api";
import { Button } from "@/components/ui/button";

type AppPhase = "prep" | "prep_wait" | "qr_wait" | "debate" | "judge_done";

interface DebateSession {
  sessionId: string;
  topic: string;
  playerSide: "pro" | "con";
  mode: string;
  initialPhase: string;
  initialMcMessage: string;
  initialDurationSec: number;
  initialIsStudentTurn: boolean;
  initialAwaitingAck: boolean;
  initialUtterances: { side: "pro" | "con" | "mc" | "system"; text: string; phase: string }[];
}

export default function NewSessionContainer() {
  const params = useSearchParams();
  const router = useRouter();
  const topic = params.get("topic") ?? "학교에서 스마트폰 사용을 허용해야 한다";
  const mode  = params.get("mode") ?? "ai";

  const [appPhase, setAppPhase]           = useState<AppPhase>("prep");
  const [debateSession, setDebateSession] = useState<DebateSession | null>(null);
  const [judgeResult, setJudgeResult]     = useState<JudgeResult | null>(null);
  const [qrSessionId, setQrSessionId]     = useState<string | null>(null);
  const [qrSide, setQrSide]               = useState<"pro" | "con">("pro");
  const [prepNote, setPrepNote]           = useState<PrepNote | null>(null);
  // 1v1 prep_wait 상태에서 상대 진행 단계 추적
  async function handlePrepComplete(result: PrepResult) {
    // stance가 비어있으면 직접 선택
    if (!result.stance) {
      const pick = window.confirm("입장을 선택하세요.\n확인 = 찬성 / 취소 = 반대");
      result = { ...result, stance: pick ? "찬성" : "반대" };
    }
    const side: "pro" | "con" = result.stance === "반대" ? "con" : "pro";
    setPrepNote({ stance: result.stance, grounds: result.grounds, sources: result.sources });

    const res = await fetch("/api/debate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, student_side: side, difficulty: "medium", mode }),
    });
    const data = await res.json();

    // orientation 스킵 — 응답에 AI 첫 발화 포함될 수 있음
    const skipRes = await fetch("/api/debate/timeout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: data.session_id }),
    });
    const skipData = await skipRes.json();

    if (mode === "1v1") {
      // 호스트 prep 완료 신호
      await fetch("/api/debate/prep-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: data.session_id, side }),
      });
      setQrSessionId(data.session_id);
      setQrSide(side);
      setAppPhase("qr_wait");
      return;
    }

    // timeout 응답에서 AI 첫 발화 추출
    const aiUtterances: DebateSession["initialUtterances"] = [];
    for (const msg of skipData.ai_messages ?? []) {
      if (msg.type === "opponent" && msg.text) {
        aiUtterances.push({ side: msg.speaker === "pro" ? "pro" : "con", text: msg.text, phase: skipData.phase });
      }
      if (msg.type === "mc" && msg.text) {
        aiUtterances.push({ side: "mc", text: msg.text, phase: skipData.phase });
      }
    }

    setDebateSession({
      sessionId:            data.session_id,
      topic,
      playerSide:           side,
      mode,
      initialPhase:         skipData.phase,
      initialMcMessage:     skipData.mc_message ?? "",
      initialDurationSec:   skipData.duration_sec ?? 120,
      initialIsStudentTurn: skipData.is_student_turn ?? (skipData.current_speaker === side),
      initialAwaitingAck:   skipData.awaiting_ack ?? false,
      initialUtterances:    aiUtterances,
    });
    setAppPhase("debate");
  }

  function handleQrStart() {
    if (!qrSessionId) return;
    setDebateSession({
      sessionId:            qrSessionId,
      topic,
      playerSide:           qrSide,
      mode,
      initialPhase:         "phase_1_pro_1",
      initialMcMessage:     "",
      initialDurationSec:   120,
      initialIsStudentTurn: qrSide === "pro",
      initialAwaitingAck:   false,
      initialUtterances:    [],
    });
    setAppPhase("debate");
  }

  function handleJudged(result: JudgeResult) {
    setJudgeResult(result);
    setAppPhase("judge_done");
  }

  if (appPhase === "judge_done" && judgeResult && debateSession) {
    return (
      <JudgeStage
        result={judgeResult}
        topic={debateSession.topic}
        studentSide={debateSession.playerSide}
        onRestart={() => router.push("/")}
      />
    );
  }

  if (appPhase === "debate" && debateSession) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b px-4 py-3 text-center shadow-sm shrink-0">
          <p className="text-sm font-bold text-blue-600">토론 수업 AI</p>
          <p className="text-xs text-gray-400 truncate max-w-xs mx-auto">{debateSession.topic}</p>
        </header>
        <div className="flex-1 overflow-hidden">
          <DebateStage
            sessionId={debateSession.sessionId}
            playerSide={debateSession.playerSide}
            mode={debateSession.mode}
            initialPhase={debateSession.initialPhase}
            initialMcMessage={debateSession.initialMcMessage}
            initialDurationSec={debateSession.initialDurationSec}
            initialIsStudentTurn={debateSession.initialIsStudentTurn}
            initialAwaitingAck={debateSession.initialAwaitingAck}
            initialUtterances={debateSession.initialUtterances}
            prepNote={prepNote ?? undefined}
            onJudged={handleJudged}
          />
        </div>
      </main>
    );
  }

  if (appPhase === "qr_wait" && qrSessionId) {
    const joinUrl = `${window.location.origin}/session/join?id=${qrSessionId}&side=${qrSide === "pro" ? "con" : "pro"}`;
    const guestSideLabel = qrSide === "pro" ? "반대" : "찬성";
    return (
      <QrWaitScreen
        joinUrl={joinUrl}
        guestSideLabel={guestSideLabel}
        sessionId={qrSessionId}
        hostSide={qrSide}
        onStart={handleQrStart}
      />
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 text-center shadow-sm">
        <p className="text-sm font-bold text-blue-600 tracking-wide">토론 수업 AI</p>
        <p className="text-xs text-gray-400 truncate max-w-xs mx-auto">{topic}</p>
        {mode === "1v1" && (
          <span className="inline-block mt-0.5 text-xs bg-purple-100 text-purple-600 font-semibold px-2 py-0.5 rounded-full">
            1:1 모드
          </span>
        )}
      </header>
      <div className="flex-1 overflow-hidden py-3">
        <PrepStage topic={topic} onComplete={handlePrepComplete} />
      </div>
    </main>
  );
}

function QrWaitScreen({ joinUrl, guestSideLabel, sessionId, hostSide, onStart }: {
  joinUrl: string;
  guestSideLabel: string;
  sessionId: string;
  hostSide: "pro" | "con";
  onStart: () => void;
}) {
  const [guestJoined, setGuestJoined]       = useState(false);
  const [guestPrepDone, setGuestPrepDone]   = useState(false);
  const [myReady, setMyReady]               = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/debate/${sessionId}`);
        const data = await res.json();
        if (data.guest_joined)   setGuestJoined(true);
        if (data.both_prep_done) setGuestPrepDone(true);
        if (data.both_ready)     { clearInterval(pollRef.current!); onStart(); }
      } catch { /* 무시 */ }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId, onStart]);

  async function handleReady() {
    setMyReady(true);
    await fetch("/api/debate/ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, side: hostSide }),
    });
  }

  // 게스트가 prep 완료 전: 준비 버튼 숨김 (대기 메시지만)
  const showReadyButton = guestPrepDone;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 gap-6">
      <div className="text-center">
        <p className="text-xl font-extrabold text-gray-800 mb-1">
          {guestJoined
            ? guestPrepDone
              ? "상대방 준비 완료! 🎉"
              : "친구가 접속했어요 🎉"
            : "친구를 초대하세요"}
        </p>
        <p className="text-sm text-gray-500">
          친구가 QR을 스캔하면 <span className="font-bold text-red-600">{guestSideLabel}</span> 측으로 참가해요
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-lg border">
        <QRCodeSVG value={joinUrl} size={200} />
      </div>
      <p className="text-xs text-gray-400 text-center max-w-xs break-all">{joinUrl}</p>

      {/* 상태 배지 */}
      <div className="flex gap-4 text-sm">
        <span className={`px-3 py-1 rounded-full font-semibold ${myReady ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-600"}`}>
          나 ✓ 준비완료 (Prep 완료)
        </span>
        <span className={`px-3 py-1 rounded-full font-semibold ${
          guestPrepDone ? "bg-green-100 text-green-700"
          : guestJoined ? "bg-yellow-100 text-yellow-700"
          : "bg-gray-100 text-gray-400"
        }`}>
          친구 {guestPrepDone ? "✓ 준비완료" : guestJoined ? "준비 중..." : "미접속"}
        </span>
      </div>

      {!guestPrepDone && guestJoined && (
        <p className="text-sm text-gray-400 text-center">
          상대방이 아직 준비 중이에요. 잠시만 기다려주세요...
        </p>
      )}

      {showReadyButton && (
        <Button
          onClick={handleReady}
          disabled={myReady}
          className="rounded-2xl px-8 py-3 text-base font-bold bg-purple-600 hover:bg-purple-700 h-auto disabled:opacity-50"
        >
          {myReady ? "친구 기다리는 중..." : "토론 시작 준비 완료!"}
        </Button>
      )}
    </main>
  );
}
