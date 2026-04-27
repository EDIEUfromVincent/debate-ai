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
  new_evidence: "🆕 새 근거 투입",
  insult:       "🚫 비방·거친말",
  off_topic:    "⚠️ 주제 이탈",
  no_response:  "⏰ 무응답",
};

export default function JudgeStage({ result, topic, studentSide, onRestart }: JudgeStageProps) {
  const { pro_score, con_score, winner, summary, events } = result;

  const winnerLabel =
    winner === "pro" ? "찬성 팀 승리!"
    : winner === "con" ? "반대 팀 승리!"
    : "무승부!";

  const winnerBg =
    winner === "pro" ? "#3b82f6"
    : winner === "con" ? "#ef4444"
    : "#6b7280";

  const studentWon =
    (winner === "pro" && studentSide === "pro") ||
    (winner === "con" && studentSide === "con");

  function handleDownload() {
    const lines = [
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
    ];
    if (events.length > 0) {
      lines.push(``, `## 탐지 이벤트`);
      for (const ev of events)
        lines.push(`- ${EVENT_LABELS[ev.type] ?? ev.type} (${ev.side === "pro" ? "찬성" : "반대"}, ${ev.phase})`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "debate_result.md"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center py-10 px-4 gap-5"
      style={{ background: "#A8F0E0" }}
    >
      <HomeButton />

      {/* 승자 배지 */}
      <div
        className="bg-white w-full max-w-lg p-8 text-center"
        style={{ border: "3px solid #000", boxShadow: "6px 6px 0px #000" }}
      >
        <p className="text-5xl mb-3">{winner === "tie" ? "🤝" : "🏆"}</p>
        <p className="text-3xl font-black mb-2" style={{ color: winnerBg }}>{winnerLabel}</p>
        <p className="text-sm font-bold text-black">
          당신은 <span className="font-black">{studentSide === "pro" ? "찬성" : "반대"}</span> —&nbsp;
          {studentWon
            ? <span style={{ color: "#16a34a" }}>승리했습니다 🎉</span>
            : winner === "tie"
            ? <span className="text-gray-500">무승부</span>
            : <span style={{ color: "#dc2626" }}>패배했습니다</span>}
        </p>
      </div>

      {/* 4축 막대그래프 */}
      <div
        className="bg-white w-full max-w-lg p-6"
        style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
      >
        <p className="text-xs font-black text-black uppercase tracking-widest mb-4">4축 점수</p>
        <div className="flex flex-col gap-4">
          {(["A", "B", "C", "D"] as const).map((ax) => (
            <div key={ax}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-black text-black">{ax} {AXIS_LABELS[ax]}</span>
                <div className="flex gap-3 text-xs font-black">
                  <span style={{ color: "#3b82f6" }}>찬성 {pro_score[ax]}/3</span>
                  <span style={{ color: "#ef4444" }}>반대 {con_score[ax]}/3</span>
                </div>
              </div>
              {/* 찬성 바 */}
              <div className="mb-1" style={{ height: 14, background: "#e5e7eb", border: "2px solid #000" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(pro_score[ax] / 3) * 100}%`,
                    background: "#3b82f6",
                    transition: "width 0.4s",
                  }}
                />
              </div>
              {/* 반대 바 */}
              <div style={{ height: 14, background: "#e5e7eb", border: "2px solid #000" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(con_score[ax] / 3) * 100}%`,
                    background: "#ef4444",
                    transition: "width 0.4s",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 총점 */}
        <div className="mt-5 pt-4" style={{ borderTop: "2px solid #000" }}>
          <p className="text-xs font-black text-black uppercase tracking-widest mb-2">총점 (12점 만점)</p>
          <div className="flex items-center gap-3">
            <span className="font-black w-6 text-right" style={{ color: "#3b82f6" }}>{pro_score.total}</span>
            <div className="flex-1" style={{ height: 20, border: "2px solid #000", display: "flex" }}>
              {/* 찬성: 중앙→왼쪽 */}
              <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", background: "#e5e7eb" }}>
                <div style={{ width: `${(pro_score.total / 12) * 100}%`, background: "#3b82f6", height: "100%" }} />
              </div>
              <div style={{ width: 2, background: "#000" }} />
              {/* 반대: 중앙→오른쪽 */}
              <div style={{ flex: 1, background: "#e5e7eb" }}>
                <div style={{ width: `${(con_score.total / 12) * 100}%`, background: "#ef4444", height: "100%" }} />
              </div>
            </div>
            <span className="font-black w-6" style={{ color: "#ef4444" }}>{con_score.total}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-gray-500 mt-1 px-8">
            <span>찬성</span>
            <span>반대</span>
          </div>
        </div>
      </div>

      {/* AI 총평 */}
      <div
        className="bg-white w-full max-w-lg p-6"
        style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
      >
        <p className="text-xs font-black text-black uppercase tracking-widest mb-2">AI 총평</p>
        <p className="text-sm font-bold text-black leading-relaxed">{summary}</p>
      </div>

      {/* 이벤트 목록 */}
      {events.length > 0 && (
        <div
          className="w-full max-w-lg p-6"
          style={{ background: "#fef08a", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
        >
          <p className="text-xs font-black text-black uppercase tracking-widest mb-3">탐지된 이벤트</p>
          <ul className="flex flex-col gap-1.5">
            {events.map((ev, i) => (
              <li key={i} className="text-sm font-bold text-black flex items-center gap-2">
                <span>{EVENT_LABELS[ev.type] ?? ev.type}</span>
                <span>·</span>
                <span>{ev.side === "pro" ? "찬성" : "반대"}</span>
                <span className="text-gray-500 text-xs">{ev.phase}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-3 w-full max-w-lg">
        <button
          onClick={handleDownload}
          className="flex-1 py-3 font-black text-black bg-white active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
          style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
        >
          결과 다운로드
        </button>
        <button
          onClick={onRestart}
          className="flex-1 py-3 font-black text-black active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
          style={{ background: "#faff00", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
        >
          새 토론 시작
        </button>
      </div>
    </div>
  );
}
