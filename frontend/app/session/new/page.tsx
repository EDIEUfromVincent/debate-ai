import { Suspense } from "react";
import NewSessionContainer from "./NewSessionContainer";

export default function NewSessionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">로딩 중...</div>}>
      <NewSessionContainer />
    </Suspense>
  );
}
