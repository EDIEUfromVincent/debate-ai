"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface TurnResponse {
  phase: string;
  is_student_turn: boolean;
  student_input_recorded: boolean;
  violations: { type: string; severity: string }[];
  mc_message: string | null;
  ai_messages: { type: string; speaker?: string; text?: string; data?: unknown }[];
  judge_result: JudgeResult | null;
  ended: boolean;
  awaiting_ack: boolean;
  duration_sec: number | null;
}

export interface JudgeResult {
  pro_score: { A: number; B: number; C: number; D: number; total: number };
  con_score: { A: number; B: number; C: number; D: number; total: number };
  events: { type: string; phase: string; side: string }[];
  summary: string;
  winner: "pro" | "con" | "tie";
}

interface UtteranceEntry {
  side: "pro" | "con" | "mc" | "system";
  text: string;
  phase: string;
}

export interface PrepNote {
  stance: string;
  grounds: string[];
  sources: string[];
}

// ── phase 한국어 이름 ─────────────────────────────────────────────────────────
const PHASE_NAMES: Record<string, string> = {
  orientation:              "안내",
  phase_1_pro_1:            "주장 펼치기 — 찬성",
  phase_1_con_1:            "주장 펼치기 — 반대",
  consultation_1:           "생각 정리",
  phase_2_con_2_rebuttal:   "반론·질문 — 반대",
  phase_2_pro_defense:      "반박·답변 — 찬성",
  phase_2_pro_2_rebuttal:   "반론·질문 — 찬성",
  phase_2_con_defense:      "반박·답변 — 반대",
  consultation_2:           "생각 정리",
  phase_3_con_3:            "주장 다지기 — 반대",
  phase_3_pro_3:            "주장 다지기 — 찬성",
  judging:                  "AI 판정 중...",
  ended:                    "토론 종료",
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface DebateStageProps {
  sessionId: string;
  playerSide: "pro" | "con";
  mode?: string;
  initialPhase: string;
  initialMcMessage: string;
  initialDurationSec: number;
  initialIsStudentTurn: boolean;
  initialAwaitingAck?: boolean;
  initialUtterances?: UtteranceEntry[];
  prepNote?: PrepNote;
  onJudged: (result: JudgeResult) => void;
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function DebateStage({
  sessionId,
  playerSide,
  mode = "ai",
  initialPhase,
  initialMcMessage,
  initialDurationSec,
  initialIsStudentTurn,
  initialAwaitingAck = false,
  initialUtterances = [],
  prepNote,
  onJudged,
}: DebateStageProps) {
  const noTimer = mode === "ai";   // 1:AI 모드는 시간제한 없음
  const studentSide = playerSide;
  const [phase, setPhase]               = useState(initialPhase);
  const [isStudentTurn, setIsStudentTurn] = useState(initialIsStudentTurn);
  const [awaitingAck, setAwaitingAck]   = useState(initialAwaitingAck);
  const [timeLeft, setTimeLeft]         = useState(initialDurationSec);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [violation, setViolation]       = useState<string | null>(null);
  const [mcMessage, setMcMessage]       = useState<string | null>(initialMcMessage);
  const [utterances, setUtterances]     = useState<UtteranceEntry[]>(initialUtterances);
  const [ended, setEnded]               = useState(false);
  const [noteOpen, setNoteOpen]         = useState(true);

  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnCountRef   = useRef(initialUtterances.filter(u => u.side !== "mc" && u.side !== "system").length);
  const myTurnWasRef   = useRef(false);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const sessionRef     = useRef(sessionId);

  // ── 타이머 (1v1 전용) ────────────────────────────────────────────────────
  const startTimer = useCallback((sec: number) => {
    if (noTimer) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(sec);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [noTimer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!noTimer) startTimer(initialDurationSec);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [utterances, mcMessage]);

  // ── 1v1 폴링 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "1v1") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/debate/${sessionRef.current}`);
        const data = await res.json();

        if (data.ended) {
          setEnded(true);
          if (timerRef.current) clearInterval(timerRef.current);
          if (data.judge_result) onJudged(data.judge_result);
          return;
        }

        setPhase(data.phase);

        const newCount = data.turns_count ?? 0;
        if (newCount > turnCountRef.current) {
          const newTurns: { phase: string; speaker: string; text: string }[] =
            data.turns.slice(turnCountRef.current);
          turnCountRef.current = newCount;
          setUtterances((prev) => [
            ...prev,
            ...newTurns.map((t) => ({
              side: t.speaker as UtteranceEntry["side"],
              text: t.text,
              phase: t.phase,
            })),
          ]);
        }

        const myTurnNow =
          !data.awaiting_ack &&
          (data.current_speaker === playerSide || data.current_speaker === "both");

        setIsStudentTurn(myTurnNow);
        setAwaitingAck(data.awaiting_ack ?? false);

        if (myTurnNow && !myTurnWasRef.current && data.duration_sec) {
          startTimer(data.duration_sec);
        }
        myTurnWasRef.current = myTurnNow;
      } catch { /* 무시 */ }
    }, 2000);

    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 응답 처리 ──────────────────────────────────────────────────────────────
  function applyResponse(res: TurnResponse) {
    setPhase(res.phase);
    setIsStudentTurn(res.is_student_turn);
    setAwaitingAck(res.awaiting_ack);
    setEnded(res.ended);

    if (res.mc_message) setMcMessage(res.mc_message);

    if ((res.violations ?? []).length > 0) {
      const types = (res.violations ?? []).map((v) => v.type).join(", ");
      setViolation(types);
      setTimeout(() => setViolation(null), 3500);
    }

    for (const ai of (res.ai_messages ?? [])) {
      if (ai.type === "opponent" && ai.text) {
        addUtterance(ai.speaker === "pro" ? "pro" : "con", ai.text, res.phase);
      }
      if (ai.type === "mc" && ai.text) {
        addUtterance("mc", ai.text, res.phase);
      }
    }

    if (res.judge_result) {
      onJudged(res.judge_result);
    }

    // 1v1만 타이머 갱신
    if (!noTimer) {
      if (!res.ended && !res.awaiting_ack && res.duration_sec) {
        startTimer(res.duration_sec);
      } else if (res.ended || res.awaiting_ack) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  }

  function addUtterance(side: UtteranceEntry["side"], text: string, currentPhase: string) {
    setUtterances((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.side === side && last.text === text) return prev;
      return [...prev, { side, text, phase: currentPhase }];
    });
  }

  // ── API 호출 ──────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!input.trim() || loading || !isStudentTurn) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    setUtterances((prev) => [...prev, { side: studentSide, text, phase }]);
    turnCountRef.current += 1;

    try {
      const res = await fetch("/api/debate/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionRef.current, student_input: text, player_side: playerSide }),
      });
      applyResponse(await res.json());
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const REBUTTAL_PHASES = new Set([
    "phase_2_con_2_rebuttal", "phase_2_pro_defense",
    "phase_2_pro_2_rebuttal", "phase_2_con_defense",
  ]);

  async function handleSkipToClosing() {
    setLoading(true);
    try {
      const res = await fetch("/api/debate/skip-rebuttal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionRef.current }),
      });
      applyResponse(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleAck() {
    setLoading(true);
    try {
      const res = await fetch("/api/debate/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionRef.current }),
      });
      applyResponse(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleTimeout() {
    try {
      const res = await fetch("/api/debate/timeout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionRef.current }),
      });
      applyResponse(await res.json());
    } catch { /* 무시 */ }
  }

  const mm  = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss  = String(timeLeft % 60).padStart(2, "0");
  const timerRed = !noTimer && timeLeft > 0 && timeLeft <= 10;
  const phaseName = PHASE_NAMES[phase] ?? phase;

  // ── 준비 노트 패널 ────────────────────────────────────────────────────────
  const notePanel = prepNote && (
    <div className="rounded-2xl border border-green-300 bg-green-50 shadow-sm overflow-hidden shrink-0">
      <button
        onClick={() => setNoteOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-left"
      >
        <span className="font-bold text-green-800 text-sm">📋 내 준비 노트</span>
        <span className="text-green-600 text-xs">{noteOpen ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>
      {noteOpen && (
        <div className="px-4 pb-3 text-xs text-gray-700 flex flex-col gap-1.5">
          <p className="font-semibold text-green-700">입장: {prepNote.stance}</p>
          {prepNote.grounds.map((g, i) => g && (
            <div key={i}>
              <span className="font-semibold text-blue-600">근거 {i + 1}: </span>
              <span className="select-all">{g}</span>
            </div>
          ))}
          {prepNote.sources.map((s, i) => s && (
            <div key={i} className="text-gray-400">
              <span className="font-semibold">자료 {i + 1}: </span>
              <span className="select-all">{s}</span>
            </div>
          ))}
          <p className="text-gray-400 text-[10px] mt-1">텍스트를 길게 눌러 복사할 수 있어요</p>
        </div>
      )}
    </div>
  );

  // ── 채팅 영역 ─────────────────────────────────────────────────────────────
  const chatArea = (
    <div className="flex flex-col h-full gap-2">
      {violation && (
        <div className="rounded-xl bg-yellow-100 border border-yellow-400 px-4 py-2
                        text-sm font-semibold text-yellow-800 text-center animate-pulse shrink-0">
          ⚠️ 규칙 위반 감지: {violation}
        </div>
      )}

      {/* Phase 배너 + 타이머 */}
      <div className="rounded-2xl bg-white border shadow-sm px-4 py-3
                      flex items-center justify-between gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">현재 단계</p>
          <p className="text-base font-bold text-gray-800 truncate">{phaseName}</p>
        </div>
        {!noTimer && (
          <div className={`text-3xl font-mono font-bold tabular-nums
                           ${timerRed ? "text-red-500 animate-pulse" : "text-gray-700"}`}>
            {ended ? "--:--" : `${mm}:${ss}`}
          </div>
        )}
      </div>

      {/* MC 메시지 */}
      {mcMessage && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2
                        text-sm text-blue-800 text-center shrink-0">
          📢 {mcMessage}
        </div>
      )}

      {/* 모바일 노트 패널 */}
      <div className="md:hidden shrink-0">{notePanel}</div>

      {/* 발화 기록 */}
      <ScrollArea className="flex-1 rounded-2xl border bg-white shadow-sm px-3 py-3">
        <div className="flex flex-col gap-2 pb-2">
          {utterances.map((u, i) => (
            <DebateBubble key={i} entry={u} studentSide={studentSide} />
          ))}
          {loading && (
            <div className="text-center text-gray-400 text-sm py-1">
              <span className="animate-bounce inline-block mr-0.5">●</span>
              <span className="animate-bounce inline-block mr-0.5 [animation-delay:0.15s]">●</span>
              <span className="animate-bounce inline-block [animation-delay:0.3s]">●</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* 입력 영역 */}
      {!ended && (
        <div className="flex gap-2 items-center shrink-0">
          {awaitingAck ? (
            <Button
              onClick={handleAck}
              disabled={loading}
              className="w-full rounded-2xl py-3 text-base font-bold
                         bg-gray-700 hover:bg-gray-800 h-auto"
            >
              읽었어요 — 다음으로 ▶
            </Button>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {isStudentTurn && REBUTTAL_PHASES.has(phase) && (
                <button
                  onClick={handleSkipToClosing}
                  disabled={loading}
                  className="w-full rounded-xl border border-orange-300 bg-orange-50 text-orange-700
                             font-semibold py-2 text-sm hover:bg-orange-100 disabled:opacity-40 transition-colors"
                >
                  ② 이제 정리하기 →
                </button>
              )}
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={
                    loading ? "처리 중..."
                    : isStudentTurn
                      ? REBUTTAL_PHASES.has(phase) ? "① 계속 반박하기..."  : "여기에 발언을 입력하세요..."
                    : "AI가 발언 준비 중..."
                  }
                  disabled={loading || !isStudentTurn}
                  className="flex-1 rounded-2xl border border-gray-300 px-4 py-3 text-base
                             focus:outline-none focus:ring-2 focus:ring-blue-400
                             disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <Button
                  onClick={handleSend}
                  disabled={loading || !isStudentTurn || !input.trim()}
                  className={`rounded-2xl px-5 py-3 text-base font-bold h-auto
                    ${studentSide === "pro"
                      ? "bg-blue-500 hover:bg-blue-600"
                      : "bg-red-500 hover:bg-red-600"}
                    disabled:opacity-40`}
                >
                  발언
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {ended && (
        <p className="text-center text-gray-400 text-sm py-2 shrink-0">토론이 종료되었습니다.</p>
      )}
    </div>
  );

  return (
    <div className="h-full max-w-5xl mx-auto px-3 py-3
                    grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3">
      <div className="flex flex-col h-full min-h-0">
        {chatArea}
      </div>
      {/* 데스크톱 노트 사이드바 */}
      <div className="hidden md:flex flex-col gap-3 self-start sticky top-3">
        {notePanel}
      </div>
    </div>
  );
}

// ── 말풍선 ───────────────────────────────────────────────────────────────────
function DebateBubble({
  entry,
  studentSide,
}: {
  entry: UtteranceEntry;
  studentSide: "pro" | "con";
}) {
  if (entry.side === "mc" || entry.side === "system") {
    return (
      <div className="text-center text-xs text-gray-400 italic py-0.5">
        {entry.text}
      </div>
    );
  }

  const isPro = entry.side === "pro";
  const isStudent = entry.side === studentSide;

  return (
    <div className={`flex items-end gap-2 ${isPro ? "justify-start" : "justify-end"}`}>
      {isPro && (
        <Badge className="shrink-0 mb-1 bg-blue-100 text-blue-700 border-blue-300 text-xs">
          찬성
        </Badge>
      )}
      <div
        className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm
          ${isPro
            ? "bg-blue-500 text-white rounded-bl-sm"
            : "bg-red-500 text-white rounded-br-sm"}
          ${isStudent ? "ring-2 ring-offset-1 ring-white/60" : ""}`}
      >
        {entry.text}
      </div>
      {!isPro && (
        <Badge className="shrink-0 mb-1 bg-red-100 text-red-700 border-red-300 text-xs">
          반대
        </Badge>
      )}
    </div>
  );
}
