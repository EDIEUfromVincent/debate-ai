# 토론 수업 AI 시스템 — 빌드 스펙 v0.2

> **대상 독자**: Claude Code (VS Code에서 실제 구현 담당)
> **문서 작성자**: JV (초등 6학년 국어 담당) + Claude Opus 4.7 (전략/설계 담당)
> **상태**: v0 MVP 빌드 준비 완료
> **LLM 제공사**: **Google Gemini (AI Studio API, 학교 규정)** — Anthropic/Claude API 사용 금지
> **문서 길이**: 이 문서 하나로 빌드 착수 가능하도록 self-contained

## v0.2 변경사항 (v0.1에서 정정)

1. **목적 재정의**: 이 프로그램은 교실의 3:3 대면 토론을 준비하는 보조재가 **아니다**. 이 프로그램 **자체가 수업 시간에 진행되는 토론 수업**이다. 스파링(1:AI, 1:1)은 별도 준비 차시가 아니라 **수업의 본편**. §1, §2, §4, §5의 맥락 서술을 이에 맞게 수정.
2. **LLM 스택 전환**: Claude API → **Google Gemini API (AI Studio)**. §8, §14 모델 매핑 전면 교체. Claude Code는 IDE 도구로만 사용되고, 런타임 LLM 호출은 모두 Gemini.

---

## 0. Claude Code에게 — 이 문서를 이렇게 써라

이 문서는 **결정된 것들의 기록**이다. 섹션 15(OUT of scope)에 명시된 것들은 논쟁하지 말고 배제할 것. 섹션 11(권장 빌드 순서)의 순서를 어기고 싶으면 반드시 사용자(JV)에게 확인 후 진행할 것.

핵심 우선순위:
1. **상태 머신(§7)과 AI 에이전트 설계(§8)가 도메인 core**다. 여기가 흔들리면 전체가 흔들린다.
2. **Text-first**. 음성(STT)은 v1 이후로 유예되어 있음. 현재 MVP는 **텍스트 입력만** 다룬다.
3. **하네스(harness) 관점**: 각 구성요소는 **scalar로 측정 가능한 출력**을 내야 한다. "잘 돌아감" 같은 비-verifiable한 평가 기준은 사용하지 말 것.
4. 이 시스템은 **교사 1인 + 학급 20~25명** 환경에서 쓰인다. 서버 부하, 동시 접속, UI 단순성은 이 제약에서 설계되어야 한다.

---

## 1. 프로젝트 개요

### 1.1 한 문장 정의

초등 6학년 국어 [6국01-03] "타당성을 생각하며 토론해요" 단원의 **토론 수업을 AI 사회자·판정자가 자율적으로 진행하여 수업 자체를 완결**시키는 프로그램. 학생은 1:AI 또는 1:1 모드로 참여하고, 수업 1차시 안에 준비–토론–판정–보고서까지 마무리된다.

### 1.2 사용 맥락

```
[수업 1차시 (40분) 안에 일어나는 일 — 이 도구 안에서 모두 처리]
 0~ 5분  교사 구두 오리엔테이션 + 모드 선택
 5~10분  Prep: 주제 확인, 근거 3개 준비 (AI 도우미와 대화)
10~28분  토론 진행: AI MC 진행 하에 토론 완주 (18분, §5.1 시간표)
28~32분  Judging: AI Judge가 4축 채점
32~38분  학생 결과 확인 + 교사 보고서 자동 생성
38~40분  교사 구두 마무리·성찰 유도
```

**핵심**: 이 도구는 "나중에 할 대면 토론의 연습판"이 아니다. **이것이 토론 수업이다**. 교사의 역할은 수업 전 오리엔테이션과 수업 후 성찰 지도에 집중되고, 본 토론 과정 자체는 AI가 자율 진행한다.

### 1.3 1:AI와 1:1이 필요한 이유

한 수업에서 **교사가 운영 방식을 선택**한다. 학급 상황·학생 성숙도·디바이스 여건에 따라:

- **1:AI 모드**: 전원이 각자 AI를 상대로 토론. 발언 기회 균등, 심리 부담 낮음, 디바이스 수만큼 동시 실행 가능.
- **1:1 모드 (QR 방)**: 두 학생이 짝을 지어 AI 사회자·판정 아래 토론. 진짜 사람 상대의 긴장감, 협상 경험.

두 모드 모두 **그 자체로 완결된 토론 수업**. 어느 것도 다른 것의 "준비 단계"가 아니다.

### 1.4 이 도구가 아닌 것 (negative definition)

- **교실 3:3 대면 토론의 준비 도구가 아님** (v0.1의 오해). MVP는 3:3을 다루지 않으며, 3:3 중계는 v1 이후 별도 스코프.
- 세특·생기부 자동 작성기가 아님. 보고서는 raw material만 제공.
- AI 디지털교과서(AIDT) 대체재가 아님. AIDT의 complement.
- 학생이 AI와 자유 대화하는 챗봇이 아님. 정해진 상태 머신을 따르는 구조화된 토론.

---

## 2. 교육학적 맥락 (Claude Code가 도메인 이해를 위해 읽을 것)

### 2.1 교과 성취기준
- **[6국01-03]** 타당성을 생각하며 토론에 참여한다.
- 단원 학습지 체크 항목 3종:
  - 근거가 주장을 뒷받침하는가?
  - 조사 범위가 적절한가?
  - 출처가 믿을 만한가?
- 학생 활동지 점검 항목 (내용 축): 근거 타당성, 자료의 주장·근거 뒷받침, 순서어(첫째/둘째/마지막) 사용, 접속어(그리고/또한/그러므로/하지만) 사용.
- 학생 활동지 점검 항목 (태도 축): 목소리 크기·발음, 강조, 속도, **상대방 존중 태도**.

v0에서 **태도 축 중 "상대방 존중"만 텍스트로 검증 가능**. 목소리·발음·속도는 STT 없이 불가능하므로 v1 이후 유예.

