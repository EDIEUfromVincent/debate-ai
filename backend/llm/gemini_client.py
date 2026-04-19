"""
Google Gemini API 공용 클라이언트.
모든 에이전트가 이 클라이언트를 통해 호출한다.

SDK: google-genai
인증: 환경변수 GEMINI_API_KEY (.env.local)
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

# 프로젝트 루트의 .env.local 로드 (backend/ 기준 두 단계 위)
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env.local"
load_dotenv(_ENV_PATH)


def _build_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "GEMINI_API_KEY not set. "
            f"Looked for .env.local at: {_ENV_PATH}"
        )
    return genai.Client(api_key=api_key)


# 모듈 레벨 싱글턴 — 재사용으로 연결 오버헤드 최소화
_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = _build_client()
    return _client


def _stub_response(system_instruction: str, contents: list[dict[str, Any]], response_schema: dict[str, Any] | None) -> str:
    """STUB_MODE=1 일 때 Gemini 없이 고정 응답 반환."""
    import json as _json
    last = contents[-1]["parts"][0]["text"] if contents else ""
    if response_schema is not None:
        props = response_schema.get("properties", {})
        # violations 스키마 → 위반 없음
        if "violations" in props:
            return _json.dumps({"violations": []})
        # judge 스키마
        if "pro_score" in props:
            return _json.dumps({
                "pro_score": {"A": 2, "B": 2, "C": 2, "D": 2, "total": 8},
                "con_score": {"A": 1, "B": 2, "C": 1, "D": 1, "total": 5},
                "events": [],
                "summary": "[STUB] 찬성 팀이 논리적 근거를 잘 제시했습니다.",
                "winner": "pro",
            })
        # prep 스키마 등
        return _json.dumps({k: "" for k in props})
    # 텍스트 응답
    if "사회자" in system_instruction or "MC" in system_instruction.upper():
        return "[STUB MC] 다음 발언자 차례입니다."
    if "상대팀" in system_instruction or "토론자" in system_instruction:
        return f"[STUB AI] 저는 이 주제에 대해 반대합니다. 근거: {last[:30] or '이유 1, 이유 2, 이유 3'}"
    if "코치" in system_instruction or "prep" in system_instruction.lower():
        return "[STUB Coach] 좋은 주장입니다. 계속해 보세요."
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
    """
    단일 generation 호출. 텍스트 또는 JSON 문자열 반환.

    Args:
        model:              Gemini 모델 ID (예: "gemini-2.5-flash")
        system_instruction: 에이전트 시스템 프롬프트
        contents:           [{"role": "user"|"model", "parts": [{"text": "..."}]}]
        response_schema:    JSON schema dict → structured output 활성화
        max_output_tokens:  응답 최대 토큰
        temperature:        0.0 ~ 2.0
        thinking_budget:    0 → thinking OFF, None → 모델 기본값, 정수 → 예산 지정
    """
    if os.environ.get("STUB_MODE") == "1":
        return _stub_response(system_instruction, contents, response_schema)

    client = get_client()

    generation_config_kwargs: dict[str, Any] = {
        "max_output_tokens": max_output_tokens,
        "temperature": temperature,
    }

    if response_schema is not None:
        generation_config_kwargs["response_mime_type"] = "application/json"
        generation_config_kwargs["response_schema"] = response_schema

    if thinking_budget is not None:
        generation_config_kwargs["thinking_config"] = types.ThinkingConfig(
            thinking_budget=thinking_budget,
        )

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        **generation_config_kwargs,
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )

    return response.text
