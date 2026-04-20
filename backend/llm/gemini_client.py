"""
Google Gemini API 공용 클라이언트 (REST/httpx — SDK 없음).
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env.local"
load_dotenv(_ENV_PATH)

_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def _stub_response(system_instruction: str, contents: list[dict[str, Any]], response_schema: dict[str, Any] | None) -> str:
    last = contents[-1]["parts"][0]["text"] if contents else ""
    if response_schema is not None:
        props = response_schema.get("properties", {})
        if "violations" in props:
            return json.dumps({"violations": []})
        if "pro_score" in props:
            return json.dumps({
                "pro_score": {"A": 2, "B": 2, "C": 2, "D": 2, "total": 8},
                "con_score": {"A": 1, "B": 2, "C": 1, "D": 1, "total": 5},
                "events": [], "summary": "[STUB] 찬성 팀 승리.", "winner": "pro",
            })
        return json.dumps({k: "" for k in props})
    if "사회자" in system_instruction or "MC" in system_instruction.upper():
        return "[STUB MC] 다음 발언자 차례입니다."
    if "상대팀" in system_instruction or "토론자" in system_instruction:
        return f"[STUB AI] 저는 반대합니다. 근거: {last[:30] or '이유 1, 이유 2, 이유 3'}"
    return f"[STUB] {last[:40] or '응답'}"


def generate(
    *,
    model: str,
    system_instruction: str,
    contents: list[dict[str, Any]],
    response_schema: dict[str, Any] | None = None,
    max_output_tokens: int = 1024,
    temperature: float = 0.7,
    thinking_budget: int | None = 0,
) -> str:
    if os.environ.get("STUB_MODE") == "1":
        return _stub_response(system_instruction, contents, response_schema)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set")

    generation_config: dict[str, Any] = {
        "maxOutputTokens": max_output_tokens,
        "temperature": temperature,
    }

    if response_schema is not None:
        generation_config["responseMimeType"] = "application/json"
        generation_config["responseSchema"] = response_schema

    if thinking_budget is not None:
        generation_config["thinkingConfig"] = {"thinkingBudget": thinking_budget}

    body: dict[str, Any] = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": contents,
        "generationConfig": generation_config,
    }

    url = f"{_BASE}/{model}:generateContent?key={api_key}"
    resp = httpx.post(url, json=body, timeout=60)
    resp.raise_for_status()
    data = resp.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Unexpected Gemini response: {data}") from e
