"use client";

import { useState } from "react";

export default function SourceGuideCard() {
  const [open, setOpen] = useState(true);

  return (
    <div
      className="bg-white overflow-hidden"
      style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ borderBottom: open ? "2px solid #000" : "none" }}
      >
        <span className="font-black text-black text-sm">📚 좋은 자료 찾는 팁</span>
        <span className="font-bold text-gray-600 text-xs">{open ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 flex flex-col gap-3 text-xs font-bold text-black">
          <div>
            <p className="font-black text-black mb-1">정부·공공기관 사이트가 믿을 만해요</p>
            <ul className="space-y-0.5">
              <li>🟢 주소에 <span className="font-black">.go.kr</span> — 정부</li>
              <li>🟢 주소에 <span className="font-black">.or.kr</span> — 공공기관</li>
              <li>🔴 주소에 <span className="font-black">.com</span> — 블로그·광고 많음</li>
            </ul>
          </div>

          <div style={{ borderTop: "2px solid #000" }} />

          <div>
            <p className="font-black text-black mb-1">뉴스는 신문사 이름을 확인하세요</p>
            <ul className="space-y-0.5">
              <li>🟢 이름 있는 신문사·방송사</li>
              <li>🔴 처음 들어보는 블로그·커뮤니티</li>
            </ul>
          </div>

          <div style={{ borderTop: "2px solid #000" }} />

          <div>
            <p className="font-black text-black mb-1">출처는 이렇게 적으세요</p>
            <ul className="space-y-0.5">
              <li>✅ <span className="text-green-700 font-black">"교육부 2023년 학교급식 영양 보고서"</span></li>
              <li>❌ <span className="text-red-600 font-black">"인터넷에서 봤음"</span></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
