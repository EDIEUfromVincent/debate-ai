"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HomeButton from "@/components/common/HomeButton";

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
  const noTimer = mode === "ai";
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
  const [undoVisible, setUndoVisible]   = useState(false);
  const [lastSentText, setLastSentText] = useState("");

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnCountRef = useRef(initialUtterances.filter(u => u.side !== "mc" && u.side !== "system").length);
  const myTurnWasRef = useRef(false);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const sessionRef   = useRef(sessionId);

  const startTimer = useCallback((sec: number) => {
    if (noTimer) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(sec);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); handleTimeout(); return 0; }
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
          const newTurns: { phase: string; speaker: string; text: string }[] = data.turns.slice(turnCountRef.current);
          turnCountRef.current = newCount;
          setUtterances((prev) => [
            ...prev,
            ...newTurns.map((t) => ({ side: t.speaker as UtteranceEntry["side"], text: t.text, phase: t.phase })),
          ]);
        }
        const myTurnNow = !data.awaiting_ack && (data.current_speaker === playerSide || data.current_speaker === "both");
        setIsStudentTurn(myTurnNow);
        setAwaitingAck(data.awaiting_ack ?? false);
        if (myTurnNow && !myTurnWasRef.current && data.duration_sec) startTimer(data.duration_sec);
        myTurnWasRef.current = myTurnNow;
      } catch { /* 무시 */ }
    }, 2000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyResponse(res: TurnResponse) {
    setPhase(res.phase);
    setIsStudentTurn(res.is_student_turn);
    setAwaitingAck(res.awaiting_ack);
    setEnded(res.ended);
    if (res.mc_message) setMcMessage(res.mc_message);
    if ((res.violations ?? []).length > 0) {
      setViolation((res.violations ?? []).map((v) => v.type).join(", "));
      setTimeout(() => setViolation(null), 3500);
    }
    for (const ai of (res.ai_messages ?? [])) {
      if (ai.type === "opponent" && ai.text) addUtterance(ai.speaker === "pro" ? "pro" : "con", ai.text, res.phase);
      if (ai.type === "mc" && ai.text) addUtterance("mc", ai.text, res.phase);
    }
    if (res.judge_result) onJudged(res.judge_result);
    if (!noTimer) {
      if (!res.ended && !res.awaiting_ack && res.duration_sec) startTimer(res.duration_sec);
      else if (res.ended || res.awaiting_ack) { if (timerRef.current) clearInterval(timerRef.current); }
    }
  }

  function addUtterance(side: UtteranceEntry["side"], text: string, currentPhase: string) {
    setUtterances((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.side === side && last.text === text) return prev;
      return [...prev, { side, text, phase: currentPhase }];
    });
  }

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
      const data = await res.json();
      if (!res.ok) { setIsStudentTurn(true); return; }
      applyResponse(data);
      setLastSentText(text);
      setUndoVisible(true);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoVisible(false), 5000);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleUndo() {
    if (!lastSentText) return;
    setUndoVisible(false);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const res = await fetch("/api/debate/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionRef.current }),
    });
    if (res.ok) {
      const data = await res.json();
      setUtterances((prev) => {
        const idx = [...prev].reverse().findIndex((u) => u.side === studentSide);
        if (idx === -1) return prev;
        return prev.slice(0, prev.length - 1 - idx);
      });
      setPhase(data.phase);
      setIsStudentTurn(true);
      setAwaitingAck(false);
      setInput(lastSentText);
      setLastSentText("");
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
    } finally { setLoading(false); }
  }

  async function handleAck() {
    setLoading(true);
    try {
      const res = await fetch("/api/debate/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionRef.current }),
      });
      const data = await res.json();
      if (!res.ok) { setAwaitingAck(true); return; }
      applyResponse(data);
    } finally { setLoading(false); }
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

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const timerRed = !noTimer && timeLeft > 0 && timeLeft <= 10;
  const phaseName = PHASE_NAMES[phase] ?? phase;

  const notePanel = prepNote && (
    <div
      className="bg-white overflow-hidden shrink-0"
      style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
    >
      <button
        onClick={() => setNoteOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-left"
        style={{ borderBottom: noteOpen ? "2px solid #000" : "none" }}
      >
        <span className="font-black text-black text-sm">📋 내 준비 노트</span>
        <span className="font-bold text-gray-600 text-xs">{noteOpen ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>
      {noteOpen && (
        <div className="px-4 pb-3 text-xs font-bold text-gray-700 flex flex-col gap-1.5 pt-2">
          <p className="font-black text-black">입장: {prepNote.stance}</p>
          {prepNote.grounds.map((g, i) => g && (
            <div key={i}>
              <span className="font-black text-blue-600">근거 {i + 1}: </span>
              <span className="select-all">{g}</span>
            </div>
          ))}
          {prepNote.sources.map((s, i) => s && (
            <div key={i} className="text-gray-400">
              <span className="font-black">자료 {i + 1}: </span>
              <span className="select-all">{s}</span>
            </div>
          ))}
          <p className="text-gray-400 text-[10px] mt-1">텍스트를 길게 눌러 복사할 수 있어요</p>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="h-full max-w-5xl mx-auto px-3 py-3 grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3"
      style={{ background: "#A8F0E0" }}
    >
      <HomeButton />
      <div className="flex flex-col h-full min-h-0">
        <div className="flex flex-col h-full gap-2">

          {/* 규칙 위반 */}
          {violation && (
            <div
              className="px-4 py-2 text-sm font-black text-black text-center animate-pulse shrink-0"
              style={{ background: "#fef08a", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
            >
              ⚠️ 규칙 위반 감지: {violation}
            </div>
          )}

          {/* Phase 배너 */}
          <div
            className="bg-white px-4 py-3 flex items-center justify-between gap-3 shrink-0"
            style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-0.5">현재 단계</p>
              <p className="text-base font-black text-black truncate">{phaseName}</p>
            </div>
            {!noTimer && (
              <div className={`text-3xl font-black tabular-nums ${timerRed ? "text-red-600 animate-pulse" : "text-black"}`}>
                {ended ? "--:--" : `${mm}:${ss}`}
              </div>
            )}
          </div>

          {/* MC 메시지 */}
          {mcMessage && (
            <div
              className="px-4 py-2 text-sm font-bold text-black text-center shrink-0 bg-white"
              style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
            >
              📢 {mcMessage}
            </div>
          )}

          {/* 모바일 노트 */}
          <div className="md:hidden shrink-0">{notePanel}</div>

          {/* 발화 기록 */}
          <div
            className="flex-1 overflow-y-auto bg-white px-3 py-3"
            style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
          >
            <div className="flex flex-col gap-2 pb-2">
              {utterances.map((u, i) => {
                const isLastStudentBubble =
                  u.side === studentSide &&
                  utterances.slice(i + 1).every((x) => x.side !== studentSide);
                return (
                  <div key={i}>
                    <DebateBubble entry={u} studentSide={studentSide} />
                    {isLastStudentBubble && undoVisible && (
                      <div className={`flex mt-1 ${u.side === "pro" ? "justify-start pl-1" : "justify-end pr-1"}`}>
                        <button
                          onClick={handleUndo}
                          className="text-xs font-bold text-gray-500 underline hover:text-black"
                        >
                          ↩️ 되돌리기
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {loading && (
                <div className="text-center text-black font-bold text-sm py-1">
                  <span className="animate-bounce inline-block mr-0.5">●</span>
                  <span className="animate-bounce inline-block mr-0.5 [animation-delay:0.15s]">●</span>
                  <span className="animate-bounce inline-block [animation-delay:0.3s]">●</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* 입력 영역 */}
          {!ended && (
            <div className="flex gap-2 items-center shrink-0">
              {awaitingAck ? (
                <button
                  onClick={handleAck}
                  disabled={loading}
                  className="w-full py-3 font-black text-black text-base disabled:opacity-40 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
                  style={{ background: "#faff00", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
                >
                  읽었어요 — 다음으로 ▶
                </button>
              ) : (
                <div className="flex flex-col gap-2 w-full">
                  {isStudentTurn && REBUTTAL_PHASES.has(phase) && (
                    <button
                      onClick={handleSkipToClosing}
                      disabled={loading}
                      className="w-full py-2 text-sm font-black text-black disabled:opacity-40 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
                      style={{ background: "#fed7aa", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
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
                          ? REBUTTAL_PHASES.has(phase) ? "① 계속 반박하기..." : "여기에 발언을 입력하세요..."
                        : "AI가 발언 준비 중..."
                      }
                      disabled={loading || !isStudentTurn}
                      className="flex-1 px-4 py-3 text-base font-bold bg-white focus:outline-none disabled:bg-gray-100"
                      style={{ border: "3px solid #000" }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={loading || !isStudentTurn || !input.trim()}
                      className="px-5 py-3 font-black text-white disabled:opacity-40 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
                      style={{
                        background: studentSide === "pro" ? "#3b82f6" : "#ef4444",
                        border: "3px solid #000",
                        boxShadow: "4px 4px 0px #000",
                      }}
                    >
                      발언
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {ended && (
            <p className="text-center font-bold text-black text-sm py-2 shrink-0">토론이 종료되었습니다.</p>
          )}
        </div>
      </div>

      {/* 데스크톱 노트 사이드바 */}
      <div className="hidden md:flex flex-col gap-3 self-start sticky top-3">
        {notePanel}
      </div>
    </div>
  );
}

function DebateBubble({ entry, studentSide }: { entry: UtteranceEntry; studentSide: "pro" | "con" }) {
  if (entry.side === "mc" || entry.side === "system") {
    return <div className="text-center text-xs font-bold text-gray-500 italic py-0.5">{entry.text}</div>;
  }

  const isPro = entry.side === "pro";
  const isStudent = entry.side === studentSide;

  return (
    <div className={`flex items-end gap-2 ${isPro ? "justify-start" : "justify-end"}`}>
      {isPro && (
        <span
          className="shrink-0 mb-1 px-2 py-0.5 text-xs font-black text-white"
          style={{ background: "#3b82f6", border: "2px solid #000" }}
        >
          찬성
        </span>
      )}
      <div
        className="max-w-[72%] px-4 py-2.5 text-sm font-bold leading-relaxed"
        style={{
          background: isPro ? "#3b82f6" : "#ef4444",
          color: "#fff",
          border: isStudent ? "3px solid #000" : "2px solid #000",
          boxShadow: isStudent ? "4px 4px 0px #000" : "2px 2px 0px #000",
        }}
      >
        {entry.text}
      </div>
      {!isPro && (
        <span
          className="shrink-0 mb-1 px-2 py-0.5 text-xs font-black text-white"
          style={{ background: "#ef4444", border: "2px solid #000" }}
        >
          반대
        </span>
      )}
    </div>
  );
}
