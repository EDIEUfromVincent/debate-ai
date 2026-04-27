"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 font-black text-sm bg-white active:shadow-none active:translate-x-1 active:translate-y-1 transition-all self-start"
        style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
      >
        🏠 홈
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-sm bg-white p-6 flex flex-col gap-4"
            style={{ border: "3px solid #000", boxShadow: "6px 6px 0px #000" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-black text-black">⚠️ 홈으로 돌아가시겠어요?</p>
            <p className="text-sm font-bold text-gray-600">현재 토론 내용이 모두 삭제됩니다.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-black bg-white active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
                style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
              >
                취소
              </button>
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 text-sm font-black text-white active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
                style={{ background: "#ff4444", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
              >
                홈으로 가기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