### 2.2 교실 현실 제약
- 학급당 학생 20~25명, 수업 1차시 = 40분.
- 학생당 디바이스 1대 (크롬북/아이패드/개인 스마트폰 혼재).
- **교실 동시 접속 최대 25세션** 가정 (1:AI 모드 시 최대 25 동시 세션, 1:1 모드 시 최대 12~13쌍).
- 교사의 AI 이해도는 중간 (AI를 써본 적은 있으나 복잡한 UI는 거부감).
- **학교 네트워크 방화벽/정책**: Google 서비스는 통상 허용됨 (Google Workspace for Education 채택 학교 다수). 이것이 Gemini 채택 근거 중 하나.

### 2.3 2e/영재 특화는 배제
JV의 박사 연구 트랙(music-based game for 2e metacognition)과 **이 MVP는 분리**한다. MVP는 일반 학급용. 2e 요소를 섞으면 두 프로젝트 다 망가진다.

---

## 3. OKR (측정 가능한 목표)

### O (Objective)
AI 사회자+판정자가 **수업 1차시(40분) 안에 토론 수업 전체를 자율 진행**하여, 시간표대로 완주하고, 4축 루브릭 평가와 교사용 요약 보고서를 산출한다.

### KR (Key Results)

| KR | 지표 | 목표값 | 검증 방법 |
|---|---|---|---|
| **KR1 진행 완주율** | 9개 phase 전이 성공률 | 1.0 (=100%) | 상태 전이 로그 |
| **KR2 MC 개입 정확도** | 4개 이벤트(10초 무응답 / 한명쏠림 / 새근거 / 거친말) precision/recall | ≥ 0.85 | 라벨링된 20 발화 샘플 |
| **KR3 루브릭 정합성** | 4축 0~3점 서술어 완비, 학습지 체크항목 100% 매핑 | 커버리지 1.0 | 정적 매핑 검사 |
| **KR4 판정 신뢰도** | 교사 3인 평균 vs AI 판정 Spearman ρ | ≥ 0.70 | 50 발화 이중 채점 |
| **KR5 교사 부담** | 실시간 개입 / 세션당 사후 작성 | ≤ 5분 / ≤ 10분 | 타이머 계측 |

모든 KR은 **scalar 또는 [0,1]**이다. 하나가 실패해도 어디가 부러졌는지 즉시 식별 가능.

---

## 4. 시장 포지셔닝 (Claude Code가 알아야 할 설계 근거)

### 4.1 5층 AI 토론 스택

| Layer | 기능 | 이미 점유된 도구 | 우리의 목표 |
|---|---|---|---|
| L1. 준비 (Prep) | 주제·자료·역할 가이드 생성 | 교풀, 뤼튼, ChatGPT | **덮는다** (기본기) |
| L2. 토론 실행 (Run) | 1:1 또는 1:AI 구조화된 토론 | 참둥봇, Symbai, Khanmigo | **덮는다** (core) |
| **L3. 진행 (Orchestrate)** | **시간·발언권·규칙 실시간 통제** | **거의 empty** | **여기가 moat** |
| **L4. 판정 (Judge)** | **축별 루브릭 채점 + 보고서** | Jenova, HUMMINGo (제한적) | **여기가 moat** |
| L5. 성찰 (Reflect) | 사후 피드백, 세특 연계 | 교풀 세특 도우미 | **교사에게 남김** |

우리의 차별화는 **L3 × L4 × 한국어 × 6학년 국어 정합**. 나머지 요소로 경쟁하지 말 것.

### 4.2 이세미 외(2025) 학술 모형과의 관계
그들의 9단계 모형(수업준비→수업안내→AI토론준비→AI토론→브리지→대면토론→성찰→정리→평가)과 우리의 차이:

- **이세미 모형**: AI토론이 대면토론의 준비 단계로 설정됨. "브리지" 단계로 연결.
- **우리 MVP**: 대면 토론을 전제하지 않는다. **AI 진행 토론 자체가 수업의 본편**이며, 교사는 오리엔테이션(수업안내)과 성찰·정리만 담당. "브리지·대면토론" 단계는 v1 이후 확장 후보.

이세미 모형이 "AI는 보조자"로 본다면, 우리는 **"AI는 수업 운영자"**로 본다. 학술적으로는 더 공격적 포지션이지만, 교실 현실(교사 1인이 20+명을 3:3 토론 여러 조로 동시 운영 불가능)에서는 필수적 선택.

---

## 5. 토론 절차 (이 수업이 따르는 진행 구조, 모든 모드 공통)

이 절차가 **수업 자체**다. Canva 슬라이드에 제시된 것과 동일한 구조를 AI 사회자가 진행한다.

### 5.1 시간표

```
[1] 주장 펼치기 (2분 × 2 = 4분)
     ├─ 찬성1 발언 (2분): 주장 + 근거 3가지 + 근거자료
     └─ 반대1 발언 (2분): 주장 + 근거 3가지 + 근거자료

[협의 1] (2분)
     ├─ 찬성팀 내 협의: 반대팀 주장에 대한 반론·질문 정리
     └─ 반대팀 내 협의: 찬성팀 주장에 대한 반론·질문 정리

[2] 반론 (1분 30초 × 4 = 6분)
     ├─ 반대2 반론+질문 (1분 30초) → 찬성 반박+답변 (1분 30초)
     └─ 찬성2 반론+질문 (1분 30초) → 반대 반박+답변 (1분 30초)

[협의 2] (2분)
     ├─ 핵심 근거 정리 + 우리편 주장의 장점 강조 전략 수립

[3] 주장 다지기 (2분 × 2 = 4분)
     ├─ 반대3 주장 다지기 (2분)
     └─ 찬성3 주장 다지기 (2분)

총 토론 시간: 18분
+ 오리엔테이션(2분) + 판정 결과 표시(3분) + 보고서 생성(2분) = 약 25분
+ 교사 개입 버퍼 + 보고서 검토 = 40분 1차시 내 완결
```

### 5.2 역할 배치

Canva 슬라이드는 3:3 구조(찬성1·2·3 / 반대1·2·3)를 보여주지만, 우리 MVP는 그 역할을 **한 사람(또는 AI)이 모두 수행**한다.

| Slot | 역할 |
|---|---|
| 찬성1, 반대1 | 주장 펼치기 |
| 찬성2, 반대2 | 반론 + 질문 제기 |
| 찬성3, 반대3 | 주장 다지기 |

