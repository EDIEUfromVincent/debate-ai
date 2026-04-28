"""
에이전트 베이스 클래스.
모든 에이전트(Prep, Opponent, MC, Judge, Moderation)는 이 클래스를 상속한다.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

from llm.gemini_client import generate, agenerate


class AgentBase(ABC):
    """
    Args:
        model:           Gemini 모델 ID
        system_prompt:   에이전트 시스템 프롬프트 (§8.2 스켈레톤)
        response_schema: JSON schema dict. None이면 텍스트 응답.
        thinking_budget: Gemini thinking 예산 토큰 수.
                         0  → thinking 완전 OFF (MC, Moderation, Prep, Opponent)
                         None → 모델 기본값 사용 (Judge: thinking ON)
        max_tokens:      응답 최대 토큰
        temperature:     0.0 ~ 2.0
    """

    model: str = "gemini-2.5-flash"
    response_schema: dict[str, Any] | None = None
    thinking_budget: int | None = 0   # 기본값: thinking OFF
    max_tokens: int = 1024
    temperature: float = 0.7

    def __init__(self) -> None:
        self._system_prompt = self.build_system_prompt()

    @abstractmethod
    def build_system_prompt(self) -> str:
        """서브클래스에서 에이전트 고유 시스템 프롬프트 반환."""
        ...

    def call(
        self,
        user_message: str,
        history: list[dict[str, Any]] | None = None,
        system_override: str | None = None,
    ) -> str | dict[str, Any]:
        """
        단일 턴 호출.

        Args:
            user_message:    이번 턴의 입력 텍스트
            history:         이전 대화 turns.
            system_override: 이 호출에만 적용할 시스템 프롬프트 (없으면 기본값 사용)

        Returns:
            response_schema가 없으면 str, 있으면 파싱된 dict.
        """
        contents = list(history or [])
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        raw = generate(
            model=self.model,
            system_instruction=system_override if system_override is not None else self._system_prompt,
            contents=contents,
            response_schema=self.response_schema,
            max_output_tokens=self.max_tokens,
            temperature=self.temperature,
            thinking_budget=self.thinking_budget,
        )

        if self.response_schema is not None:
            return json.loads(raw)
        return raw

    async def acall(
        self,
        user_message: str,
        history: list[dict[str, Any]] | None = None,
        system_override: str | None = None,
    ) -> str | dict[str, Any]:
        contents = list(history or [])
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        raw = await agenerate(
            model=self.model,
            system_instruction=system_override if system_override is not None else self._system_prompt,
            contents=contents,
            response_schema=self.response_schema,
            max_output_tokens=self.max_tokens,
            temperature=self.temperature,
            thinking_budget=self.thinking_budget,
        )

        if self.response_schema is not None:
            return json.loads(raw)
        return raw
