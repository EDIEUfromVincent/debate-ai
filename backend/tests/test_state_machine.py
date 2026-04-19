"""
State machine unit tests — RED phase.
§7.1 기준: 14 states, 9 main phases, 전이 이벤트 검증.
"""
import pytest
from core.state_machine import DebateStateMachine, State, Event, InvalidTransitionError


# ── 상태 순서 (§7.1, §7.2) ──────────────────────────────────────────────────
FULL_PATH = [
    State.IDLE,
    State.ORIENTATION,
    State.PHASE_1_PRO_1,
    State.PHASE_1_CON_1,
    State.CONSULTATION_1,
    State.PHASE_2_CON_2_REBUTTAL,
    State.PHASE_2_PRO_DEFENSE,
    State.PHASE_2_PRO_2_REBUTTAL,
    State.PHASE_2_CON_DEFENSE,
    State.CONSULTATION_2,
    State.PHASE_3_CON_3,
    State.PHASE_3_PRO_3,
    State.JUDGING,
    State.REPORT_GENERATION,
    State.ENDED,
]


# ── 초기 상태 ─────────────────────────────────────────────────────────────────
class TestInitialState:
    def test_starts_at_idle(self):
        sm = DebateStateMachine()
        assert sm.current == State.IDLE

    def test_is_not_finished_at_start(self):
        sm = DebateStateMachine()
        assert not sm.is_finished()


# ── 정상 전이: HAPPY PATH ────────────────────────────────────────────────────
class TestHappyPath:
    """COMPLETE 또는 TIMEOUT 이벤트로 처음부터 끝까지 완주."""

    def test_start_moves_to_orientation(self):
        sm = DebateStateMachine()
        sm.send(Event.START)
        assert sm.current == State.ORIENTATION

    def test_orientation_timeout_to_phase_1_pro_1(self):
        sm = DebateStateMachine()
        sm.send(Event.START)
        sm.send(Event.TIMEOUT)
        assert sm.current == State.PHASE_1_PRO_1

    def test_orientation_skip_to_phase_1_pro_1(self):
        """교사 SKIP 허용 (§7.1)."""
        sm = DebateStateMachine()
        sm.send(Event.START)
        sm.send(Event.SKIP)
        assert sm.current == State.PHASE_1_PRO_1

    def test_full_path_via_complete(self):
        """9 main phase를 COMPLETE로 전부 통과 → ENDED."""
        sm = DebateStateMachine()
        sm.send(Event.START)          # idle → orientation
        sm.send(Event.COMPLETE)       # orientation → phase_1_pro_1 (COMPLETE도 허용)
        sm.send(Event.COMPLETE)       # → phase_1_con_1
        sm.send(Event.TIMEOUT)        # → consultation_1
        sm.send(Event.TIMEOUT)        # → phase_2_con_2_rebuttal
        sm.send(Event.COMPLETE)       # → phase_2_pro_defense
        sm.send(Event.COMPLETE)       # → phase_2_pro_2_rebuttal
        sm.send(Event.COMPLETE)       # → phase_2_con_defense
        sm.send(Event.TIMEOUT)        # → consultation_2
        sm.send(Event.TIMEOUT)        # → phase_3_con_3
        sm.send(Event.COMPLETE)       # → phase_3_pro_3
        sm.send(Event.COMPLETE)       # → judging
        sm.send(Event.COMPLETE)       # → report_generation
        sm.send(Event.COMPLETE)       # → ended
        assert sm.current == State.ENDED
        assert sm.is_finished()

    def test_full_path_via_timeout(self):
        """§7.1: JUDGING·REPORT_GENERATION은 TIMEOUT 없음, COMPLETE만 허용."""
        sm = DebateStateMachine()
        complete_only = {State.JUDGING, State.REPORT_GENERATION}
        for _ in range(len(FULL_PATH) - 1):
            if sm.current == State.IDLE:
                sm.send(Event.START)
            elif sm.current in complete_only:
                sm.send(Event.COMPLETE)
            else:
                sm.send(Event.TIMEOUT)
        assert sm.current == State.ENDED

    def test_phase_order_con3_before_pro3(self):
        """§7.1 순서 주의: phase_3_con_3 → phase_3_pro_3 (반대3 먼저)."""
        sm = DebateStateMachine()
        sm.send(Event.START)
        sm.send(Event.TIMEOUT)  # orientation → phase_1_pro_1
        sm.send(Event.TIMEOUT)  # → phase_1_con_1
        sm.send(Event.TIMEOUT)  # → consultation_1
        sm.send(Event.TIMEOUT)  # → phase_2_con_2_rebuttal
        sm.send(Event.TIMEOUT)  # → phase_2_pro_defense
        sm.send(Event.TIMEOUT)  # → phase_2_pro_2_rebuttal
        sm.send(Event.TIMEOUT)  # → phase_2_con_defense
        sm.send(Event.TIMEOUT)  # → consultation_2
        sm.send(Event.TIMEOUT)  # → phase_3_con_3  ← 반대3 먼저
        assert sm.current == State.PHASE_3_CON_3
        sm.send(Event.TIMEOUT)  # → phase_3_pro_3  ← 찬성3 나중
        assert sm.current == State.PHASE_3_PRO_3