- **1:AI 모드**: 학생 1명이 한 쪽(찬성 or 반대)의 1·2·3 slot 모두 담당. AI Opponent가 반대쪽 1·2·3 모두 담당.
- **1:1 모드**: 학생 A가 한 쪽 1·2·3, 학생 B가 반대쪽 1·2·3 담당. AI는 사회자·판정자만.

방어(반박+답변)는 해당 팀 담당자가 그대로 수행 (1:AI·1:1에서는 해당 학생이 계속 답변).

### 5.3 하드 규칙 (반드시 탐지·제재)

| 규칙 | 위반 시 조치 |
|---|---|
| 근거는 **3가지** (주장 펼치기에서) | 3개 미만·초과 시 경고, 점수 반영 |
| 주장 다지기에 **새 근거 투입 금지** | 자동 탐지 후 감점 + 경고 메시지 |
| 거친말/욕설/비방 금지 | 즉시 감점 + 경고, 반복 시 세션 일시 정지 |
| 토론 주제 이탈 금지 | 경고 → 감점 → 일시 정지 3단계 |

---

## 6. 모드 아키텍처

### 6.1 최상위 흐름

```
[로그인/식별] → [모드 선택] → [수업 실행] → [보고서 출력]
```

교사가 수업 시작 시 학생들에게 **어떤 모드를 쓸지 구두 지시**한다. UI는 교사가 시키는 모드를 학생이 고를 수 있게만 하면 됨. 수업 전체가 이 도구 안에서 돌아감.

### 6.2 모드 분기

```
┌─ Prep 모드 (모든 세션의 초반 5분, 1인 AI 도우미) 
│  └─ 주제 선택 → 찬/반 결정 → 근거 3개 입력 → 출처 확인 → 토론 진입
│     * 이것은 별도 수업이 아니라 토론 세션의 일부
│
├─ 토론 모드 — 1:AI
│  ├─ 사용자 = 한 쪽 (찬성 또는 반대) — 3 slot 모두 담당
│  ├─ AI Opponent = 다른 쪽 — 3 slot 모두 담당
│  ├─ AI MC = 진행자
│  └─ AI Judge = 판정자
│
└─ 토론 모드 — 1:1 (QR 방 방식)
   ├─ 사용자 A = Host, 세션 생성 → QR 코드 발급
   ├─ 사용자 B = Guest, QR 스캔으로 입장
   ├─ 두 사람이 찬성/반대 선택 (교사 지시에 따라)
   ├─ AI MC = 진행자 (양쪽 화면에 동기화)
   └─ AI Judge = 판정자 (세션 종료 시 양쪽 화면에 결과)
```

`Prep`은 독립 모드가 아니라 토론 세션(1:AI 또는 1:1) 개시 전의 **웜업 단계**로 통합. 사용자에게 "Prep 모드 선택" 같은 화면은 보이지 않으며, 토론 모드를 고르면 자동으로 Prep 단계부터 시작된다.

### 6.3 모드별 차이 요약

| 항목 | 1:AI | 1:1 |
|---|---|---|
| 참여 인간 | 1 | 2 |
| AI Opponent 필요 | ✓ | ✗ |
| AI MC 필요 | ✓ | ✓ |
| AI Judge 필요 | ✓ | ✓ |
| 상태 동기화 (WebSocket) | ✗ | ✓ |
| QR 방 개설 | ✗ | ✓ |
| 보고서 생성 | ✓ | ✓ |
| Prep 단계 | ✓ (세션 내 포함) | ✓ (세션 내 포함) |

### 6.4 보고서 (모든 세션 종료 시)

**수신자**: 교사
**구성**:
1. 세션 메타데이터 (학생 이름/ID, 주제, 모드, 소요 시간)
2. 단계별 발화 요약 (각 phase마다 핵심 문장 2-3개)
3. 4축 루브릭 점수 표
4. 탐지된 규칙 위반 목록 (새 근거/욕설/주제이탈 이벤트 타임스탬프)
5. AI 판정자의 한 줄 총평 (2~3문장, 교사의 성찰 자료로만 사용됨)

**비-목표**: 이 보고서는 **성찰을 하지 않는다**. 교사가 성찰한다. AI는 raw material만 제공.

---

## 7. 상태 머신 (State Machine)

### 7.1 전체 상태 그래프 (1:AI, 1:1 공통)

```yaml
# debate_state_machine.yaml
session:
  initial: idle
  
  states:
    idle:
      on:
        START: orientation
    
    orientation:
      description: "주제·역할·규칙 안내 (2분)"
      duration_sec: 120
      on:
        TIMEOUT: phase_1_pro_1
        SKIP: phase_1_pro_1  # 교사가 스킵 가능
    
    phase_1_pro_1:
      description: "찬성1 주장 펼치기 (2분)"
      duration_sec: 120
      speaker: pro_1  # 1:AI mode에서 user 또는 AI
      expected_output:
        - claim: 1
        - grounds: 3
        - evidence_sources: 3
      on:
        TIMEOUT: phase_1_con_1
        COMPLETE: phase_1_con_1
    
    phase_1_con_1:
      description: "반대1 주장 펼치기 (2분)"
      duration_sec: 120
      speaker: con_1
      expected_output:
        - claim: 1
        - grounds: 3
        - evidence_sources: 3
      on:
        TIMEOUT: consultation_1
        COMPLETE: consultation_1
    
    consultation_1:
      description: "양팀 협의 (2분)"
      duration_sec: 120
      action: "양측 각자 반론·질문 메모 작성"
      on:
        TIMEOUT: phase_2_con_2_rebuttal
    
    phase_2_con_2_rebuttal:
      description: "반대2 반론+질문 (1분 30초)"
      duration_sec: 90
      speaker: con_2
      on:
        TIMEOUT: phase_2_pro_defense
        COMPLETE: phase_2_pro_defense
    
    phase_2_pro_defense:
      description: "찬성팀 반박+답변 (1분 30초)"
      duration_sec: 90
      speaker: pro_any  # 팀 전체 공동, 1:AI·1:1에서는 user
      on:
        TIMEOUT: phase_2_pro_2_rebuttal
        COMPLETE: phase_2_pro_2_rebuttal
        NO_RESPONSE_10S: reroute_prompt  # KR2 개입 이벤트
    
    phase_2_pro_2_rebuttal:
      description: "찬성2 반론+질문 (1분 30초)"
      duration_sec: 90
      speaker: pro_2
      on:
        TIMEOUT: phase_2_con_defense
        COMPLETE: phase_2_con_defense
    
    phase_2_con_defense:
      description: "반대팀 반박+답변 (1분 30초)"
      duration_sec: 90
      speaker: con_any
      on:
        TIMEOUT: consultation_2
        COMPLETE: consultation_2
        NO_RESPONSE_10S: reroute_prompt
    
    consultation_2:
      description: "양팀 주장 다지기 협의 (2분)"
      duration_sec: 120
      action: "핵심 근거 정리 + 장점 강조 전략 수립"
      on:
        TIMEOUT: phase_3_pro_3
    
    phase_3_con_3:
      description: "반대3 주장 다지기 (2분)"
      duration_sec: 120
      speaker: con_3
      constraints:
        - no_new_grounds: true  # 새 근거 투입 금지, 위반 시 감점
      on:
        TIMEOUT: phase_3_pro_3
        COMPLETE: phase_3_pro_3
    
    phase_3_pro_3:
      description: "찬성3 주장 다지기 (2분)"
      duration_sec: 120
      speaker: pro_3
      constraints:
        - no_new_grounds: true
      on:
        TIMEOUT: judging
        COMPLETE: judging
    
    judging:
      description: "AI 판정 실행 (30초 이내)"
      duration_sec: 30
      action: "judge_agent.evaluate(session_log)"
      on:
        COMPLETE: report_generation
    
    report_generation:
      description: "교사용 보고서 생성 + 학생에게 결과 표시"
      on:
        COMPLETE: ended
    
    ended:
      type: final
```

