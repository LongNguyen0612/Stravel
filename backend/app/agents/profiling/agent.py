import structlog

from app.agents.profiling.prompts import FOLLOW_UP_TEMPLATE, ROUND_1_PROMPT, SYSTEM_PROMPT
from app.agents.profiling.schemas import TRIGGER_KEYWORDS, ContextTrigger
from app.agents.protocols import LLMServiceProtocol
from app.agents.state import AdvisoryState

logger = structlog.get_logger()


def detect_triggers(text: str, already_triggered: set[str]) -> list[ContextTrigger]:
    """Detect context triggers in traveler response text. Returns new triggers only."""
    text_lower = text.lower()
    detected = []
    seen_categories = set()

    for keyword, trigger in TRIGGER_KEYWORDS.items():
        is_new = trigger.category not in already_triggered
        is_unique = trigger.category not in seen_categories
        if keyword in text_lower and is_new and is_unique:
            detected.append(trigger)
            seen_categories.add(trigger.category)

    return detected


async def profiling_node(state: AdvisoryState, llm: LLMServiceProtocol) -> dict:
    """Profiling agent node — manages dynamic fact-finding conversation."""
    logger.info("agent.profiling.started", session_id=state.session_id)

    answered_topics: set[str] = set()
    triggered_categories: set[str] = set()
    pending_follow_ups: list[dict] = []

    profile = state.traveler_profile
    if profile:
        if profile.traveler_count is not None:
            answered_topics.add("traveler_count")
        if profile.travel_start_date is not None or profile.date_flexibility is not None:
            answered_topics.add("travel_dates")
        if profile.budget_total is not None:
            answered_topics.add("budget")
        if profile.destination_preferences:
            answered_topics.add("destinations")

    try:
        topics_str = ", ".join(answered_topics) if answered_topics else "none yet"
        system = SYSTEM_PROMPT.format(answered_topics=topics_str)

        if not answered_topics:
            prompt = f"{system}\n\n{ROUND_1_PROMPT}"
        elif pending_follow_ups:
            follow_up = pending_follow_ups[0]
            questions = "\n".join(follow_up["questions"])
            prompt = f"{system}\n\n{FOLLOW_UP_TEMPLATE.format(category=follow_up['category'], questions=questions)}"
        else:
            prompt = f"{system}\n\nContinue gathering information. Ask about any missing details."

        await llm.generate(prompt)

        logger.info(
            "agent.profiling.question_generated",
            session_id=state.session_id,
            answered_topics=list(answered_topics),
            triggered_categories=list(triggered_categories),
        )

        return {"stage": "profiling"}

    except Exception as e:
        logger.error("agent.profiling.failed", session_id=state.session_id, error=str(e))
        return {"errors": [*state.errors, {"agent": "profiling", "message": str(e)}]}
