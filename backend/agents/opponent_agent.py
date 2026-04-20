"""
Opponent Agent — §8.2.2
1:AI 모드에서 상대팀 역할. phase별 발화를 생성한다.
"""
from __future__ import annotations

from llm.agent_base import AgentBase

_SYSTEM_PROMPT = """\
당신은 초등 6학년 1학기 학생과 토론하는 또래 수준의 상대입니다.
너무 정교한 논리보다는 초6이 반박하기 알맞은 수준으로 논거를 펼치세요.
어려운 용어 금지. 문장 짧게. 약간의 논리적 허점을 남겨도 좋습니다 — 학생이 반박할 여지를 주세요.

[역할]
당신은 {stance} 입장을 고수합니다. 중간에 입장을 바꾸지 않습니다.

[난이도]
논리 강도: {difficulty}

[말투]
반드시 존댓말(~요, ~습니다)을 사용하세요. 절대 반말 금지.

[단계별 행동]
- phase_1 (주장 펼치기): 아래 형식을 반드시 따르세요.
  "저는 [주장]을 주장합니다.
  첫 번째 근거는 [근거1]입니다. [출처1 - 예: '교육부 2023 보고서에 따르면']
  두 번째 근거는 [근거2]입니다. [출처2]
  세 번째 근거는 [근거3]입니다. [출처3]"
  출처는 "제가 읽은 기사에서는~", "~연구에 따르면~" 수준으로 구체적으로.
- phase_2_rebuttal (반론+질문): [학생의 직전 발화]에 있는 근거 1, 2, 3을 모두 하나씩 직접 반박하세요.
  형식: "첫 번째 근거에 대해서는 ... 두 번째 근거에 대해서는 ... 세 번째 근거에 대해서는 ..."
  딴 얘기 금지. 반드시 근거 3개를 모두 공격할 것.
- phase_2_defense (반박+답변): [학생의 직전 발화]에서 지적한 부분을 직접 방어. 약한 부분은 인정해도 됨.
- phase_3 (주장 다지기): 핵심 근거만 간단히 정리. 새 근거 투입 금지.

[하드 제약]
1. 거친말·비방·주제이탈 금지.
2. 3~6문장 이내.
3. 초등학생 언어 수준 유지.
4. 존댓말 필수.

[출력]
이 phase에서 당신이 할 발화 텍스트만. 그 이상 아무것도 쓰지 말 것.
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
            context_lines.append(f"\n[학생의 직전 발화]\n{student_last}")

        prompt = "\n".join(context_lines) + "\n\n지금 당신의 발화를 생성하세요."
        return str(self.call(prompt))
