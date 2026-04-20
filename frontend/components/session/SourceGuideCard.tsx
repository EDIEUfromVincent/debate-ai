"use client";

import { useState } from "react";

export default function SourceGuideCard() {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-yellow-300 bg-yellow-50 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-bold text-yellow-800 text-sm">📚 좋은 자료 찾는 팁</span>
        <span className="text-yellow-600 text-xs">{open ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 text-xs text-gray-700">
          {/* 섹션 a */}
          <div>
            <p className="font-semibold text-yellow-700 mb-1">정부·공공기관 사이트가 믿을 만해요</p>
            <ul className="space-y-0.5">
              <li>🟢 주소에 <span className="font-mono font-bold">.go.kr</span> — 정부</li>
              <li>🟢 주소에 <span className="font-mono font-bold">.or.kr</span> — 공공기관</li>
              <li>🔴 주소에 <span className="font-mono font-bold">.com</span> — 블로그·광고 많음</li>
            </ul>
          </div>

          <div className="border-t border-yellow-200" />

          {/* 섹션 b */}
          <div>
            <p className="font-semibold text-yellow-700 mb-1">뉴스는 신문사 이름을 확인하세요</p>
            <ul className="space-y-0.5">
              <li>🟢 이름 있는 신문사·방송사</li>
              <li>🔴 처음 들어보는 블로그·커뮤니티</li>
            </ul>
          </div>

          <div className="border-t border-yellow-200" />

          {/* 섹션 c */}
          <div>
            <p className="font-semibold text-yellow-700 mb-1">출처는 이렇게 적으세요</p>
            <ul className="space-y-0.5">
              <li>✅ <span className="text-green-700">"교육부 2023년 학교급식 영양 보고서"</span></li>
              <li>❌ <span className="text-red-600">"인터넷에서 봤음"</span></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
