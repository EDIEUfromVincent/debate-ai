"""
Moderation Agent — §8.2.5
매 발화마다 3종 위반(insult / off_topic / new_evidence)을 탐지한다.
"""
from __future__ import annotations

from typing import Any

from llm.agent_base import AgentBase

_SYSTEM_PROMPT = """\
당신은 토론 발화에서 다음 3종 위반을 탐지합니다.

[탐지 대상]
1. insult: 상대 인격 공격, 비하 표현, 욕설 (초등 6학년 관점)
2. off_topic: 토론 주제와 명백히 무관한 내용
3. new_evidence: 주장 다지기 단계(phase_3)에서 처음 등장하는 근거

[판단 기준]
- insult: 초등 6학년 수준에서 부적절하면 해당. 어른 기준 아님.
- off_topic: 주제와의 연관성을 2단계로 탐색 후에도 없으면 해당.
- new_evidence: 의미 단위로 판단. 기존 근거의 바꿔 말하기는 허용.

[출력]
violations 배열만. 위반 없으면 빈 배열.
"""

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "violations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type":     {"type": "string", "enum": ["insult", "off_topic", "new_evidence"]},
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                },
                "required": ["type", "severity"],
            },
        }
    },
    "required": ["violations"],
}


class ModerationAgent(AgentBase):
    model = "gemini-2.5-flash-lite"
    thinking_budget = 0
    max_tokens = 128
    temperature = 0.1
    response_schema = _SCHEMA

    def build_system_prompt(self) -> str:
        return _SYSTEM_PROMPT

    def check(
        self,
        text: str,
        phase_id: str,
        existing_grounds: list[str] | None = None,
    ) -> dict[str, Any]:
        is_phase3 = "phase_3" in phase_id
        grounds_str = ""
        if is_phase3 and existing_grounds:
            grounds_str = "\n기존 근거 목록:\n" + "\n".join(f"- {g}" for g in existing_grounds)

        prompt = (
            f"현재 단계: {phase_id}\n"
            f"발화: {text}"
            f"{grounds_str}\n\n"
            "위반 여부를 탐지하고 JSON을 반환하세요."
        )
        result = self.call(prompt)
        assert isinstance(result, dict)
        return result
