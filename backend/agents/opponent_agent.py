"""
Opponent Agent — 4단계 대칭 구조
AI 관점: opening → attack → defense → closing
학생 찬/반은 ai = "반대편" 한 줄로만 결정됨.
"""
from __future__ import annotations

from llm.agent_base import AgentBase

# ── 스크립트 ─────────────────────────────────────────────────────────────────

def ai_script(student_side: str) -> list[dict]:
    ai  = "con" if student_side == "pro" else "pro"
    opp = student_side
    return [
        {"role": "opening", "phase": f"phase_1_{ai}_1",          "reference": None},
        {"role": "attack",  "phase": f"phase_2_{ai}_2_rebuttal", "reference": f"phase_1_{opp}_1"},
        {"role": "defense", "phase": f"phase_2_{ai}_defense",    "reference": f"phase_2_{opp}_2_rebuttal"},
        {"role": "closing", "phase": f"phase_3_{ai}_3",          "reference": f"phase_1_{ai}_1"},
    ]


def determine_ai_role(phase_id: str, student_side: str) -> dict:
    for step in ai_script(student_side):
        if step["phase"] == phase_id:
            return {"speak": True, "role": step["role"], "reference_phase": step["reference"]}
    return {"speak": False}


# ── 프롬프트 ─────────────────────────────────────────────────────────────────

_BASE = """\
당신은 초등 6학년 토론 수업에서 {stance} 측을 맡은 AI 토론 상대입니다.
난이도: {difficulty}

[언어 규칙]
- 존댓말(~요, ~습니다) 필수. 반말 절대 금지.
- 초등 6학년 수준 어휘. 어려운 용어 금지.
- 약간의 논리적 허점을 남겨 학생이 반박할 여지를 주세요.
- 발화 텍스트만 출력. 단계명·설명·메타 정보 출력 금지.
"""

_ROLE_PROMPTS = {
    "opening": """\
주제: {topic}
당신의 입장: {stance}측

⚠️ 절대 규칙: 당신은 {stance}측입니다.
{stance} 입장에서만 주장하세요.
반대 입장의 논리를 절대 사용하지 마세요.

지금 입론을 발표할 차례입니다.
반드시 아래 형식:
"저는 {stance}합니다.
 첫 번째 근거는 [근거1]입니다. [출처1]
 두 번째 근거는 [근거2]입니다. [출처2]
 세 번째 근거는 [근거3]입니다. [출처3]"

출처는 "제가 읽은 기사에서는~", "~연구에 따르면~" 수준으로 구체적으로.
""",

    "attack": """\
주제: {topic}

[상대방의 입론]
{reference_utterance}

위 입론에 포함된 근거 1, 2, 3을 각각 하나씩 공격하세요.
반드시 아래 형식:
"첫 번째 근거에 대해서는, [반박1]
 두 번째 근거에 대해서는, [반박2]
 세 번째 근거에 대해서는, [반박3]"
위 입론 이외의 내용 언급 금지. 근거 3개 모두 공격 필수.
""",

    "defense": """\
주제: {topic}

[상대방의 공격]
{reference_utterance}

위 공격에서 지적한 내용만 방어하세요.
약한 부분은 인정하되 핵심 근거는 유지하세요.
역공격·새 주장 투입 금지.
""",

    "closing": """\
주제: {topic}

[당신의 원래 입론]
{reference_utterance}

위 입론에서 제시한 근거 1, 2, 3을 유지한 채 핵심만 재정리하세요.
새 근거 절대 금지. 상대 발화 반박 금지. 자기 주장 정리만.
""",
}


# ── 에이전트 ─────────────────────────────────────────────────────────────────

class OpponentAgent(AgentBase):
    model          = "gemini-2.5-flash-lite"
    thinking_budget = 0
    max_tokens     = 500
    temperature    = 0.8

    def __init__(self, stance: str = "반대", difficulty: str = "medium") -> None:
        self._stance     = stance
        self._difficulty = difficulty
        super().__init__()

    def build_system_prompt(self) -> str:
        return _BASE.format(stance=self._stance, difficulty=self._difficulty)

    def speak(
        self,
        phase_id: str,
        student_side: str,
        topic: str,
        all_turns: list[dict],
    ) -> str | None:
        role_info = determine_ai_role(phase_id, student_side)
        if not role_info["speak"]:
            return None

        role = role_info["role"]
        ref_text = ""
        if role_info["reference_phase"]:
            ref_text = self._find_utterance(all_turns, role_info["reference_phase"])

        system = _BASE.format(stance=self._stance, difficulty=self._difficulty)
        instruction = _ROLE_PROMPTS[role].format(
            topic=topic,
            stance=self._stance,
            reference_utterance=ref_text or "(참조 발화 없음)",
        )
        return str(self.call(instruction, system_override=system))

    def _find_utterance(self, turns: list[dict], phase_id: str) -> str:
        for t in turns:
            if t.get("phase") == phase_id:
                return t["text"]
        return ""
