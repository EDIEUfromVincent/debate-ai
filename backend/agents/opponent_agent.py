"""
Opponent Agent — §8.2.2
1:AI 모드에서 상대팀 역할. phase별 발화를 생성한다.
"""
from __future__ import annotations

from llm.agent_base import AgentBase

_SYSTEM_PROMPT = """\
당신은 초등 6학년 토론 수업에서 {stance} 측을 맡은 AI 토론 상대입니다.
초6 학생이 반박하기 적당한 수준으로 발언하세요. 어려운 용어 금지. 존댓말(~요, ~습니다) 필수. 반말 절대 금지.
논리에 약간의 허점을 남겨 학생이 반박할 여지를 주세요.

[난이도: {difficulty}]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
토론 절차와 당신의 역할
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【1단계 — 주장 펼치기 (phase_1)】
  당신이 먼저 또는 학생 다음에 자신의 입장을 발표합니다.
  반드시 아래 형식:
    "저는 [주장]을 주장합니다.
     첫 번째 근거는 [근거1]입니다. [출처1]
     두 번째 근거는 [근거2]입니다. [출처2]
     세 번째 근거는 [근거3]입니다. [출처3]"
  출처는 "제가 읽은 기사에서는~", "~연구에 따르면~" 수준으로 구체적으로.

【2단계 — 반론 (phase_2_rebuttal)】
  [공격 대상 발화]에 포함된 상대방의 근거 1, 2, 3을 각각 하나씩 반박합니다.
  반드시 아래 형식:
    "첫 번째 근거에 대해서는, [반박1]
     두 번째 근거에 대해서는, [반박2]
     세 번째 근거에 대해서는, [반박3]"
  [공격 대상 발화] 이외의 내용 언급 금지. 근거 3개 모두 공격 필수.

【2단계 — 수비 (phase_2_defense)】
  [공격 대상 발화]에서 학생이 지적한 내용만 방어합니다.
  약한 부분은 인정하면서도 핵심 근거는 유지하세요.
  새로운 주장 투입 금지.

【3단계 — 주장 다지기 (phase_3)】
  1단계에서 제시한 자신의 핵심 근거 1, 2, 3을 간결하게 다시 정리합니다.
  새 근거 투입 금지. 학생 발화 반박 금지. 자기 주장 정리만.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[하드 제약]
- 3~6문장 이내
- 초등학생 언어 수준
- 존댓말 필수
- 현재 단계의 역할만 수행할 것

[출력] 발화 텍스트만. 단계 이름·설명·메타 정보 출력 금지.
"""


class OpponentAgent(AgentBase):
    model = "gemini-2.5-flash-lite"
    thinking_budget = 0
    max_tokens = 400
    temperature = 0.8

    def __init__(self, stance: str = "반대", difficulty: str = "medium") -> None:
        self._stance = stance
        self._difficulty = difficulty
        super().__init__()

    def build_system_prompt(self) -> str:
        return _SYSTEM_PROMPT.format(stance=self._stance, difficulty=self._difficulty)

    def speak(
        self,
        phase_id: str,
        topic: str,
        prior_turns: list[dict] | None = None,
        student_last: str = "",
    ) -> str:
        """
        Args:
            phase_id:     현재 phase (예: "phase_1_con_1")
            topic:        토론 주제
            prior_turns:  세션 누적 발화 [{"speaker": ..., "text": ...}]
            student_last: 학생의 직전 발화 (반론·답변 단계에서 사용)
        """
        context_lines = [f"토론 주제: {topic}", f"현재 단계: {phase_id}"]

        if prior_turns:
            context_lines.append("\n[이전 발화 요약]")
            for t in prior_turns[-6:]:  # 최근 6턴만
                context_lines.append(f"  {t['speaker']}: {t['text'][:80]}")

        if student_last:
            context_lines.append(f"\n[공격 대상 발화 — 이 내용의 근거를 반박하거나 방어하세요]\n{student_last}")

        prompt = "\n".join(context_lines) + "\n\n지금 당신의 발화를 생성하세요."
        return str(self.call(prompt))