순서 주의: 위 YAML에서 `phase_3_con_3`가 `phase_3_pro_3`보다 먼저 와야 한다 (Canva 슬라이드 순서 = 반대3 → 찬성3). 구현 시 `consultation_2.on.TIMEOUT: phase_3_con_3`로 고칠 것.

### 7.2 전이 그래프 (시각화용)

```
idle → orientation → phase_1_pro_1 → phase_1_con_1 → consultation_1
     → phase_2_con_2_rebuttal → phase_2_pro_defense
     → phase_2_pro_2_rebuttal → phase_2_con_defense
     → consultation_2
     → phase_3_con_3 → phase_3_pro_3
     → judging → report_generation → ended
```

9개 main phase + 시작·종료 = 총 11 state.

---

## 8. AI 에이전트 설계

### 8.0 LLM 제공사 (학교 규정)

**모든 LLM 호출은 Google Gemini (AI Studio API)를 통한다.** Anthropic Claude, OpenAI GPT 등 다른 제공사 API는 런타임에 사용하지 않는다. Claude Code는 IDE 도구로만 쓰이고, 프로덕션 런타임에는 Google Gemini만 호출된다.

- API 엔드포인트: Google AI Studio (`generativelanguage.googleapis.com`)
- SDK: `google-genai` (Python) 또는 `@google/genai` (TypeScript)
- 인증: API Key (환경변수 `GEMINI_API_KEY`)
- Rate limit·비용 관리는 AI Studio 대시보드에서 모니터링

### 8.1 에이전트 구성

| 에이전트 | 역할 | 호출 시점 | 권장 모델 |
|---|---|---|---|
| **Prep Agent** | 사용자가 주제·근거·자료 준비 돕기 | Prep 단계 전체 | `gemini-2.5-flash` (대화형, 저지연) |
| **Opponent Agent** | AI가 상대팀으로 참여 | 1:AI 모드의 상대방 발화 phase | `gemini-2.5-flash` (turn-by-turn 응답) |
| **MC Agent** | 진행 통제 (시간, 규칙 경고, rerouting) | 모든 phase 전환 + 이벤트 트리거 | `gemini-2.5-flash-lite` (짧은 정형 발화) |
| **Judge Agent** | 루브릭 기반 채점 + 보고서 | judging state 진입 시 1회 호출 | `gemini-2.5-pro` (복합 추론, 세션당 1회라 비용 감당) |
| **Moderation Agent** | 욕설·비방·주제이탈 실시간 탐지 | 모든 사용자 입력 때마다 | `gemini-2.5-flash-lite` (빈번 호출, 짧은 분류) |

모델명은 AI Studio 콘솔의 현재 가용 라인업에 맞춰 업데이트. 빌드 착수 시점에 `gemini-2.5-*` 모델군이 없으면 `gemini-2.0-flash` 등 당시 상용 모델로 대체.

### 8.2 각 에이전트 시스템 프롬프트 스켈레톤

이 프롬프트는 **스켈레톤(골격)**이다. 실제 프로덕션 프롬프트는 Claude Code가 빌드하면서 Gemini의 응답 특성에 맞춰 fine-tune할 것. Gemini는 `systemInstruction` 파라미터로 시스템 프롬프트를 분리해 전달 가능하다.

#### 8.2.1 Prep Agent

```
당신은 초등 6학년 학생이 국어 토론 수업을 준비하도록 돕는 AI 도우미입니다.

[목표]
학생이 주제에 대해 찬성 또는 반대 입장을 정하고, 근거 3가지와 각 근거를 뒷받침하는 자료를 갖추도록 돕는 것.

[규칙]
1. 학생에게 답을 주지 말고 질문으로 유도하라. 소크라테스식 대화.
2. 학생이 근거를 만들면, "이 근거가 주장을 뒷받침하나요?" "조사 범위가 적절한가요?" "출처가 믿을 만한가요?"를 학생 스스로 점검하게 하라.
3. 학생이 출처를 명시하지 않으면, 기사·책·백과사전 형식에 맞춰 쓰는 법을 안내하라.
4. 초등 6학년 수준의 어휘를 사용하라.
5. 학생의 의견이 특정 정치·종교적 편향을 띨 경우, 중립적 재구성을 제안하라.

[출력 형식]
학생의 최종 준비물 = {주장, 근거[0], 근거[1], 근거[2], 자료[0], 자료[1], 자료[2]}
이 7개 필드가 다 채워지면 "준비 완료. 토론을 시작할 수 있어요." 메시지로 종료.
```

#### 8.2.2 Opponent Agent (1:AI 모드)