# ── NO_RESPONSE_10S 이벤트 ────────────────────────────────────────────────────
class TestNoResponse:
    """§7.1: NO_RESPONSE_10S → reroute_prompt 상태 경유 후 동일 phase 유지."""

    def test_no_response_in_pro_defense(self):
        sm = _reach(State.PHASE_2_PRO_DEFENSE)
        sm.send(Event.NO_RESPONSE_10S)
        assert sm.current == State.PHASE_2_PRO_DEFENSE
        assert sm.reroute_pending is True

    def test_no_response_in_con_defense(self):
        sm = _reach(State.PHASE_2_CON_DEFENSE)
        sm.send(Event.NO_RESPONSE_10S)
        assert sm.current == State.PHASE_2_CON_DEFENSE
        assert sm.reroute_pending is True

    def test_reroute_cleared_on_next_input(self):
        sm = _reach(State.PHASE_2_PRO_DEFENSE)
        sm.send(Event.NO_RESPONSE_10S)
        sm.send(Event.COMPLETE)
        assert sm.reroute_pending is False

    def test_no_response_not_valid_in_consultation(self):
        """협의 단계는 NO_RESPONSE_10S 이벤트 없음 (화자 없음)."""
        sm = _reach(State.CONSULTATION_1)
        with pytest.raises(InvalidTransitionError):
            sm.send(Event.NO_RESPONSE_10S)


# ── 이벤트 히스토리 ───────────────────────────────────────────────────────────
class TestHistory:
    def test_history_records_all_transitions(self):
        sm = DebateStateMachine()
        sm.send(Event.START)
        sm.send(Event.TIMEOUT)
        assert len(sm.history) == 2

    def test_history_entry_has_from_to_event(self):
        sm = DebateStateMachine()
        sm.send(Event.START)
        entry = sm.history[0]
        assert entry["from"] == State.IDLE
        assert entry["to"] == State.ORIENTATION
        assert entry["event"] == Event.START

    def test_history_has_timestamp(self):
        sm = DebateStateMachine()
        sm.send(Event.START)
        assert "timestamp" in sm.history[0]


# ── duration_sec 메타데이터 ───────────────────────────────────────────────────
class TestDurationMeta:
    """각 state가 §7.1에 명시된 duration_sec을 반환해야 한다."""

    @pytest.mark.parametrize("state, expected_sec", [
        (State.ORIENTATION,               120),
        (State.PHASE_1_PRO_1,             120),
        (State.PHASE_1_CON_1,             120),
        (State.CONSULTATION_1,            120),
        (State.PHASE_2_CON_2_REBUTTAL,     90),
        (State.PHASE_2_PRO_DEFENSE,        90),
        (State.PHASE_2_PRO_2_REBUTTAL,     90),
        (State.PHASE_2_CON_DEFENSE,        90),
        (State.CONSULTATION_2,            120),
        (State.PHASE_3_CON_3,             120),
        (State.PHASE_3_PRO_3,             120),
        (State.JUDGING,                    30),
    ])
    def test_duration(self, state, expected_sec):
        sm = DebateStateMachine()
        assert sm.duration_of(state) == expected_sec


# ── no_new_grounds 제약 플래그 ────────────────────────────────────────────────
class TestConstraints:
    """§7.1: phase_3_con_3, phase_3_pro_3에 no_new_grounds 제약."""

    def test_phase_3_con_3_has_no_new_grounds(self):
        sm = DebateStateMachine()
        assert sm.constraints_of(State.PHASE_3_CON_3).get("no_new_grounds") is True

    def test_phase_3_pro_3_has_no_new_grounds(self):
        sm = DebateStateMachine()
        assert sm.constraints_of(State.PHASE_3_PRO_3).get("no_new_grounds") is True

    def test_phase_1_has_no_constraint(self):
        sm = DebateStateMachine()
        assert not sm.constraints_of(State.PHASE_1_PRO_1).get("no_new_grounds")


# ── 잘못된 전이 ───────────────────────────────────────────────────────────────
class TestInvalidTransitions:
    def test_cannot_send_start_twice(self):
        sm = DebateStateMachine()
        sm.send(Event.START)
        with pytest.raises(InvalidTransitionError):
            sm.send(Event.START)

    def test_cannot_transition_from_ended(self):
        sm = _reach(State.ENDED)
        with pytest.raises(InvalidTransitionError):
            sm.send(Event.TIMEOUT)

    def test_skip_only_valid_in_orientation(self):
        sm = DebateStateMachine()
        sm.send(Event.START)
        sm.send(Event.SKIP)  # orientation에서는 OK
        with pytest.raises(InvalidTransitionError):
            sm.send(Event.SKIP)  # phase_1_pro_1에서는 불가


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────
_COMPLETE_ONLY = {State.JUDGING, State.REPORT_GENERATION}

def _reach(target: State) -> DebateStateMachine:
    """target state까지 빠르게 이동. JUDGING·REPORT_GENERATION은 COMPLETE 사용."""
    sm = DebateStateMachine()
    while sm.current != target:
        if sm.current == State.IDLE:
            sm.send(Event.START)
        elif sm.current in _COMPLETE_ONLY:
            sm.send(Event.COMPLETE)
        else:
            sm.send(Event.TIMEOUT)
    return sm
