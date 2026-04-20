"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import PrepStage from "@/components/session/PrepStage";
import DebateStage, { JudgeResult, PrepNote } from "@/components/session/DebateStage";
import JudgeStage from "@/components/session/JudgeStage";
import { Button } from "@/components/ui/button";
import { PrepResult } from "@/lib/api";

type Status = "loading" | "prep" | "prep_wait" | "lobby" | "debate" | "judge_done" | "error";

function JoinContent() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("id") ?? "";
  const side = (params.get("side") ?? "con") as "pro" | "con";

  const [status, setStatus]       = useState<Status>("loading");
  const [topic, setTopic]         = useState("");
  const [initialPhase, setInitialPhase]           = useState("phase_1_pro_1");
  const [initialDurationSec, setInitialDurationSec] = useState(120);
  const [judgeResult, setJudgeResult]             = useState<JudgeResult | null>(null);
  const [myReady, setMyReady]       = useState(false);
  const [hostPrepDone, setHostPrepDone] = useState(false);
  const [prepNote, setPrepNote]     = useState<PrepNote | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 접속 시 세션 정보 로드 + 게스트 신호
  useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }
    fetch(`/api/debate/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        setTopic(data.topic ?? "");
        setInitialPhase(data.phase ?? "phase_1_pro_1");
        setInitialDurationSec(data.duration_sec ?? 120);
        setHostPrepDone(data.both_prep_done ?? false);
        return fetch("/api/debate/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, side }),
        });
      })
      .then(() => setStatus("prep"))
      .catch(() => setStatus("error"));
  }, [sessionId, side]);

  // prep_wait: 호스트 prep 완료 폴링
  useEffect(() => {
    if (status !== "prep_wait") return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/debate/${sessionId}`);
        const data = await res.json();
        if (data.both_prep_done) {
          clearInterval(pollRef.current!);
          setStatus("lobby");
        }
      } catch { /* 무시 */ }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, sessionId]);

  // lobby: both_ready 폴링
  useEffect(() => {
    if (status !== "lobby") return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/debate/${sessionId}`);
        const data = await res.json();
        if (data.both_ready) {
          clearInterval(pollRef.current!);
          setStatus("debate");
        }
      } catch { /* 무시 */ }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, sessionId]);

  async function handlePrepComplete(result: PrepResult) {
    if (!result.stance) {
      const pick = window.confirm("입장을 선택하세요.\n확인 = 찬성 / 취소 = 반대");
      result = { ...result, stance: pick ? "찬성" : "반대" };
    }
    setPrepNote({ stance: result.stance, grounds: result.grounds, sources: result.sources });
    await fetch("/api/debate/prep-done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, side }),
    });
    // 호스트가 이미 prep 완료면 바로 lobby, 아니면 대기
    const res = await fetch(`/api/debate/${sessionId}`);
    const data = await res.json();
    if (data.both_prep_done) {
      setStatus("lobby");
    } else {
      setStatus("prep_wait");
    }
  }

  async function handleReady() {
    setMyReady(true);
    await fetch("/api/debate/ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, side }),
    });
  }

  if (status === "error") return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <p className="text-red-500 font-bold">세션을 찾을 수 없어요.</p>
      <Button onClick={() => router.push("/")}>홈으로</Button>
    </main>
  );

  if (status === "loading") return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">세션 연결 중...</p>
    </main>
  );

  if (status === "prep") return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 text-center shadow-sm shrink-0">
        <p className={`text-sm font-bold ${side === "pro" ? "text-blue-600" : "text-red-600"}`}>토론 수업 AI</p>
        <p className="text-xs text-gray-400 truncate max-w-xs mx-auto">{topic}</p>
        <span className={`inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${side === "pro" ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600"}`}>
          {side === "pro" ? "찬성 측" : "반대 측"}
        </span>
      </header>
      <div className="flex-1 overflow-hidden py-3">
        <PrepStage topic={topic} onComplete={handlePrepComplete} />
      </div>
    </main>
  );

  if (status === "prep_wait") return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
      <div className="text-center">
        <p className="text-xl font-extrabold text-gray-800 mb-2">준비 완료! 🎉</p>
        <p className="text-sm text-gray-500">상대방이 아직 준비 중이에요.</p>
        <p className="text-sm text-gray-400 mt-1">잠시만 기다려주세요...</p>
      </div>
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <span className="animate-bounce">●</span>
        <span className="animate-bounce [animation-delay:0.15s]">●</span>
        <span className="animate-bounce [animation-delay:0.3s]">●</span>
      </div>
    </main>
  );

  if (status === "lobby") return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <p className="text-xl font-extrabold text-gray-800 mb-1">둘 다 준비됐어요! 🎮</p>
        <p className="text-sm text-gray-500">주제: <span className="font-semibold">{topic}</span></p>
        <p className="mt-1 text-sm">
          나는 <span className={`font-bold ${side === "pro" ? "text-blue-600" : "text-red-600"}`}>
            {side === "pro" ? "찬성" : "반대"} 측
          </span>
        </p>
      </div>
      <Button
        onClick={handleReady}
        disabled={myReady}
        className="rounded-2xl px-8 py-3 text-base font-bold bg-purple-600 hover:bg-purple-700 h-auto disabled:opacity-50"
      >
        {myReady ? "호스트 대기 중..." : "토론 시작 준비 완료!"}
      </Button>
    </main>
  );

  if (status === "judge_done" && judgeResult) return (
    <JudgeStage
      result={judgeResult}
      topic={topic}
      studentSide={side}
      onRestart={() => router.push("/")}
    />
  );

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 text-center shadow-sm shrink-0">
        <p className={`text-sm font-bold ${side === "pro" ? "text-blue-600" : "text-red-600"}`}>토론 수업 AI</p>
        <p className="text-xs text-gray-400 truncate max-w-xs mx-auto">{topic}</p>
        <span className={`inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${side === "pro" ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600"}`}>
          {side === "pro" ? "찬성 측" : "반대 측"}
        </span>
      </header>
      <div className="flex-1 overflow-hidden">
        <DebateStage
          sessionId={sessionId}
          playerSide={side}
          mode="1v1"
          initialPhase={initialPhase}
          initialMcMessage=""
          initialDurationSec={initialDurationSec}
          initialIsStudentTurn={false}
          prepNote={prepNote ?? undefined}
          onJudged={(r) => { setJudgeResult(r); setStatus("judge_done"); }}
        />
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">로딩 중...</div>}>
      <JoinContent />
    </Suspense>
  );
}
