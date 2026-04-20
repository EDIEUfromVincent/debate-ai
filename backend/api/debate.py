"""
토론 세션 API.

POST /api/debate/start   — 세션 생성, orientation MC 메시지 반환
POST /api/debate/turn    — 학생 발화 처리
POST /api/debate/timeout — 클라이언트 타이머 만료
POST /api/debate/ack     — AI 발화 확인(읽기 완료) → 보류된 state 전이 실행
GET  /api/debate/{id}    — 현재 세션 상태 조회
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.mc_agent import MCAgent, MCEvent
from agents.moderation_agent import ModerationAgent
from agents.opponent_agent import OpponentAgent
from agents.judge_agent import JudgeAgent
from core.state_machine import DebateStateMachine, Event, InvalidTransitionError, State

router = APIRouter()

_mc         = MCAgent()
_moderation = ModerationAgent()
_judge      = JudgeAgent()

_sessions: dict[str, "SessionState"] = {}


# ── 세션 상태 ─────────────────────────────────────────────────────────────────
class SessionState:
    def __init__(self, session_id: str, topic: str, student_side: str, difficulty: str, mode: str = "ai"):
        self.session_id        = session_id
        self.topic             = topic
        self.student_side      = student_side       # "pro" | "con"  (1v1에선 host side)
        self.ai_side           = "con" if student_side == "pro" else "pro"
        self.mode              = mode               # "ai" | "1v1"
        self.sm                = DebateStateMachine()
        self.turns:  list[dict[str, Any]] = []
        self.events: list[dict[str, Any]] = []
        self.opponent          = OpponentAgent(
            stance=("반대" if self.ai_side == "con" else "찬성"),
            difficulty=difficulty,
        )
        self.judge_result: dict[str, Any] | None = None
        self.pending_transition: bool = False       # AI 발화 후 ack 대기
        self.guest_joined: bool = False             # 1v1: 게스트 접속 여부
        self.ready_sides: set[str] = set()          # 1v1: 준비 완료한 측
        self.prep_done_sides: set[str] = set()      # 1v1: prep 완료한 측

    def add_turn(self, phase_id: str, speaker: str, text: str) -> None:
        self.turns.append({"phase": phase_id, "speaker": speaker, "text": text})

    def add_event(self, etype: str, phase: str, side: str, severity: str = "medium") -> None:
        self.events.append({"type": etype, "phase": phase, "side": side, "severity": severity})


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────
_SPEAKER_MAP: dict[State, str] = {
    State.ORIENTATION:              "mc",
    State.PHASE_1_PRO_1:            "pro",
    State.PHASE_1_CON_1:            "con",
    State.CONSULTATION_1:           "both",
    State.PHASE_2_CON_2_REBUTTAL:   "con",
    State.PHASE_2_PRO_DEFENSE:      "pro",
    State.PHASE_2_PRO_2_REBUTTAL:   "pro",
    State.PHASE_2_CON_DEFENSE:      "con",
    State.CONSULTATION_2:           "both",
    State.PHASE_3_CON_3:            "con",
    State.PHASE_3_PRO_3:            "pro",
    State.JUDGING:                  "ai_judge",
    State.REPORT_GENERATION:        "ai_judge",
}

_CONSULTATION = {State.CONSULTATION_1, State.CONSULTATION_2}


def _is_student_turn(sess: SessionState, player_side: str | None = None) -> bool:
    if sess.pending_transition:
        return False
    expected = _SPEAKER_MAP.get(sess.sm.current)
    if sess.mode == "1v1":
        side = player_side or sess.student_side
        return expected in (side, "both")
    return expected in (sess.student_side, "both")


def _is_ai_opponent_turn(sess: SessionState) -> bool:
    if sess.mode == "1v1":
        return False
    expected = _SPEAKER_MAP.get(sess.sm.current)
    return expected == sess.ai_side


def _phase_id(sess: SessionState) -> str:
    return sess.sm.current.value


def _safe_duration(sess: SessionState) -> int | None:
    try:
        return sess.sm.duration_of(sess.sm.current) if not sess.sm.is_finished() else None
    except KeyError:
        return None


# ── AI 자동 발화 ──────────────────────────────────────────────────────────────
def _run_ai_turns(sess: SessionState) -> list[dict[str, Any]]:
    """
    AI Opponent 발화가 필요하면 생성 후 pending_transition=True로 멈춘다.
    협의 단계와 JUDGING은 즉시 자동 처리.
    """
    messages: list[dict[str, Any]] = []

    while True:
        state = sess.sm.current

        if state == State.JUDGING:
            result = _judge.evaluate(sess.topic, sess.turns, sess.events)
            sess.judge_result = result
            sess.sm.send(Event.COMPLETE)   # → report_generation
            sess.sm.send(Event.COMPLETE)   # → ended
            messages.append({"type": "judge", "data": result})
            break

        if state in (State.ENDED, State.REPORT_GENERATION):
            break

        if _is_ai_opponent_turn(sess):
            student_turns = [t for t in sess.turns if t["speaker"] == sess.student_side]
            phase_now = _phase_id(sess)
            if "phase_3" in phase_now:
                # 주장 다지기: 자기 근거 정리만 — 학생 발화 전달 안 함
                last_student = ""
            elif "pro_2_rebuttal" in phase_now or "con_2_rebuttal" in phase_now:
                # AI가 학생의 phase_1 주장을 반박 → phase_1 발화 사용
                phase1_key = "con_1" if sess.student_side == "con" else "pro_1"
                phase1_turns = [t for t in sess.turns if t["speaker"] == sess.student_side and phase1_key in t.get("phase", "")]
                last_student = phase1_turns[-1]["text"] if phase1_turns else (student_turns[-1]["text"] if student_turns else "")
            else:
                last_student = student_turns[-1]["text"] if student_turns else ""
            text = sess.opponent.speak(
                phase_id=_phase_id(sess),
                topic=sess.topic,
                prior_turns=sess.turns,
                student_last=last_student,
            )
            sess.add_turn(_phase_id(sess), sess.ai_side, text)
            messages.append({
                "type":    "opponent",
                "speaker": sess.ai_side,
                "text":    text,
                "phase":   _phase_id(sess),
            })
            # state 전이 보류 → ack 대기
            sess.pending_transition = True
            break

        if state in _CONSULTATION:
            mc_msg = _mc.announce(MCEvent.PHASE_START, phase_id=_phase_id(sess))
            messages.append({"type": "mc", "text": mc_msg, "phase": _phase_id(sess)})
            sess.sm.send(Event.TIMEOUT)
            mc_next = _mc.announce(MCEvent.PHASE_START, phase_id=_phase_id(sess))
            messages.append({"type": "mc", "text": mc_next, "phase": _phase_id(sess)})
            continue  # 협의 후 다음 phase(AI 반론 등) 즉시 처리

        break

    return messages


def _build_turn_response(
    sess: SessionState,
    violations: list[dict[str, Any]],
    mc_message: str | None,
    ai_messages: list[dict[str, Any]],
    student_input_recorded: bool = True,
) -> "TurnResponse":
    return TurnResponse(
        phase=_phase_id(sess),
        is_student_turn=_is_student_turn(sess),
        student_input_recorded=student_input_recorded,
        violations=violations,
        mc_message=mc_message,
        ai_messages=ai_messages,
        judge_result=sess.judge_result,
        ended=sess.sm.is_finished(),
        awaiting_ack=sess.pending_transition,
        duration_sec=_safe_duration(sess),
    )


# ── Request / Response 모델 ──────────────────────────────────────────────────
class StartRequest(BaseModel):
    topic: str
    student_side: str = "pro"
    difficulty:   str = "medium"
    mode:         str = "ai"


class StartResponse(BaseModel):
    session_id:   str
    phase:        str
    mc_message:   str
    duration_sec: int
    mode:         str


class TurnRequest(BaseModel):
    session_id:    str
    student_input: str
    player_side:   str | None = None   # 1v1 모드에서 발화자 측 명시


class TurnResponse(BaseModel):
    phase:                  str
    is_student_turn:        bool
    student_input_recorded: bool
    violations:             list[dict[str, Any]]
    mc_message:             str | None
    ai_messages:            list[dict[str, Any]]
    judge_result:           dict[str, Any] | None
    ended:                  bool
    awaiting_ack:           bool          # True면 UI가 "다음" 버튼 표시
    duration_sec:           int | None


class AckRequest(BaseModel):
    session_id: str


class TimeoutRequest(BaseModel):
    session_id: str


# ── 엔드포인트 ────────────────────────────────────────────────────────────────
@router.post("/debate/start", response_model=StartResponse)
async def debate_start(req: StartRequest) -> StartResponse:
    session_id = str(uuid.uuid4())
    sess = SessionState(session_id, req.topic, req.student_side, req.difficulty, req.mode)
    _sessions[session_id] = sess

    sess.sm.send(Event.START)
    mc_msg = _mc.announce(MCEvent.PHASE_START, phase_id="orientation")

    return StartResponse(
        session_id=session_id,
        phase=_phase_id(sess),
        mc_message=mc_msg,
        duration_sec=sess.sm.duration_of(sess.sm.current),
        mode=sess.mode,
    )


@router.post("/debate/turn", response_model=TurnResponse)
async def debate_turn(req: TurnRequest) -> TurnResponse:
    sess = _sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess.sm.is_finished():
        raise HTTPException(status_code=400, detail="Session already ended")
    if sess.pending_transition:
        raise HTTPException(status_code=400, detail="Waiting for ack before next turn")

    player_side = req.player_side if sess.mode == "1v1" else sess.student_side
    if not _is_student_turn(sess, player_side):
        raise HTTPException(status_code=400, detail="Not student's turn")

    phase = _phase_id(sess)
    acting_side = player_side or sess.student_side

    # 1. Moderation
    grounds_so_far = [t["text"] for t in sess.turns if t["speaker"] == acting_side]
    mod_result = _moderation.check(req.student_input, phase, grounds_so_far)
    violations  = mod_result.get("violations", [])
    mc_warning: str | None = None
    for v in violations:
        sess.add_event(v["type"], phase, sess.student_side, v.get("severity", "medium"))
        mc_warning = _mc.announce(MCEvent.VIOLATION, phase_id=phase, violation_type=v["type"])

    # 2. 학생 발화 기록 + state 전이
    sess.add_turn(phase, acting_side, req.student_input)
    try:
        sess.sm.send(Event.COMPLETE)
    except InvalidTransitionError:
        pass

    # 3. AI 자동 처리
    ai_messages = _run_ai_turns(sess)

    # 4. MC 안내 (pending 없을 때만)
    mc_next: str | None = mc_warning
    if not mc_warning and not sess.sm.is_finished() and not sess.pending_transition:
        mc_next = _mc.announce(MCEvent.PHASE_START, phase_id=_phase_id(sess))

    return _build_turn_response(sess, violations, mc_next, ai_messages)


@router.post("/debate/ack", response_model=TurnResponse)
async def debate_ack(req: AckRequest) -> TurnResponse:
    """학생이 AI 발화를 읽고 '다음' 버튼을 눌렀을 때 호출."""
    sess = _sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if not sess.pending_transition:
        raise HTTPException(status_code=400, detail="No pending transition")

    # 보류된 전이 실행
    sess.pending_transition = False
    try:
        sess.sm.send(Event.COMPLETE)
    except InvalidTransitionError:
        pass

    # 전이 후 또 AI 차례면 재귀적으로 처리
    ai_messages = _run_ai_turns(sess)

    mc_next: str | None = None
    if not sess.sm.is_finished() and not sess.pending_transition:
        mc_next = _mc.announce(MCEvent.PHASE_START, phase_id=_phase_id(sess))

    return _build_turn_response(sess, [], mc_next, ai_messages)


@router.post("/debate/timeout")
async def debate_timeout(req: TimeoutRequest) -> TurnResponse:
    sess = _sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess.sm.is_finished():
        return _build_turn_response(sess, [], None, [], False)

    # pending 중에 timeout이 오면 먼저 ack 처리
    if sess.pending_transition:
        sess.pending_transition = False
        try:
            sess.sm.send(Event.COMPLETE)
        except InvalidTransitionError:
            pass

    try:
        sess.sm.send(Event.TIMEOUT)
    except InvalidTransitionError:
        pass

    ai_messages = _run_ai_turns(sess)
    mc_next: str | None = None
    if not sess.sm.is_finished() and not sess.pending_transition:
        mc_next = _mc.announce(MCEvent.PHASE_START, phase_id=_phase_id(sess))

    return _build_turn_response(sess, [], mc_next, ai_messages, False)


class SkipRequest(BaseModel):
    session_id: str


@router.post("/debate/skip-rebuttal")
async def debate_skip_rebuttal(req: SkipRequest) -> TurnResponse:
    """반론 단계에서 주장 다지기로 바로 이동."""
    sess = _sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    if sess.pending_transition:
        sess.pending_transition = False
        try:
            sess.sm.send(Event.COMPLETE)
        except InvalidTransitionError:
            pass

    try:
        sess.sm.send(Event.SKIP)
    except InvalidTransitionError:
        raise HTTPException(status_code=400, detail="Cannot skip from current state")

    ai_messages = _run_ai_turns(sess)
    mc_next: str | None = None
    if not sess.sm.is_finished() and not sess.pending_transition:
        mc_next = _mc.announce(MCEvent.PHASE_START, phase_id=_phase_id(sess))

    return _build_turn_response(sess, [], mc_next, ai_messages)


class JoinRequest(BaseModel):
    session_id: str
    side: str   # "pro" | "con"


@router.post("/debate/join")
async def debate_join(req: JoinRequest) -> dict[str, Any]:
    sess = _sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    sess.guest_joined = True
    return {"ok": True}


@router.post("/debate/prep-done")
async def debate_prep_done(req: JoinRequest) -> dict[str, Any]:
    sess = _sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    sess.prep_done_sides.add(req.side)
    both = len(sess.prep_done_sides) >= 2
    return {"ok": True, "both_prep_done": both, "prep_done_sides": list(sess.prep_done_sides)}


@router.post("/debate/ready")
async def debate_ready(req: JoinRequest) -> dict[str, Any]:
    sess = _sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    sess.ready_sides.add(req.side)
    both_ready = len(sess.ready_sides) >= 2
    return {"ok": True, "both_ready": both_ready}


@router.get("/debate/{session_id}")
async def debate_status(session_id: str) -> dict[str, Any]:
    sess = _sessions.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    state = _SPEAKER_MAP.get(sess.sm.current)
    return {
        "session_id":      sess.session_id,
        "topic":           sess.topic,
        "mode":            sess.mode,
        "phase":           _phase_id(sess),
        "current_speaker": state,          # "pro"|"con"|"both"|"mc"|"ai_judge"
        "student_side":    sess.student_side,
        "awaiting_ack":    sess.pending_transition,
        "turns":           sess.turns,
        "turns_count":     len(sess.turns),
        "ended":           sess.sm.is_finished(),
        "judge_result":    sess.judge_result,
        "duration_sec":    _safe_duration(sess),
        "guest_joined":     sess.guest_joined,
        "ready_sides":      list(sess.ready_sides),
        "both_ready":       len(sess.ready_sides) >= 2,
        "prep_done_sides":  list(sess.prep_done_sides),
        "both_prep_done":   len(sess.prep_done_sides) >= 2,
    }
