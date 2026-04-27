"use client";

import { useEffect, useRef, useState } from "react";
import { prepChat, PrepResult } from "@/lib/api";
import SourceGuideCard from "@/components/session/SourceGuideCard";
import HomeButton from "@/components/common/HomeButton";

interface Message {
  role: "student" | "ai";
  text: string;
}

interface PrepStageProps {
  topic: string;
  onComplete: (result: PrepResult) => void;
}

export default function PrepStage({ topic, onComplete }: PrepStageProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: `오늘 토론 주제는 "${topic}"입니다. 먼저 찬성과 반대 중 어느 쪽 입장을 취하고 싶은가요?`,
    },
  ]);
  const [turns, setTurns] = useState<[string, string][]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneResult, setDoneResult] = useState<PrepResult | null>(null);
  const [autoMode, setAutoMode] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showGuideOnMobile = turns.length >= 3;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const PROFANITY = /시발|씨발|ㅅㅂ|ㅆㅂ|개새|새끼|ㅅㄲ|병신|ㅂㅅ|존나|지랄|미친|fuck|shit|bitch/i;

  async function sendMessage(studentInput: string) {
    if (!studentInput.trim() || loading) return;
    if (PROFANITY.test(studentInput)) {
      setMessages((prev) => [
        ...prev,
        { role: "student", text: studentInput },
        { role: "ai", text: "욕설은 사용할 수 없어요. 토론은 서로 존중하는 말로 해야 해요. 다시 말해볼까요?" },
      ]);
      setInput("");
      return;
    }

    setMessages((prev) => [...prev, { role: "student", text: studentInput }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await prepChat({ topic, turns, student_input: studentInput });
      setMessages((prev) => [...prev, { role: "ai", text: res.ai_response }]);
      setTurns((prev) => [...prev, [studentInput, res.ai_response]]);
      if (res.done && res.result) setDoneResult(res.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleAuto(stance: "찬성" | "반대") {
    setAutoMode(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prep/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, stance }),
      });
      if (!res.ok) throw new Error("자동 생성 실패");
      setDoneResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="h-full max-w-5xl mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4"
      style={{ background: "#A8F0E0" }}
    >
      <HomeButton />

      {/* 채팅 영역 */}
      <div className="flex flex-col h-full min-h-0 gap-3">
        {/* 주제 배너 */}
        <div
          className="px-5 py-3 text-center shrink-0 bg-white"
          style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
        >
          <p className="text-xs font-black text-black uppercase tracking-widest mb-1">오늘의 토론 주제</p>
          <p className="text-lg font-black text-black leading-snug">{topic}</p>
        </div>

        {showGuideOnMobile && (
          <div className="md:hidden shrink-0">
            <SourceGuideCard />
          </div>
        )}

        {/* 채팅 */}
        <div
          className="flex-1 overflow-y-auto bg-white px-4 py-3"
          style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
        >
          <div className="flex flex-col gap-3 pb-2">
            {messages.map((msg, i) => (
              <ChatBubble key={i} role={msg.role} text={msg.text} />
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-black font-bold text-sm pl-1">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce [animation-delay:0.15s]">●</span>
                <span className="animate-bounce [animation-delay:0.3s]">●</span>
                <span className="ml-1">AI 도우미가 생각 중이에요...</span>
              </div>
            )}
            {error && (
              <div
                className="px-4 py-2 text-sm font-bold"
                style={{ background: "#fecaca", border: "2px solid #000" }}
              >
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* 준비 완료 카드 */}
        {doneResult && (
          <PrepResultCard result={doneResult} onStart={() => onComplete(doneResult)} />
        )}

        {/* 입력 영역 */}
        {!doneResult && (
          <div className="flex gap-2 items-center shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="여기에 입력하세요..."
              disabled={loading}
              className="flex-1 px-4 py-3 text-base font-bold bg-white focus:outline-none disabled:bg-gray-100"
              style={{ border: "3px solid #000" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="px-4 py-3 font-black text-black bg-yellow-300 disabled:opacity-40 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all shrink-0"
              style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
            >
              전송
            </button>
            <button
              onClick={() => sendMessage("건너뛰기")}
              disabled={loading}
              className="px-4 py-3 font-black text-black bg-white disabled:opacity-40 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all shrink-0"
              style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
            >
              건너뛰기
            </button>
            {!autoMode ? (
              <button
                onClick={() => setAutoMode(true)}
                disabled={loading}
                className="px-4 py-3 font-black text-black bg-white disabled:opacity-40 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all shrink-0"
                style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
              >
                ✏️ 연습
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={() => handleAuto("찬성")}
                  disabled={loading}
                  className="px-3 py-3 font-black text-white active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
                  style={{ background: "#3b82f6", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
                >찬성</button>
                <button
                  onClick={() => handleAuto("반대")}
                  disabled={loading}
                  className="px-3 py-3 font-black text-white active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
                  style={{ background: "#ef4444", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
                >반대</button>
                <button
                  onClick={() => setAutoMode(false)}
                  disabled={loading}
                  className="px-3 py-3 font-black text-black bg-white active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
                  style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
                >✕</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 데스크톱 사이드바 */}
      <div className="hidden md:block self-start sticky top-4">
        <SourceGuideCard />
      </div>
    </div>
  );
}

function ChatBubble({ role, text }: { role: "student" | "ai"; text: string }) {
  const isStudent = role === "student";
  return (
    <div className={`flex ${isStudent ? "justify-end" : "justify-start"}`}>
      {!isStudent && (
        <div
          className="w-8 h-8 flex items-center justify-center font-black text-sm mr-2 mt-1 shrink-0 bg-yellow-300"
          style={{ border: "2px solid #000" }}
        >
          AI
        </div>
      )}
      <div
        className="max-w-[78%] px-4 py-3 text-base font-bold leading-relaxed"
        style={{
          background: isStudent ? "#3b82f6" : "#f3f4f6",
          color: isStudent ? "#fff" : "#000",
          border: "2px solid #000",
          boxShadow: "3px 3px 0px #000",
        }}
      >
        {text}
      </div>
      {isStudent && (
        <div
          className="w-8 h-8 flex items-center justify-center font-black text-sm text-white ml-2 mt-1 shrink-0"
          style={{ background: "#3b82f6", border: "2px solid #000" }}
        >
          나
        </div>
      )}
    </div>
  );
}

function PrepResultCard({ result, onStart }: { result: PrepResult; onStart: () => void }) {
  const stanceBg = result.stance === "찬성" ? "#3b82f6" : result.stance === "반대" ? "#ef4444" : "#6b7280";

  return (
    <div
      className="px-5 py-4 shrink-0 bg-white"
      style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-black text-black text-base">✅ 준비 완료!</p>
        <span
          className="text-sm px-3 py-1 font-black text-white"
          style={{ background: stanceBg, border: "2px solid #000" }}
        >
          {result.stance || "입장 미정"}
        </span>
      </div>
      <ul className="text-sm font-bold text-gray-700 space-y-1 mb-4">
        {result.grounds.map((g, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-black text-blue-600 shrink-0">근거 {i + 1}</span>
            <span>{g || "—"}</span>
          </li>
        ))}
        {result.sources.map((s, i) => (
          <li key={`s${i}`} className="flex gap-2 text-gray-400">
            <span className="font-black shrink-0">자료 {i + 1}</span>
            <span>{s || "(없음)"}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onStart}
        className="w-full py-3 font-black text-black text-base active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
        style={{ background: "#faff00", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
      >
        🗣️ 토론 시작하기
      </button>
    </div>
  );
}
