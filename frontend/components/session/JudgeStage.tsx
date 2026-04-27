"use client";

import { JudgeResult } from "./DebateStage";
import HomeButton from "@/components/common/HomeButton";

interface JudgeStageProps {
  result: JudgeResult;
  topic: string;
  studentSide: "pro" | "con";
  onRestart: () => void;
}

const AXIS_LABELS: Record<string, string> = {
  A: "논리성",
  B: "근거 충실성",
  C: "태도·언어",
  D: "구성력",
};

const EVENT_LABELS: Record<string, string> = {
  new_evidence:  "🆕 새 근거 투입",
  insult:        "🚫 비방·거친말",
  off_topic:     "⚠️ 주제 이탈",
  no_response:   "⏰ 무응답",
};

export default function JudgeStage({ result, topic, studentSide, onRestart }: JudgeStageProps) {
  const { pro_score, con_score, winner, summary, events } = result;

  const winnerLabel =
    winner === "pro" ? "찬성 팀 승리!"
    : winner === "con" ? "반대 팀 승리!"
    : "무승부!";

  const winnerColor =
    winner === "pro" ? "text-blue-600"
    : winner === "con" ? "text-red-600"
    : "text-gray-600";

  const studentWon =
    (winner === "pro" && studentSide === "pro") ||
    (winner === "con" && studentSide === "con");

  function handleDownload() {
    const lines: string[] = [
      `# 토론 결과 보고서`,
      ``,
      `**주제**: ${topic}`,
      `**결과**: ${winnerLabel}`,
      ``,
      `## AI 총평`,
      summary,
      ``,
      `## 점수`,
      `| 축 | 찬성 | 반대 |`,
      `|---|---|---|`,
      ...(["A", "B", "C", "D"] as const).map(
        (ax) => `| ${ax} ${AXIS_LABELS[ax]} | ${pro_score[ax]}/3 | ${con_score[ax]}/3 |`
      ),
      `| **합계** | **${pro_score.total}/12** | **${con_score.total}/12** |`,
      ``,
    ];
    if (events.length > 0) {
      lines.push(`## 탐지 이벤트`);
      for (const ev of events) {
        lines.push(`- ${EVENT_LABELS[ev.type] ?? ev.type} (${ev.side === "pro" ? "찬성" : "반대"}, ${ev.phase})`);
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "debate_result.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4 gap-6">
      <HomeButton />
      {/* 승자 배지 */}
      <div className="rounded-2xl bg-white border shadow-md w-full max-w-lg p-8 text-center">
        <p className="text-5xl mb-3">{winner === "tie" ? "🤝" : "🏆"}</p>
        <p className={`text-2xl font-extrabold mb-1 ${winnerColor}`}>{winnerLabel}</p>
        <p className="text-sm text-gray-400 mb-2">
          당신은 <span className="font-bold">{studentSide === "pro" ? "찬성" : "반대"}</span> —&nbsp;
          {studentWon
            ? <span className="text-green-600 font-bold">승리했습니다 🎉</span>
            : winner === "tie"
            ? <span className="text-gray-500 font-bold">무승부</span>
            : <span className="text-red-500 font-bold">패배했습니다</span>}
        </p>
      </div>

      {/* 4축 막대그래프 */}
      <div className="rounded-2xl bg-white border shadow-sm w-full max-w-lg p-6">
        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">4축 점수</p>
        <div className="flex flex-col gap-3">
          {(["A", "B", "C", "D"] as const).map((ax) => (
            <div key={ax}>
              <p className="text-xs text-gray-500 mb-0.5">{ax} {AXIS_LABELS[ax]}</p>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-blue-600 font-semibold">{pro_score[ax]}/3</span>
                <span className="text-red-600 font-semibold">{con_score[ax]}/3</span>
              </div>
              <div className="flex gap-1 h-4">
                {/* 찬성 바 */}
                <div className="flex-1 bg-gray-100 rounded-full overflow-hidden flex justify-end">
                  <div
                    className="bg-blue-400 rounded-full transition-all"
                    style={{ width: `${(pro_score[ax] / 3) * 100}%` }}
                  />
                </div>
                {/* 반대 바 */}
                <div className="flex-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="bg-red-400 rounded-full transition-all"
                    style={{ width: `${(con_score[ax] / 3) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 총점 게이지 */}
        <div className="mt-5 border-t pt-4">
          <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">총점 (12점 만점)</p>
          <div className="flex items-center gap-3">
            <span className="text-blue-600 font-bold w-10 text-right">{pro_score.total}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden flex">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${(pro_score.total / 12) * 100}%` }}
              />
              <div
                className="bg-red-500 h-full transition-all"
                style={{ width: `${(con_score.total / 12) * 100}%` }}
              />
            </div>
            <span className="text-red-600 font-bold w-10">{con_score.total}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1 px-10">
            <span>찬성</span>
            <span>반대</span>
          </div>
        </div>
      </div>

      {/* AI 총평 */}
      <div className="rounded-2xl bg-blue-50 border border-blue-200 shadow-sm w-full max-w-lg p-6">
        <p className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-2">AI 총평</p>
        <p className="text-sm text-blue-900 leading-relaxed">{summary}</p>
      </div>

      {/* 이벤트 목록 */}
      {events.length > 0 && (
        <div className="rounded-2xl bg-yellow-50 border border-yellow-200 shadow-sm w-full max-w-lg p-6">
          <p className="text-xs font-bold text-yellow-600 uppercase tracking-wide mb-3">탐지된 이벤트</p>
          <ul className="flex flex-col gap-1.5">
            {events.map((ev, i) => (
              <li key={i} className="text-sm text-yellow-900 flex items-center gap-2">
                <span>{EVENT_LABELS[ev.type] ?? ev.type}</span>
                <span className="text-yellow-500">·</span>
                <span>{ev.side === "pro" ? "찬성" : "반대"}</span>
                <span className="text-yellow-400 text-xs">{ev.phase}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-3 w-full max-w-lg">
        <button
          onClick={handleDownload}
          className="flex-1 rounded-2xl border border-gray-300 bg-white py-3 text-sm font-semibold
                     text-gray-700 hover:bg-gray-50 transition-colors"
        >
          결과 다운로드 (.md)
        </button>
        <button
          onClick={onRestart}
          className="flex-1 rounded-2xl bg-blue-600 py-3 text-sm font-bold
                     text-white hover:bg-blue-700 transition-colors"
        >
          새 토론 시작
        </button>
      </div>
    </div>
  );
}
