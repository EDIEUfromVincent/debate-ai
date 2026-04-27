# 이 프로젝트의 절대 규칙

1. 작업 시작 전 반드시 `docs/build_spec_v0.2.md`를 전체 정독할 것.
2. 런타임 LLM 호출은 Google Gemini (AI Studio) API만 사용한다. Anthropic, OpenAI 등 다른 제공사 코드 작성 금지.
3. 첫 번째 작업은 반드시 상태 머신 단위 테스트(`tests/test_state_machine.py`)를 구현보다 먼저 작성하는 것이다.
4. 스펙의 §16(OUT of scope) 항목은 사용자가 명시적으로 요청해도 구현하지 않는다.
5. §19의 오픈 질문은 임의 결정하지 말고 사용자(JV)에게 질문한다.