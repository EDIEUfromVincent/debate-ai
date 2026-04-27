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
    router.push(`/session/new?topic=${encodeURIComponent(t)}&mode=${mode}`);
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#A8F0E0" }}
    >
      <div className="w-full max-w-lg flex flex-col gap-5">

        {/* 타이틀 */}
        <div
          className="text-center py-6 px-6"
          style={{ border: "3px solid #000", boxShadow: "6px 6px 0px #000", background: "#fff" }}
        >
          <p className="text-4xl font-black text-black mb-1">🗣️ 토론 수업 AI</p>
          <p className="text-sm font-bold text-gray-600">주제를 고르고 토론을 시작해 보세요</p>
        </div>

        {/* 주제 입력 */}
        <div
          className="bg-white p-5 flex flex-col gap-3"
          style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
        >
          <p className="text-xs font-black text-black uppercase tracking-widest">📝 토론 주제</p>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="직접 주제를 입력하세요..."
            rows={2}
            className="w-full px-4 py-3 text-base font-bold resize-none focus:outline-none"
            style={{ border: "3px solid #000" }}
          />
          <p className="text-xs font-black text-black uppercase tracking-widest mt-1">💡 예시 주제</p>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {SAMPLE_TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className={`text-left text-sm px-3 py-2 font-bold transition-all active:translate-x-0.5 active:translate-y-0.5
                  ${topic === t
                    ? "bg-yellow-300 shadow-none translate-x-0.5 translate-y-0.5"
                    : "bg-white hover:bg-yellow-100 shadow-[2px_2px_0px_#000]"}`}
                style={{ border: "2px solid #000" }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 모드 선택 */}
        <div
          className="bg-white p-5 flex flex-col gap-3"
          style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
        >
          <p className="text-xs font-black text-black uppercase tracking-widest">⚙️ 토론 방식</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("ai")}
              className={`p-4 text-left font-black transition-all active:translate-x-1 active:translate-y-1
                ${mode === "ai"
                  ? "bg-yellow-300 shadow-none translate-x-1 translate-y-1"
                  : "bg-white shadow-[4px_4px_0px_#000] hover:bg-yellow-100"}`}
              style={{ border: "3px solid #000" }}
            >
              <p className="text-2xl mb-1">🤖</p>
              <p className="font-black text-sm text-black">1 : AI</p>
              <p className="text-xs font-bold text-gray-500 mt-0.5">AI와 1대1 토론</p>
            </button>
            <button
              onClick={() => setMode("1v1")}
              className={`p-4 text-left font-black transition-all active:translate-x-1 active:translate-y-1
                ${mode === "1v1"
                  ? "bg-purple-300 shadow-none translate-x-1 translate-y-1"
                  : "bg-white shadow-[4px_4px_0px_#000] hover:bg-purple-100"}`}
              style={{ border: "3px solid #000" }}
            >
              <p className="text-2xl mb-1">👥</p>
              <p className="font-black text-sm text-black">1 : 1</p>
              <p className="text-xs font-bold text-gray-500 mt-0.5">친구와 함께 토론</p>
            </button>
          </div>
          {mode === "1v1" && (
            <p
              className="text-xs font-bold px-3 py-2"
              style={{ background: "#e9d5ff", border: "2px solid #000" }}
            >
              각자 기기에서 QR 코드로 접속하는 방식입니다.
            </p>
          )}
        </div>

        {/* 시작 버튼 */}
        <button
          onClick={handleStart}
          disabled={!topic.trim() || loading}
          className={`w-full py-4 text-black font-black text-lg transition-all
            ${!topic.trim() || loading
              ? "opacity-40 cursor-not-allowed"
              : "active:shadow-none active:translate-x-1 active:translate-y-1"}`}
          style={{
            background: "#faff00",
            border: "3px solid #000",
            boxShadow: (!topic.trim() || loading) ? "none" : "4px 4px 0px #000",
          }}
        >
          {loading ? "세션 생성 중..." : "토론 시작 →"}
        </button>
      </div>
    </main>
  );
}
