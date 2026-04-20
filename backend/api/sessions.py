"""
POST /api/prep/chat — Prep Agent 단일 턴 호출
POST /api/prep/auto — 입장만 주면 근거+자료 자동 생성
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from agents.prep_agent import PrepAgent
from llm.agent_base import AgentBase

router = APIRouter()
_agent = PrepAgent()


class _AutoAgent(AgentBase):
    model = "gemini-2.5-flash-lite"
    thinking_budget = 0
    max_tokens = 600
    temperature = 0.7
    response_schema = {
        "type": "object",
        "properties": {
            "근거": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
            "자료": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
        },
        "required": ["근거", "자료"],
    }

    def build_system_prompt(self) -> str:
        return (
            "초등 6학년 토론 수업용 준비물 생성기입니다. "
            "주제와 입장을 받으면 근거 3가지와 각 근거를 뒷받침하는 자료 3가지를 생성하세요. "
            "초등 6학년 수준의 언어로, 실제 출처(기사명·기관명·책명 등)를 구체적으로 포함하세요."
        )


_auto_agent = _AutoAgent()


class PrepChatRequest(BaseModel):
    topic: str
    turns: list[tuple[str, str]] = []
    student_input: str


class PrepChatResponse(BaseModel):
    ai_response: str
    done: bool
    result: dict[str, Any] | None = None


@router.post("/prep/chat", response_model=PrepChatResponse)
async def prep_chat(req: PrepChatRequest) -> PrepChatResponse:
    ai_response, done, result = _agent.chat(
        topic=req.topic,
        turns=req.turns,
        student_input=req.student_input,
    )

    result_dict: dict[str, Any] | None = None
    if result is not None:
        result_dict = {
            "topic":   result.topic,
            "stance":  result.stance,
            "grounds": result.grounds,
            "sources": result.sources,
            "skipped": result.skipped,
        }

    return PrepChatResponse(ai_response=ai_response, done=done, result=result_dict)


class PrepAutoRequest(BaseModel):
    topic: str
    stance: str   # "찬성" | "반대"


@router.post("/prep/auto")
async def prep_auto(req: PrepAutoRequest) -> dict[str, Any]:
    prompt = f"주제: {req.topic}\n입장: {req.stance}\n\n이 입장에 맞는 근거 3가지와 자료 3가지를 생성해줘."
    data = _auto_agent.call(prompt)  # response_schema → dict 반환
    grounds = (data.get("근거") or ["", "", ""])[:3]
    sources = (data.get("자료") or ["", "", ""])[:3]
    return {
        "topic":   req.topic,
        "stance":  req.stance,
        "grounds": grounds,
        "sources": sources,
        "skipped": False,
    }
