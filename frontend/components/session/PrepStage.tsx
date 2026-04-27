"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [autoMode, setAutoMode]     = useState(false);  // 연습 stance 선택 UI

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 모바일: 턴 4 진입 시(turns.length >= 3) 카드 표시
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

    const userMsg: Message = { role: "student", text: studentInput };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await prepChat({ topic, turns, student_input: studentInput });

      const aiMsg: Message = { role: "ai", text: res.ai_response };
      setMessages((prev) => [...prev, aiMsg]);
      setTurns((prev) => [...prev, [studentInput, res.ai_response]]);

      if (res.done && res.result) {
        setDoneResult(res.result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSkip() {
    sendMessage("건너뛰기");
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
      const result: PrepResult = await res.json();
      setDoneResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  const chatArea = (
    <div className="flex flex-col h-full gap-3">
      {/* 주제 배너 */}
      <div className="rounded-2xl bg-blue-50 border border-blue-200 px-5 py-3 text-center shrink-0">
        <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">
          오늘의 토론 주제
        </p>
        <p className="text-lg font-bold text-blue-800 leading-snug">{topic}</p>
      </div>

      {/* 모바일: 턴 4 이상에서 가이드 카드 */}
      {showGuideOnMobile && (
        <div className="md:hidden shrink-0">
          <SourceGuideCard />
        </div>
      )}

      {/* 채팅 영역 */}
      <ScrollArea className="flex-1 rounded-2xl border bg-white shadow-sm px-4 py-3">
        <div className="flex flex-col gap-3 pb-2">
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} text={msg.text} />
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm pl-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce [animation-delay:0.15s]">●</span>
              <span className="animate-bounce [animation-delay:0.3s]">●</span>
              <span className="ml-1">AI 도우미가 생각 중이에요...</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

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
            className="flex-1 rounded-2xl border border-gray-300 px-4 py-3 text-base
                       focus:outline-none focus:ring-2 focus:ring-blue-400
                       disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="rounded-2xl px-5 py-3 text-base font-bold bg-blue-500
                       hover:bg-blue-600 disabled:opacity-40 h-auto"
          >
            전송
          </Button>
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={loading}
            className="rounded-2xl px-4 py-3 text-sm text-gray-500 h-auto whitespace-nowrap"
          >
            건너뛰기
          </Button>
          {!autoMode ? (
            <Button
              variant="outline"
              onClick={() => setAutoMode(true)}
              disabled={loading}
              className="rounded-2xl px-4 py-3 text-sm text-purple-600 border-purple-300 h-auto whitespace-nowrap"
            >
              ✏️ 연습
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                onClick={() => handleAuto("찬성")}
                disabled={loading}
                className="rounded-2xl px-3 py-3 text-sm font-bold bg-blue-500 hover:bg-blue-600 h-auto"
              >찬성</Button>
              <Button
                onClick={() => handleAuto("반대")}
                disabled={loading}
                className="rounded-2xl px-3 py-3 text-sm font-bold bg-red-500 hover:bg-red-600 h-auto"
              >반대</Button>
              <Button
                variant="outline"
                onClick={() => setAutoMode(false)}
                disabled={loading}
                className="rounded-2xl px-3 py-3 text-sm h-auto"
              >✕</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    // 데스크톱: 채팅 + 사이드바 / 모바일: 채팅만
    <div className="relative h-full max-w-5xl mx-auto px-4 py-4
                    grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
      <HomeButton />
      {/* 채팅 영역 */}
      <div className="flex flex-col h-full min-h-0">
        {chatArea}
      </div>

      {/* 데스크톱 전용 사이드바 */}
      <div className="hidden md:block self-start sticky top-4">
        <SourceGuideCard />
      </div>
    </div>
  );
}

/* ── 말풍선 ──────────────────────────────────────────────────────────────── */
function ChatBubble({ role, text }: { role: "student" | "ai"; text: string }) {
  const isStudent = role === "student";
  return (
    <div className={`flex ${isStudent ? "justify-end" : "justify-start"}`}>
      {!isStudent && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center
                        text-blue-600 font-bold text-sm mr-2 mt-1 shrink-0">
          AI
        </div>
      )}
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-base leading-relaxed shadow-sm
          ${isStudent
            ? "bg-blue-500 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
          }`}
      >
        {text}
      </div>
      {isStudent && (
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center
                        text-white font-bold text-sm ml-2 mt-1 shrink-0">
          나
        </div>
      )}
    </div>
  );
}

/* ── 준비 완료 결과 카드 ─────────────────────────────────────────────────── */
function PrepResultCard({
  result,
  onStart,
}: {
  result: PrepResult;
  onStart: () => void;
}) {
  const stanceColor =
    result.stance === "찬성"
      ? "bg-blue-500 text-white"
      : result.stance === "반대"
      ? "bg-red-500 text-white"
      : "bg-gray-400 text-white";

  return (
    <div className="rounded-2xl border-2 border-green-300 bg-green-50 px-5 py-4 shadow shrink-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-green-700 font-bold text-base">✅ 준비 완료!</p>
        <Badge className={`text-sm px-3 py-1 rounded-full ${stanceColor}`}>
          {result.stance || "입장 미정"}
        </Badge>
      </div>

      <ul className="text-sm text-gray-700 space-y-1 mb-4">
        {result.grounds.map((g, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-semibold text-blue-600 shrink-0">근거 {i + 1}</span>
            <span>{g || "—"}</span>
          </li>
        ))}
        {result.sources.map((s, i) => (
          <li key={`s${i}`} className="flex gap-2 text-gray-400">
            <span className="font-semibold shrink-0">자료 {i + 1}</span>
            <span>{s || "(없음)"}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={onStart}
        className="w-full rounded-2xl py-3 text-base font-bold bg-green-500
                   hover:bg-green-600 h-auto"
      >
        🗣️ 토론 시작하기
      </Button>
    </div>
  );
}
