"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SAMPLE_TOPICS = [
  "초등학교에서 시험은 꼭 실시되어야 하는가?",
  "초등학생은 초등학교에 스마트폰을 가져올 필요가 있는가?",
  "우리나라는 통일을 해야 하는가?",
  "귀신은 존재하는가?",
  "역사교과서에 나오는 내용은 모두 사실인가?",
  "솔직한 것이 좋은가?",
  "줄임말을 사용하는 것이 좋은가?",
  "10대 청소년은 화장을 해도 되는가?",
  "'강제적 셧다운제'는 온라인게임 중독예방에 효과가 있는가?",
  "우리나라에서 할로윈을 즐기는 것이 좋은가?",
  "외국어(영어)는 조기교육(유치원)이 필요할까?",
  "공동주택(아파트)에서 반려동물을 키워도 되는가?",
  "부모님, 선생님이 하시는 말씀을 꼭 들어야 하는가?",
  "급식에서 채식 메뉴를 의무적으로 제공해야 한다",
  "학교 교복 착용을 의무화해야 한다",
];

type Mode = "ai" | "1v1";

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<Mode>("ai");
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    const t = topic.trim();
    if (!t) return;
    setLoading(true);
    // 세션 파라미터를 URL query로 넘겨 SessionContainer에서 소비
    router.push(`/session/new?topic=${encodeURIComponent(t)}&mode=${mode}`);
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg flex flex-col gap-6">

        {/* 타이틀 */}
        <div className="text-center mb-2">
          <p className="text-3xl font-extrabold text-gray-800 mb-1">토론 수업 AI</p>
          <p className="text-sm text-gray-400">주제를 고르고 토론을 시작해 보세요</p>
        </div>

        {/* 주제 입력 */}
        <div className="rounded-2xl bg-white border shadow-sm p-5 flex flex-col gap-3">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">토론 주제</p>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="직접 주제를 입력하세요..."
            rows={2}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base
                       focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-gray-400 font-semibold">예시 주제 선택</p>
            <div className="flex flex-col gap-1">
              {SAMPLE_TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`text-left text-sm px-3 py-2 rounded-xl border transition-colors
                    ${topic === t
                      ? "bg-blue-50 border-blue-400 text-blue-700 font-semibold"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 모드 선택 */}
        <div className="rounded-2xl bg-white border shadow-sm p-5 flex flex-col gap-3">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">토론 방식</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("ai")}
              className={`rounded-xl border-2 p-4 text-left transition-all
                ${mode === "ai"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-gray-50 hover:border-blue-300"}`}
            >
              <p className="text-lg mb-1">🤖</p>
              <p className={`font-bold text-sm ${mode === "ai" ? "text-blue-700" : "text-gray-700"}`}>
                1 : AI
              </p>
              <p className="text-xs text-gray-400 mt-0.5">AI와 1대1 토론</p>
            </button>
            <button
              onClick={() => setMode("1v1")}
              className={`rounded-xl border-2 p-4 text-left transition-all
                ${mode === "1v1"
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 bg-gray-50 hover:border-purple-300"}`}
            >
              <p className="text-lg mb-1">👥</p>
              <p className={`font-bold text-sm ${mode === "1v1" ? "text-purple-700" : "text-gray-700"}`}>
                1 : 1
              </p>
              <p className="text-xs text-gray-400 mt-0.5">친구와 함께 토론</p>
            </button>
          </div>
          {mode === "1v1" && (
            <p className="text-xs text-purple-500 bg-purple-50 rounded-xl px-3 py-2">
              각자 기기에서 QR 코드로 접속하는 방식입니다.
            </p>
          )}
        </div>

        {/* 시작 버튼 */}
        <button
          onClick={handleStart}
          disabled={!topic.trim() || loading}
          className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                     py-4 text-white font-extrabold text-base transition-colors"
        >
          {loading ? "세션 생성 중..." : "토론 시작 →"}
        </button>
      </div>
    </main>
  );
}
