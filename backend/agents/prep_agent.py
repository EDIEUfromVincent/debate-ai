"""
Prep Agent — §8.2.1
소크라테스식 대화로 학생의 {주제, 입장, 근거3, 자료3}을 완성시킨다.

종료 조건:
  1. AI 응답에 "준비 완료" 포함 → 정상 종료
  2. 학생 입력이 "건너뛰기" → 즉시 종료 (자료 빈 문자열 허용)
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from llm.agent_base import AgentBase

_SYSTEM_PROMPT = """\
당신은 초등 6학년 학생이 국어 토론 수업을 준비하도록 돕는 AI 도우미입니다.

[목표]
학생이 주제에 대해 찬성 또는 반대 입장을 정하고, 근거 3가지와 각 근거를 뒷받침하는 자료를 갖추도록 돕는 것.

[규칙]
1. 학생에게 답을 주지 말고 질문으로 유도하라. 소크라테스식 대화.
2. 학생이 근거를 만들면, "이 근거가 주장을 뒷받침하나요?" "조사 범위가 적절한가요?" "출처가 믿을 만한가요?"를 학생 스스로 점검하게 하라.
3. 학생이 출처를 명시하지 않으면, 기사·책·백과사전 형식에 맞춰 쓰는 법을 안내하라.
4. 초등 6학년 수준의 어휘를 사용하라.
5. 학생의 의견이 특정 정치·종교적 편향을 띨 경우, 중립적 재구성을 제안하라.
6. 학생이 욕설·비방·혐오 표현을 사용하면 대화를 즉시 중단하고 단호하게 경고하라.
   경고 형식: "욕설은 사용할 수 없어요. 토론은 서로 존중하는 말로 해야 해요. 다시 말해볼까요?"
   경고 후에는 이전 질문을 반복하지 말고 한 문장으로 대기하라. 절대 친절하게 달래지 말 것.

[출력 형식]
- 항상 짧고 자연스러운 대화체로만 응답하라. 마크다운, 기호(*, **, ```, #), JSON 절대 사용 금지.
- 학생의 최종 준비물 = {주장, 근거[0], 근거[1], 근거[2], 자료[0], 자료[1], 자료[2]}
- 이 7개 필드가 다 채워지면 응답 마지막 줄에 아래 한 줄만 추가하라 (다른 설명 없이):
RESULT_JSON:{"입장":"찬성","근거":["...","...","..."],"자료":["...","...","..."]}
- 그 위에는 "준비 완료. 토론을 시작할 수 있어요!" 한 문장만 쓰고 끝내라.
"""

_READY_SIGNAL = "준비 완료"
_SKIP_KEYWORD = "건너뛰기"


@dataclass
class PrepResult:
    topic: str
    stance: str           # "찬성" | "반대"
    grounds: list[str]    # 3개
    sources: list[str]    # 3개 (빈 문자열 허용)
    skipped: bool = False
    history: list[dict[str, Any]] = field(default_factory=list)


class PrepAgent(AgentBase):
    model = "gemini-2.5-flash-lite"
    thinking_budget = 0
    max_tokens = 512
    temperature = 0.7

    def build_system_prompt(self) -> str:
        return _SYSTEM_PROMPT

    def chat(
        self,
        topic: str,
        turns: list[tuple[str, str]] | None = None,
        student_input: str = "",
    ) -> tuple[str, bool, PrepResult | None]:
        """
        단일 대화 턴 처리.

        Args:
            topic:         토론 주제
            turns:         지금까지의 (student, ai) 쌍 리스트
            student_input: 이번 학생 발화

        Returns:
            (ai_response, is_done, PrepResult | None)
            is_done=True이면 PrepResult가 채워짐.
        """
        # 건너뛰기 즉시 종료 — 이전 발화에서 입장 추론
        if _SKIP_KEYWORD in student_input:
            stance = _infer_stance(turns or [], student_input)
            result = PrepResult(
                topic=topic,
                stance=stance,
                grounds=["", "", ""],
                sources=["", "", ""],
                skipped=True,
                history=self._build_history(topic, turns or [], student_input, ""),
            )
            return "알겠습니다. 바로 토론을 시작합니다.", True, result

        history = self._build_history(topic, turns or [])
        ai_response = str(self.call(student_input, history=history))

        is_done = _READY_SIGNAL in ai_response
        result = None
        if is_done:
            result = _parse_result(topic, ai_response)
            result.history = self._build_history(
                topic, turns or [], student_input, ai_response
            )

        # RESULT_JSON 줄은 UI에 보내지 않음
        clean_response = re.sub(r"\nRESULT_JSON:\{.*\}", "", ai_response).strip()

        return clean_response, is_done, result

    # ── 내부 헬퍼 ────────────────────────────────────────────────────────────

    def _build_history(
        self,
        topic: str,
        turns: list[tuple[str, str]],
        last_student: str = "",
        last_ai: str = "",
    ) -> list[dict[str, Any]]:
        """(student, ai) 쌍을 Gemini contents 형식으로 변환."""
        contents: list[dict[str, Any]] = [
            {"role": "user", "parts": [{"text": f"오늘 토론 주제는 '{topic}'입니다. 준비를 시작해요."}]},
            {"role": "model", "parts": [{"text": "네! 먼저 이 주제에 대해 찬성과 반대 중 어느 쪽 입장을 취하고 싶은가요?"}]},
        ]
        for student_msg, ai_msg in turns:
            contents.append({"role": "user",  "parts": [{"text": student_msg}]})
            contents.append({"role": "model", "parts": [{"text": ai_msg}]})
        return contents


def _infer_stance(turns: list[tuple[str, str]], last_input: str) -> str:
    """이전 대화와 현재 입력에서 찬성/반대 키워드를 찾아 반환."""
    all_text = " ".join(s for s, _ in turns) + " " + last_input
    if re.search(r"반대|반대측|con", all_text, re.IGNORECASE):
        return "반대"
    if re.search(r"찬성|찬성측|pro", all_text, re.IGNORECASE):
        return "찬성"
    return ""


def _parse_result(topic: str, ai_text: str) -> PrepResult:
    """AI 응답에서 RESULT_JSON: 줄을 추출해 PrepResult로 변환."""
    match = re.search(r"RESULT_JSON:(\{.*\})", ai_text)
    if match:
        try:
            data = json.loads(match.group(1))
            return PrepResult(
                topic=topic,
                stance=data.get("입장", ""),
                grounds=_pad(data.get("근거", []), 3),
                sources=_pad(data.get("자료", []), 3),
            )
        except json.JSONDecodeError:
            pass
    return PrepResult(topic=topic, stance="", grounds=["", "", ""], sources=["", "", ""])


def _pad(lst: list[str], n: int) -> list[str]:
    return (lst + [""] * n)[:n]
