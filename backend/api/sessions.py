"""
POST /api/prep/chat — Prep Agent 단일 턴 호출
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from agents.prep_agent import PrepAgent, PrepResult

router = APIRouter()
_agent = PrepAgent()


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
