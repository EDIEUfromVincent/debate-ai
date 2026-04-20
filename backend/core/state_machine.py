"""
§7.1 debate state machine.
States: 14 (idle → ended)
Events: START, TIMEOUT, SKIP, COMPLETE, NO_RESPONSE_10S, EARLY_COMPLETE
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any


class State(str, Enum):
    IDLE                    = "idle"
    ORIENTATION             = "orientation"
    PHASE_1_PRO_1           = "phase_1_pro_1"
    PHASE_1_CON_1           = "phase_1_con_1"
    CONSULTATION_1          = "consultation_1"
    PHASE_2_CON_2_REBUTTAL  = "phase_2_con_2_rebuttal"
    PHASE_2_PRO_DEFENSE     = "phase_2_pro_defense"
    PHASE_2_PRO_2_REBUTTAL  = "phase_2_pro_2_rebuttal"
    PHASE_2_CON_DEFENSE     = "phase_2_con_defense"
    CONSULTATION_2          = "consultation_2"
    PHASE_3_CON_3           = "phase_3_con_3"
    PHASE_3_PRO_3           = "phase_3_pro_3"
    JUDGING                 = "judging"
    REPORT_GENERATION       = "report_generation"
    ENDED                   = "ended"


class Event(str, Enum):
    START           = "START"
    TIMEOUT         = "TIMEOUT"
    SKIP            = "SKIP"
    COMPLETE        = "COMPLETE"
    NO_RESPONSE_10S = "NO_RESPONSE_10S"
    EARLY_COMPLETE  = "EARLY_COMPLETE"


class InvalidTransitionError(Exception):
    pass


# ── 전이 테이블 ───────────────────────────────────────────────────────────────
# { State: { Event: next_State | None } }
# None = NO_RESPONSE_10S 처리 (상태 유지 + reroute_pending=True)
_TRANSITIONS: dict[State, dict[Event, State | None]] = {
    State.IDLE: {
        Event.START: State.ORIENTATION,
    },
    State.ORIENTATION: {
        Event.TIMEOUT:  State.PHASE_1_PRO_1,
        Event.SKIP:     State.PHASE_1_PRO_1,
        Event.COMPLETE: State.PHASE_1_PRO_1,
    },
    State.PHASE_1_PRO_1: {
        Event.TIMEOUT:  State.PHASE_1_CON_1,
        Event.COMPLETE: State.PHASE_1_CON_1,
    },
    State.PHASE_1_CON_1: {
        Event.TIMEOUT:  State.CONSULTATION_1,
        Event.COMPLETE: State.CONSULTATION_1,
    },
    State.CONSULTATION_1: {
        Event.TIMEOUT: State.PHASE_2_CON_2_REBUTTAL,
    },
    State.PHASE_2_CON_2_REBUTTAL: {
        Event.TIMEOUT:  State.PHASE_2_PRO_DEFENSE,
        Event.COMPLETE: State.PHASE_2_PRO_DEFENSE,
        Event.SKIP:     State.PHASE_3_CON_3,   # 정리로 바로 이동
    },
    State.PHASE_2_PRO_DEFENSE: {
        Event.TIMEOUT:          State.PHASE_2_PRO_2_REBUTTAL,
        Event.COMPLETE:         State.PHASE_2_PRO_2_REBUTTAL,
        Event.NO_RESPONSE_10S:  None,
        Event.EARLY_COMPLETE:   State.PHASE_2_PRO_2_REBUTTAL,
        Event.SKIP:             State.PHASE_3_CON_3,
    },
    State.PHASE_2_PRO_2_REBUTTAL: {
        Event.TIMEOUT:  State.PHASE_2_CON_DEFENSE,
        Event.COMPLETE: State.PHASE_2_CON_DEFENSE,
        Event.SKIP:     State.PHASE_3_CON_3,
    },
    State.PHASE_2_CON_DEFENSE: {
        Event.TIMEOUT:          State.CONSULTATION_2,
        Event.COMPLETE:         State.CONSULTATION_2,
        Event.NO_RESPONSE_10S:  None,
        Event.EARLY_COMPLETE:   State.CONSULTATION_2,
        Event.SKIP:             State.PHASE_3_CON_3,
    },
    State.CONSULTATION_2: {
        Event.TIMEOUT: State.PHASE_3_CON_3,
    },
    State.PHASE_3_CON_3: {
        Event.TIMEOUT:  State.PHASE_3_PRO_3,
        Event.COMPLETE: State.PHASE_3_PRO_3,
    },
    State.PHASE_3_PRO_3: {
        Event.TIMEOUT:  State.JUDGING,
        Event.COMPLETE: State.JUDGING,
    },
    # JUDGING·REPORT_GENERATION은 COMPLETE만 (§7.1 action 전용 state)
    State.JUDGING: {
        Event.COMPLETE: State.REPORT_GENERATION,
    },
    State.REPORT_GENERATION: {
        Event.COMPLETE: State.ENDED,
    },
    State.ENDED: {},
}

# ── 메타데이터 ────────────────────────────────────────────────────────────────
_DURATION_SEC: dict[State, int] = {
    State.ORIENTATION:              120,
    State.PHASE_1_PRO_1:            120,
    State.PHASE_1_CON_1:            120,
    State.CONSULTATION_1:           120,
    State.PHASE_2_CON_2_REBUTTAL:    90,
    State.PHASE_2_PRO_DEFENSE:       90,
    State.PHASE_2_PRO_2_REBUTTAL:    90,
    State.PHASE_2_CON_DEFENSE:       90,
    State.CONSULTATION_2:           120,
    State.PHASE_3_CON_3:            120,
    State.PHASE_3_PRO_3:            120,
    State.JUDGING:                   30,
}

_CONSTRAINTS: dict[State, dict[str, Any]] = {
    State.PHASE_3_CON_3: {"no_new_grounds": True},
    State.PHASE_3_PRO_3: {"no_new_grounds": True},
}


# ── 상태 머신 ─────────────────────────────────────────────────────────────────
class DebateStateMachine:
    def __init__(self) -> None:
        self.current: State = State.IDLE
        self.reroute_pending: bool = False
        self.history: list[dict[str, Any]] = []

    def send(self, event: Event) -> State:
        table = _TRANSITIONS.get(self.current, {})

        if event not in table:
            raise InvalidTransitionError(
                f"Event {event!r} is not valid in state {self.current!r}"
            )

        next_state = table[event]

        if next_state is None:
            # NO_RESPONSE_10S: 상태 유지, 플래그만 세팅
            self.reroute_pending = True
        else:
            self.reroute_pending = False
            self.history.append({
                "from":      self.current,
                "to":        next_state,
                "event":     event,
                "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            })
            self.current = next_state

        return self.current

    def is_finished(self) -> bool:
        return self.current == State.ENDED

    def duration_of(self, state: State) -> int:
        return _DURATION_SEC[state]

    def constraints_of(self, state: State) -> dict[str, Any]:
        return _CONSTRAINTS.get(state, {})