```
당신은 초등 6학년 토론 수업에서 학생의 상대팀 역할을 맡는 AI 토론자입니다.

[역할]
당신은 {pro | con} 입장을 고수합니다. 중간에 입장을 바꾸지 않습니다.

[난이도 설정]
- 언어 수준: 초등 6학년 수준 (전문 용어 피하기)
- 논리 강도: {easy | medium | hard} — 교사가 설정한 값을 따름
- 공격성: 중립 (지나치게 공격적이거나 유순하지 않음)

[단계별 행동]
- 주장 펼치기 단계: 주장 + 근거 3가지 + 각 근거의 출처를 명시적으로 제시
- 반론 단계: 상대(=학생) 근거의 논리적 허점을 찾아 질문 형식으로 반박
- 반박+답변 단계: 학생이 던진 질문에 방어. 약한 부분은 솔직히 인정하는 것도 허용
- 주장 다지기 단계: 핵심 근거 정리 + 우리편 장점 강조. **새 근거 투입 금지** (이미 제시한 근거만 재강조)

[하드 제약]
1. 거친말·비방·주제이탈 금지. 당신이 어기면 시스템에 의해 감점 처리됨.
2. 주어진 시간(1분 30초 또는 2분) 내에 답변을 완료할 것.
3. 학생의 언어 수준에 맞춰 답변할 것.

[입력]
- 토론 주제: {topic}
- 현재 phase: {phase_id}
- 세션 로그: {prior_turns}
- 학생의 직전 발화: {student_utterance}

[출력]
이 phase에서 당신이 할 발화 텍스트. 그 이상 아무것도 쓰지 말 것.
```

#### 8.2.3 MC Agent

```
당신은 초등 6학년 토론 수업의 사회자 AI입니다.

[역할]
1. 각 phase 전환 시, 다음 화자와 발언 시간을 안내
2. 10초간 무응답 발생 시 rerouting 메시지 송출 ("조금 더 생각해보시고, 나중에 답변해주셔도 됩니다")
3. 거친말·주제이탈 탐지 시 경고 메시지 송출
4. 주장 다지기 단계에서 새 근거가 투입되면 즉시 경고 ("주장 다지기 시간에는 새로운 근거를 제시하면 안 됩니다")

[말투]
- 정중하고 단호함. 초등학생에게 어울리는 친근함 유지.
- 학생이 기죽지 않도록 경고는 건조하게, 격려는 따뜻하게.

[출력]
상황에 맞는 1~2문장의 진행·경고·격려 메시지.
```

#### 8.2.4 Judge Agent

```
당신은 초등 6학년 토론 수업의 판정자 AI입니다. 감정이 아닌 루브릭에 근거해 판정합니다.

[입력]
전체 세션 로그 (모든 phase의 발화, 타임스탬프, 탐지된 이벤트)

[4축 루브릭] (각 축 0~3점)

A. 근거 타당성
 0 = 주장과 무관한 근거
 1 = 근거가 주장과 느슨하게 연결됨
 2 = 근거가 주장을 적절히 뒷받침함
 3 = 3가지 근거 모두 명시적이고 논리적으로 주장을 뒷받침

B. 자료 신뢰성
 0 = 출처 전혀 없음
 1 = 출처 있으나 불명확
 2 = 출처 명시 + 조사 범위 적절
 3 = 출처 + 범위 + 신뢰성 3요소 모두 충족

C. 반박 적절성
 0 = 반박 부재 또는 회피
 1 = 감정적·비논리적 반박
 2 = 상대 근거의 논리적 허점 지적
 3 = 날카로운 질문 + 근거 재반박

D. 규칙 준수
 0 = 새 근거 투입 또는 거친말 다수 + 주제 이탈
 1 = 경미한 규칙 이탈 1~2회
 2 = 규칙 준수
 3 = 규칙 준수 + 명시적 상대 존중 표현

[판정 절차]
1. 각 축별 점수를 학생(또는 찬성팀/반대팀)별로 산출
2. 축별 점수 합산 → 최종 총점
3. 탐지된 규칙 위반(이벤트) 목록을 축 D 점수에 반영
4. 총평 2~3문장 (교사 참고용, 성찰은 하지 않음)

[출력] (JSON 형식)
{
  "pro_score": {"A": 3, "B": 2, "C": 2, "D": 3, "total": 10},
  "con_score": {"A": 2, "B": 3, "C": 3, "D": 2, "total": 10},
  "events": [
    {"type": "new_evidence", "phase": "phase_3_pro_3", "timestamp": "..."},
    ...
  ],
  "summary": "...",
  "winner": "pro" | "con" | "tie"
}

[구현 노트 — Gemini structured output]
Gemini API의 `responseMimeType: "application/json"`와 `responseSchema` 파라미터를 사용해 JSON 출력을 강제한다. schema는 위 구조와 동일하게 작성. free-form 응답에서 JSON을 파싱하는 방식은 실패율이 높으니 피할 것.
```

#### 8.2.5 Moderation Agent

```
당신은 토론 발화에서 다음 3종 위반을 실시간 탐지합니다.

[탐지 대상]
1. 욕설·비방 (insult): 상대 인격 공격, 비하 표현, 욕설
2. 주제이탈 (off_topic): 토론 주제와 명백히 무관한 내용
3. 새 근거 투입 (new_evidence): 주장 다지기 단계에서 처음 등장하는 근거

[입력]
- 발화 텍스트
- 현재 phase_id
- 세션의 기존 근거 목록

[출력] (JSON)
{
  "violations": [
    {"type": "insult" | "off_topic" | "new_evidence", "severity": "low" | "medium" | "high"}
  ]
}
위반 없으면 빈 배열.

[구현 노트 — Gemini structured output]
Judge Agent와 마찬가지로 `responseMimeType: "application/json"` + `responseSchema` 사용.
호출 빈도가 매우 높으므로(매 발화마다) **반드시 `gemini-2.5-flash-lite`**를 쓰고 응답 길이를 제한할 것. 긴 추론 불필요.

[판단 기준]
- 초등 6학년 수준에서 부적절하면 insult. 어른 관점이 아닌 초등 관점.
- 주제와의 연관성을 2단계로 탐색 후에도 없으면 off_topic.
- new_evidence는 단어 단위 유사도가 아닌 의미 단위로 판단. 기존 근거의 바꿔 말하기는 허용.
```

