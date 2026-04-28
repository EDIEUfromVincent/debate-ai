"""
MC Agent — §8.2.3
phase 전환 안내, 경고, rerouting 메시지를 1~2문장으로 생성한다.
"""
from __future__ import annotations

from enum import Enum

from llm.agent_base import AgentBase

_SYSTEM_PROMPT = """\
당신은 초등 6학년 토론 수업의 사회자 AI입니다.

[역할]
1. 각 phase 전환 시, 다음 화자와 발언 시간을 안내
2. 10초간 무응답 발생 시 rerouting 메시지 송출
3. 거친말·주제이탈 탐지 시 경고 메시지 송출
4. 주장 다지기 단계에서 새 근거가 투입되면 즉시 경고

[말투]
- 정중하고 단호함. 초등학생에게 어울리는 친근함 유지.
- 경고는 건조하게, 격려는 따뜻하게.

[출력]
상황에 맞는 1~2문장만. 그 이상 쓰지 말 것.
"""

# phase별 한국어 이름과 발화자·시간 정보
_PHASE_META: dict[str, dict] = {
    "phase_1_pro_1":          {"name": "주장 펼치기",   "speaker": "찬성",  "sec": 0},
    "phase_1_con_1":          {"name": "주장 펼치기",   "speaker": "반대",  "sec": 0},
    "consultation_1":         {"name": "생각 정리",     "speaker": "각자",  "sec": 0},
    "phase_2_con_2_rebuttal": {"name": "반론·질문",     "speaker": "반대",  "sec": 0},
    "phase_2_pro_defense":    {"name": "반박·답변",     "speaker": "찬성",  "sec": 0},
    "phase_2_pro_2_rebuttal": {"name": "반론·질문",     "speaker": "찬성",  "sec": 0},
    "phase_2_con_defense":    {"name": "반박·답변",     "speaker": "반대",  "sec": 0},
    "consultation_2":         {"name": "생각 정리",     "speaker": "각자",  "sec": 0},
    "phase_3_con_3":          {"name": "주장 다지기",   "speaker": "반대",  "sec": 0},
    "phase_3_pro_3":          {"name": "주장 다지기",   "speaker": "찬성",  "sec": 0},
    "judging":                {"name": "판정 중",       "speaker": "AI",    "sec": 30},
}


class MCEvent(str, Enum):
    PHASE_START    = "phase_start"
    NO_RESPONSE    = "no_response"
    VIOLATION      = "violation"      # insult / off_topic / new_evidence
    OVERRUN        = "overrun"
    EARLY_COMPLETE = "early_complete"


class MCAgent(AgentBase):
    model = "gemini-2.5-flash-lite"   # §8.1: 짧은 정형 발화
    thinking_budget = 0
    max_tokens = 80
    temperature = 0.4

    def build_system_prompt(self) -> str:
        return _SYSTEM_PROMPT

    def announce(
        self,
        event: MCEvent,
        phase_id: str = "",
        violation_type: str = "",
    ) -> str:
        """
        상황에 맞는 MC 발화 1~2문장 반환.

        Args:
            event:          MCEvent 종류
            phase_id:       현재 or 다음 phase ID
            violation_type: "insult" | "off_topic" | "new_evidence"
        """
        meta = _PHASE_META.get(phase_id, {})
        phase_name = meta.get("name", phase_id)
        speaker = meta.get("speaker", "")

        if event == MCEvent.PHASE_START:
            if "consultation" in phase_id:
                prompt = (
                    f"[{phase_name}] 단계입니다. "
                    "각자 잠깐 생각을 정리하는 시간이에요. "
                    "'팀', '여러분', '먼저 찬성부터' 같은 말 절대 쓰지 마세요. "
                    "1문장으로만 안내하세요."
                )
            else:
                prompt = (
                    f"다음 단계 안내: [{phase_name}] — {speaker} 차례. "
                    "시간 제한 언급하지 말고, 화자와 단계만 안내하는 메시지를 1~2문장으로 말하세요."
                )
        elif event == MCEvent.NO_RESPONSE:
            prompt = (
                "학생이 10초간 응답하지 않았습니다. "
                "부드럽게 격려하며 나중에 답변해도 된다고 안내하는 메시지를 1~2문장으로 말하세요."
            )
        elif event == MCEvent.VIOLATION:
            vtype_kor = {
                "insult": "거친말·비방",
                "off_topic": "주제 이탈",
                "new_evidence": "새 근거 투입",
            }.get(violation_type, violation_type)
            prompt = (
                f"규칙 위반 감지: [{vtype_kor}]. "
                "건조하고 단호하게 경고하는 메시지를 1~2문장으로 말하세요."
            )
        elif event == MCEvent.OVERRUN:
            prompt = (
                f"[{phase_name}] 발언 시간이 초과되었습니다. "
                "시간 종료를 알리고 다음 단계로 넘어감을 안내하는 메시지를 1~2문장으로 말하세요."
            )
        elif event == MCEvent.EARLY_COMPLETE:
            prompt = (
                "학생이 발언을 일찍 마쳤습니다. "
                "더 할 말이 없는지 확인하고 다음 단계로 넘어가는 메시지를 1~2문장으로 말하세요."
            )
        else:
            prompt = "다음 단계로 진행합니다."

        return str(self.call(prompt))
