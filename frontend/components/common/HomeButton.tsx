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
        className="absolute top-3 left-3 z-40 flex items-center gap-1.5
                   rounded-xl border border-gray-200 bg-white/90 backdrop-blur
                   px-3 py-1.5 text-sm font-semibold text-gray-700
                   shadow-sm hover:bg-gray-50 transition-colors"
      >
        🏠 홈
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-bold text-gray-800">
              ⚠️ 홈으로 돌아가시겠어요?
            </p>
            <p className="text-sm text-gray-500">
              현재 토론 내용이 모두 삭제됩니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold
                           text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => router.push("/")}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold
                           text-white hover:bg-red-600 transition-colors"
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