### 8.3 에이전트 간 통신

```
[User Input or AI Opponent Output] 
    ↓
[Moderation Agent] → 위반 감지 시 → [MC Agent: 경고 발화] + [Judge Agent 로그에 이벤트 기록]
    ↓
[State Machine: phase 전환]
    ↓
[MC Agent: 다음 phase 안내]
    ↓
[User 또는 Opponent Agent: 다음 발화]
    ...
[Judging state 진입]
    ↓
[Judge Agent: 최종 채점]
    ↓
[Report Generator: 교사용 보고서]
```

---

## 9. 루브릭과 점수

### 9.1 4축 루브릭 (상세)

위 §8.2.4에 full text. 요약:

| 축 | 매핑된 학습지 항목 |
|---|---|
| A. 근거 타당성 | "근거가 주장을 뒷받침하나요?" |
| B. 자료 신뢰성 | "조사 범위가 적절한가요?" + "출처가 믿을 만한가요?" |
| C. 반박 적절성 | 슬라이드 "반론=토론의 꽃" + 판정단 "더 논리적인 팀" |
| D. 규칙 준수 | 슬라이드 "중요!! 새 근거 금지" + 활동지 "상대 존중 태도" |

### 9.2 점수 계산

- 팀(또는 사용자)별 총점 = A + B + C + D (0~12점)
- 축별 점수는 **발화 단계별 가중 평균**이 아니라 **전체 세션에 대한 단일 점수**
- 승패 판정: 총점 차 1점 이상이면 승자 결정, 0~1점 차이면 tie

### 9.3 이벤트-점수 연동

| 이벤트 | D축 감점 |
|---|---|
| new_evidence 1회 | -1 (최소 0까지) |
| insult 1회 | -1 |
| insult 2회 이상 | -2 (강제 bump to 0) |
| off_topic 1회 | -0.5 |
| off_topic 3회 이상 | D축 강제 0 |

---

## 10. 실시간 개입 규칙 (MC Intervention, KR2 핵심)

### 10.1 탐지 이벤트 4종

| 이벤트명 | 탐지 조건 | MC 대응 |
|---|---|---|
| `NO_RESPONSE_10S` | 해당 phase에서 10초간 텍스트 입력 없음 | "이 질문에 대해서는 조금 더 생각해보시고, 나중에 답변해주셔도 됩니다" + 다음 phase로 전이 |
| `OVERRUN` | 할당 시간 종료 | "시간이 다 되었습니다. 다음 단계로 넘어갑니다" + 강제 전이 |
| `RULE_VIOLATION` | Moderation Agent가 violation 반환 | 해당 위반 유형에 맞는 경고 + Judge Agent 로그 기록 |
| `EARLY_COMPLETE` | 사용자가 "끝" 명령 또는 시간 남았는데 입력 중단 | "더 이상 말씀하실 내용이 없으십니까? 그럼 다음 단계로 넘어가겠습니다" |

### 10.2 쏠림 방지 rerouting은 MVP에서 스킵
Canva 슬라이드에 나온 "한 명만 계속 답변 시 사회자가 재지정" 규칙은 **여러 명이 한 팀을 이루는 구조용**이고, 1:AI·1:1 모드에서는 팀당 인원이 1명이라 발동 조건이 없음. 향후 다자 토론 모드 추가 시 구현.

---

## 11. 감점·제재 엔진 (Penalty Engine)

### 11.1 3단계 제재

1. **1차 위반 (경고)**: MC Agent가 부드럽게 경고 발화 송출. 감점 없음 또는 미미.
2. **2차 위반 (감점)**: Judge Agent 로그에 이벤트 기록, 점수 차감.
3. **3차 위반 (일시 정지)**: 세션 일시 중단. 교사에게 알림 송출. 교사가 재개 여부 결정.

### 11.2 위반별 임계치

| 유형 | 1차 | 2차 | 3차 |
|---|---|---|---|
| insult | 감점 -1 | 감점 -2 | 일시 정지 |
| off_topic | 경고만 | 감점 -0.5 | 일시 정지 (누적 3회) |
| new_evidence | 감점 -1 즉시 | (해당 phase 내 반복 시) 감점 -2 | — |

### 11.3 교사 알림 채널
일시 정지 발생 시, 교사용 대시보드에 알림. 교사가 개입 또는 재개 명령. **교사는 모든 세션을 혼자 모니터링할 수 없으므로**, 알림은 **일시 정지 이벤트에만** 발생.

---

## 12. 데이터 모델 (최소 스키마)

```typescript
// types.ts (권고 스키마, 프레임워크 agnostic)

interface Session {
  id: string;
  mode: "prep" | "spar_1ai" | "spar_1v1";
  topic: string;
  pro_user_id: string | "ai";
  con_user_id: string | "ai";
  teacher_id: string;
  class_id: string;
  status: "idle" | "running" | "paused" | "completed";
  created_at: timestamp;
  current_state: string;  // state machine state
}

interface Turn {
  id: string;
  session_id: string;
  phase_id: string;  // e.g., "phase_1_pro_1"
  speaker: "pro" | "con" | "ai_opponent" | "ai_mc" | "ai_judge";
  speaker_user_id: string | null;
  utterance: string;
  timestamp: timestamp;
  duration_sec: number;
}

interface Event {
  id: string;
  session_id: string;
  turn_id: string | null;
  type: "violation_insult" | "violation_off_topic" | "violation_new_evidence"
      | "no_response_10s" | "overrun" | "early_complete" | "paused" | "resumed";
  severity: "low" | "medium" | "high";
  details: JSON;
  timestamp: timestamp;
}

interface Score {
  session_id: string;
  side: "pro" | "con";
  axis_A: 0 | 1 | 2 | 3;
  axis_B: 0 | 1 | 2 | 3;
  axis_C: 0 | 1 | 2 | 3;
  axis_D: 0 | 1 | 2 | 3;
  total: number;  // 0~12
  adjustments: JSON;  // event 기반 감점 기록
}

interface Report {
  session_id: string;
  generated_at: timestamp;
  summary_md: string;  // markdown
  pro_score: Score;
  con_score: Score;
  events: Event[];
  judge_comment: string;  // 2~3 문장
  winner: "pro" | "con" | "tie";
}
```

