"""
Judge Agent — §8.2.4
세션 종료 시 1회 호출. 4축 루브릭 채점 + JSON 반환.
"""
from __future__ import annotations

from typing import Any

from llm.agent_base import AgentBase

_SYSTEM_PROMPT = """\
당신은 초등 6학년 토론 수업의 판정자 AI입니다. 감정이 아닌 루브릭에 근거해 판정합니다.

[4축 루브릭] (각 축 0~3점)

A. 근거 타당성
 0 = 주장과 무관한 근거
 1 = 근거가 주장과 느슨하게 연결됨
 2 = 근거가 주장을 적절히 뒷받침함
 3 = 3가지 근거 모두 명시적이고 논리적으로 주장을 뒷받침

B. 자료 신뢰성
 0 = 출처 전혀 없음
 1 = 출처 있으나 불명확
 2 = 출처 명시 + 조사 범위 적절
 3 = 출처 + 범위 + 신뢰성 3요소 모두 충족

C. 반박 적절성
 0 = 반박 부재 또는 회피
 1 = 감정적·비논리적 반박
 2 = 상대 근거의 논리적 허점 지적
 3 = 날카로운 질문 + 근거 재반박

D. 규칙 준수
 0 = 새 근거 투입 또는 거친말 다수 + 주제 이탈
 1 = 경미한 규칙 이탈 1~2회
 2 = 규칙 준수
 3 = 규칙 준수 + 명시적 상대 존중 표현

[판정 절차]
1. 각 축별 점수를 찬성(pro)/반대(con) 팀별로 산출
2. 탐지된 규칙 위반 이벤트를 D축에 반영
3. 총평 2~3문장 (성찰은 교사 역할이므로 raw 관찰만 기술)

[출력 형식]
반드시 아래 JSON 스키마를 정확히 따를 것.
"""

# Gemini structured output용 JSON schema (§8.2.4)
JUDGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "pro_score": {
            "type": "object",
            "properties": {
                "A": {"type": "integer", "minimum": 0, "maximum": 3},
                "B": {"type": "integer", "minimum": 0, "maximum": 3},
                "C": {"type": "integer", "minimum": 0, "maximum": 3},
                "D": {"type": "integer", "minimum": 0, "maximum": 3},
                "total": {"type": "integer", "minimum": 0, "maximum": 12},
            },
            "required": ["A", "B", "C", "D", "total"],
        },
        "con_score": {
            "type": "object",
            "properties": {
                "A": {"type": "integer", "minimum": 0, "maximum": 3},
                "B": {"type": "integer", "minimum": 0, "maximum": 3},
                "C": {"type": "integer", "minimum": 0, "maximum": 3},
                "D": {"type": "integer", "minimum": 0, "maximum": 3},
                "total": {"type": "integer", "minimum": 0, "maximum": 12},
            },
            "required": ["A", "B", "C", "D", "total"],
        },
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type":      {"type": "string"},
                    "phase":     {"type": "string"},
                    "side":      {"type": "string"},
                    "timestamp": {"type": "string"},
                },
                "required": ["type", "phase", "side"],
            },
        },
        "summary":  {"type": "string"},
        "winner":   {"type": "string", "enum": ["pro", "con", "tie"]},
    },
    "required": ["pro_score", "con_score", "events", "summary", "winner"],
}


class JudgeAgent(AgentBase):
    model = "gemini-2.5-flash"  # 무료 티어 운영 (Pro는 KR4 비교 시 별도)
    thinking_budget = 0        # flash + JSON schema: thinking OFF로 출력 예산 확보
    max_tokens = 1024
    temperature = 0.2          # 채점은 낮은 temperature
    response_schema = JUDGE_SCHEMA

    def build_system_prompt(self) -> str:
        return _SYSTEM_PROMPT

    def evaluate(
        self,
        topic: str,
        turns: list[dict[str, Any]],
        events: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        전체 세션을 채점한다.

        Args:
            topic:  토론 주제
            turns:  전체 발화 로그 [{"phase": ..., "speaker": ..., "text": ...}]
            events: 탐지된 위반 이벤트 목록

        Returns:
            JUDGE_SCHEMA에 맞는 dict
        """
        turns_text = "\n".join(
            f"[{t['phase']}] {t['speaker']}: {t['text']}" for t in turns
        )
        events_text = ""
        if events:
            events_text = "\n[탐지된 위반 이벤트]\n" + "\n".join(
                f"  - {e['type']} / {e.get('phase','')} / {e.get('side','')}"
                for e in events
            )

        prompt = (
            f"토론 주제: {topic}\n\n"
            f"[전체 발화 로그]\n{turns_text}"
            f"{events_text}\n\n"
            "위 세션 전체를 4축 루브릭으로 채점하고 JSON을 반환하세요."
        )

        result = self.call(prompt)
        assert isinstance(result, dict)
        return result