### 12.1 Persistent storage
v0 스코프에서는 **localStorage 또는 간단한 SQLite/Supabase** 가능. 교사가 학급 전체 보고서를 받아볼 수 있어야 하므로 서버 측 저장이 필수. 학생 개인정보는 저장하지 말 것 (이름만, 필요 최소).

---

## 13. UI/UX 요구사항

### 13.1 화면 목록

1. **홈/로그인** — 학생 식별 (이름 + 반 번호)
2. **모드 선택** — 1:AI / 1:1 (교사 지시 UI)
3. **Prep 단계 화면** — 대화형 채팅 UI (토론 세션 초반)
4. **1:AI 토론 화면** — 중앙에 현재 phase 배너, 타이머, 양쪽 발화 기록 영역
5. **1:1 QR 개설 화면** — 세션 host가 QR 생성, 반대편이 스캔
6. **1:1 QR 참여 화면** — Guest가 입장 후 찬/반 선택
7. **1:1 토론 화면** — 1:AI와 동일 레이아웃, 실시간 양방향 표시
8. **판정 결과 화면** — 4축 점수 + 총평
9. **교사 대시보드** — 모든 세션 목록, 일시 정지 알림, 보고서 다운로드

### 13.2 핵심 UI 요소

- **타이머**: 각 phase 남은 시간, 10초 미만 시 색상 변화 (빨강)
- **현재 phase 배너**: 상단에 크게 "📢 주장 펼치기 — 찬성 차례 (남은 시간 1:42)"
- **발언 기록**: 좌/우 분할, 찬성 파랑 / 반대 빨강 (Canva 슬라이드 색상 따름)
- **경고 배너**: 위반 탐지 시 화면 상단에 노란 배너 3초간
- **판정 결과**: 4축 별 막대 그래프 + 총점 원형 게이지

### 13.3 모바일 우선
학생 디바이스 혼재이므로 반응형 필수. 태블릿(iPad) 가로 모드에서도 구성 유지.

---

## 14. 기술 스택 권고 (Gemini 전용 스택)

### 14.1 JV의 현재 역량과 매치
JV의 Sparta Coding Club LLM AI Service Engineering + 모두의연구소 vibe coding 커리큘럼을 고려한 권고 스택:

- **프론트엔드**: Next.js + Tailwind + shadcn/ui (빠른 프로토타이핑)
- **백엔드**: FastAPI (JV가 이미 학습 중) + Pydantic
- **실시간 동기화 (1:1 모드)**: WebSocket (FastAPI native) 또는 Supabase Realtime
- **LLM API**: **Google Gemini via AI Studio (학교 규정)**
  - Python: `google-genai` 공식 SDK
  - TypeScript/Node: `@google/genai` 공식 SDK
  - 인증: 환경변수 `GEMINI_API_KEY` (AI Studio 콘솔에서 발급)
  - 다른 LLM 제공사 API 금지
- **DB**: Supabase (PostgreSQL) — Row Level Security로 학급·교사 권한 분리
- **배포**: Vercel (프론트) + Railway/Fly.io (백엔드)

### 14.2 Gemini 모델 매핑 (§8.1과 일관)

| 에이전트 | 권장 모델 | 호출 빈도 | 비용 관리 포인트 |
|---|---|---|---|
| Prep Agent | `gemini-2.5-flash` | 세션 초반 대화 | 히스토리 누적 제한 |
| Opponent Agent | `gemini-2.5-flash` | turn-by-turn | 컨텍스트 윈도우 관리 |
| MC Agent | `gemini-2.5-flash-lite` | phase 전환마다 | 짧은 정형 응답만 |
| Judge Agent | `gemini-2.5-pro` | 세션당 1회 | 고성능 모델 비용 감당 |
| Moderation Agent | `gemini-2.5-flash-lite` | 매 발화 | **비용 병목 1순위** |

### 14.3 Gemini 특유의 구현 규약

- **Structured output**: Judge·Moderation은 반드시 `responseMimeType: "application/json"` + `responseSchema`로 JSON 강제. free-form 파싱 금지.
- **System instruction**: 각 에이전트의 시스템 프롬프트는 Gemini의 `systemInstruction` 파라미터로 분리. `contents`에 섞지 말 것.
- **Safety settings**: 초등 교육용이므로 Google 기본 safety filter 유지. `HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE` 이상 설정 권고. 다만 토론 주제 중 일부(예: 동물 실험)는 safety filter가 과잉 차단할 수 있음 — 파일럿에서 점검.
- **Thinking 예산 (Gemini 2.5 계열)**: Judge는 추론 심화가 필요하므로 thinking 사용. MC·Moderation은 thinking 비활성화(빠른 응답 우선).
- **Streaming**: Opponent Agent는 streaming으로 받아 UX 반응성 확보. Judge는 전체 생성 후 일괄 반환.
- **Multimodal 불필요**: MVP는 텍스트 전용. Gemini의 이미지·오디오 입력 기능 사용 안 함.

### 14.4 회피할 것
- **Voice/STT**: v1 이후 (Gemini Live API 검토 후 별도 스코프로 분리)
- **복잡한 프레임워크 (예: LangChain full stack)**: MVP 스코프에 과잉
- **Vector DB, RAG**: 필요 없음. 근거·자료는 학생이 직접 입력
- **다른 LLM 제공사**: 위에 명시된 대로 금지 (학교 규정)

### 14.5 키·비밀 관리
- `GEMINI_API_KEY`는 서버 측 환경변수에만. 프론트엔드 번들에 절대 포함 금지.
- 학생 디바이스 → 프론트 → 백엔드 → Gemini 순서. 프론트가 Gemini를 직접 호출하는 구조 금지.
- 개발·스테이징·프로덕션용 키를 분리 발급 권장.

---

## 15. v0 Deliverables 체크리스트

빌드 완료 기준. Claude Code는 아래 항목을 차례로 완성하고 각각 verifiable output으로 체크.

- [ ] 상태 머신 구현 (§7.1 YAML 기반, 단위 테스트로 9 phase 전이 검증)
- [ ] Prep Agent 구현 + 대화형 UI (Prep 완료 시 {주장, 근거3, 자료3} JSON 출력)
- [ ] Opponent Agent 구현 (1:AI 모드용, phase별 발화 생성)
- [ ] MC Agent 구현 (phase 전환 + 경고 발화 + rerouting)
- [ ] Moderation Agent 구현 (3종 위반 탐지, 라벨링된 샘플 20개로 테스트)
- [ ] Judge Agent 구현 (루브릭 채점 + 보고서 JSON 출력)
- [ ] 1:AI 토론 화면 완성 + end-to-end 통합 테스트
- [ ] 1:1 QR 방 개설 + WebSocket 동기화 구현
- [ ] 1:1 토론 화면 완성 + end-to-end 통합 테스트
- [ ] 교사 대시보드 + 보고서 markdown 다운로드
- [ ] 감점·제재 엔진 통합 (§11.2 임계치대로)
- [ ] **파일럿 세션 1회** — JV가 직접 1:AI 모드로 1세션 완주, KR1~KR5 측정

---

## 16. OUT of Scope (건드리지 말 것)

- **음성(STT) 입력** — v1 이후
- **다자 토론 (2:2, 3:3 등 팀당 복수 학생)** — v1 이후
- **태도 평가 (목소리/발음/속도)** — STT 선행 필요
- **2e/영재 특화 기능** — JV의 박사 연구와 분리
- **세특·생기부 자동 작성** — 성찰은 교사 역할
- **외부 팩트체크 (학생 제출 자료 검증)** — v1 이후
- **AIDT(AI 디지털교과서) 연동** — 정책 성숙 대기
- **다국어 지원** — v2 이후 (Canada PR 이후 영어 시장은 별도 검토)

---

## 17. 권장 빌드 순서 (Claude Code 작업 분할 제안)

### Sprint 1 (1주) — Core State Machine + Prep
1. 상태 머신 구현 + 단위 테스트
2. Prep Agent + 대화 UI
3. 데이터 모델 + DB 스키마

### Sprint 2 (1주) — 1:AI 모드
4. Opponent Agent + prompt tuning
5. MC Agent + 기본 rerouting
6. 1:AI 토론 화면 end-to-end

### Sprint 3 (1주) — Judge + 감점
7. Judge Agent + 4축 채점 검증
8. Moderation Agent + 위반 탐지 검증
9. 감점·제재 엔진 통합

### Sprint 4 (1주) — 1:1 모드 + 보고서
10. 1:1 QR 방 개설 + WebSocket
11. 1:1 토론 화면
12. 교사 보고서 + 대시보드

### Sprint 5 (0.5주) — 파일럿 + 튜닝
13. JV가 직접 파일럿 세션
14. KR 측정 + 회귀 버그 수정
15. 학생 2~3명 pilot (선택)

**총 4.5주 예상**. JV의 수업·대학원·바이브코딩 커리큘럼 병행을 감안해 Sprint 당 10~15시간 기준.

---

## 18. 파일럿 성공 기준 (이 시점에 v0 완료 선언)

- JV 본인이 1:AI 모드로 찬성 측 1회, 반대 측 1회 완주
- KR1 (진행 완주율) = 1.0 달성
- KR3 (루브릭 정합성) = 1.0 달성
- KR2, KR4는 샘플이 적어 신뢰도 대신 **sanity check**만 (축 0~3점이 말이 되는지)
- 교사 1인(JV)의 실시간 개입 = 0 (이상적), ≤ 2분 (수용)
- 보고서 생성까지 세션 종료 후 60초 이내

모두 달성 시 v0 완료. 그렇지 않으면 실패 지점 디버깅 후 재측정.

---

## 19. 오픈 질문 (Claude Code가 JV에게 확인할 것)

구현 중 아래 항목은 JV의 현장 감각이 필요함. Claude Code는 임의 결정하지 말고 질문할 것.

1. 1:1 모드에서 두 학생이 같은 교실에 있을 때 물리적 간섭 (목소리 들림)을 어떻게 막을지?
2. 주제 풀(pool)은 Canva 슬라이드의 14개로 고정? 아니면 교사가 추가 가능?
3. 1:AI 모드에서 AI Opponent의 난이도를 학생이 스스로 고를 수 있게 할지, 교사만 설정할지?
4. 보고서 출력 형식: markdown 다운로드만? 아니면 docx 지원?
5. 세션 중단 시 복구 기능 필요? (네트워크 장애 등)
6. **Gemini API 키 관리 주체**: JV 개인 키로 개발·운영? 아니면 학교/교육청 차원의 키 발급 절차 필요? 후자라면 MVP 단계에서는 개인 키로 진행하되, 실제 교실 배포 전에 행정 승인 프로세스 별도 필요.
7. **학생 발화 데이터 저장 정책**: Gemini API로 전송되는 학생 입력은 Google의 데이터 사용 정책 영향권에 들어감. AI Studio 무료 티어와 유료 티어의 데이터 보존 정책이 다름 — 파일럿 전 JV가 학교·학부모 동의 수준을 확인할 것.
8. **모델 가용성 확인 시점**: 빌드 착수 당일 AI Studio 콘솔에서 `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`의 실제 가용 여부와 정확한 모델 ID 확인 후 §8.1, §14.2에 기록된 모델명을 갱신할 것.

---

## 20. 부록: Canva 슬라이드 원문 요점

토론의 절차 슬라이드(Canva)에서 발췌한 구조 (§5.1과 일치 확인):

- **1단계 주장 펼치기** (각 2분): 찬성1 → 반대1 (주장+근거+근거자료)
- **2분 협의**
- **2단계 반론** (각 1분 30초): 반대2(반론+질문) → 찬성(반박+답변), 찬성2(반론+질문) → 반대(반박+답변)
- **2분 협의**
- **3단계 주장 다지기** (각 2분): 반대3 → 찬성3 (핵심근거 정리 + 우리편 주장 장점 강조)

사회자 역할, 반론에서 기억할 점, 결론에서 기억할 점, 판정단의 역할은 각각 §8.2.3, §10, §8.2.4에 반영됨.

---

**END OF SPEC v0.1**

다음 버전(v0.2)은 Claude Code의 Sprint 1 완료 후 실제 빌드 경험을 반영해 업데이트한다.
