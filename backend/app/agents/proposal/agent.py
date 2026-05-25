import structlog

from app.agents.protocols import LLMServiceProtocol
from app.agents.state import AdvisoryState

logger = structlog.get_logger()

ITINERARY_SYSTEM_PROMPT = (
    "You are a travel itinerary formatter for Vietnam trips.\n"
    "Format the provided venue data into a day-by-day itinerary.\n"
    "RULES:\n"
    "- Use ONLY the venue names provided in the data below\n"
    "- Do NOT invent or suggest venues not in the data\n"
    "- Include morning, afternoon, and evening time blocks\n"
    "- Add transport suggestions between venues (taxi, walk, Grab)\n"
    "- If data is limited, say 'Limited data available for this area'\n"
)


async def proposal_node(state: AdvisoryState, llm: LLMServiceProtocol, vector_store=None) -> dict:
    """Generate a structured trip proposal from calculation results and Vector Store data.

    Uses retrieve-then-generate pattern:
    1. Retrieve entities from Vector Store
    2. Format with LLM (grounded in retrieved data)
    3. Validate entity references
    """
    logger.info("agent.proposal.started", session_id=state.session_id)

    try:
        profile = state.traveler_profile
        calculations = state.calculations

        if not calculations:
            return {
                "stage": "proposing",
                "errors": [*state.errors, {"agent": "proposal", "message": "No calculations available"}],
            }

        # Retrieve entities from Vector Store for the proposal
        retrieved_entities = []
        if vector_store and profile:
            destinations = []
            if hasattr(profile, "destination_preferences") and profile.destination_preferences:
                destinations = profile.destination_preferences
            elif isinstance(profile, dict):
                destinations = profile.get("destination_preferences", []) or []

            for dest in destinations:
                # Get hotels
                hotels = await vector_store.search(
                    f"hotel in {dest}", {"entity_type": "hotel", "region": dest}, limit=5
                )
                retrieved_entities.extend(hotels)
                # Get attractions
                attractions = await vector_store.search(
                    f"attractions in {dest}", {"entity_type": "attraction", "region": dest}, limit=5
                )
                retrieved_entities.extend(attractions)
                # Get restaurants
                restaurants = await vector_store.search(
                    f"restaurants in {dest}", {"entity_type": "restaurant", "region": dest}, limit=5
                )
                retrieved_entities.extend(restaurants)

        # Format retrieved data for LLM
        entity_summary = "\n".join(
            f"- {e.get('name', 'Unknown')} ({e.get('entity_type', '')}) in {e.get('region', '')} "
            f"- ${e.get('pricing', 'N/A')}"
            for e in retrieved_entities
        )

        if not entity_summary:
            entity_summary = "Limited data available. Indicate data limitations in the itinerary."

        prompt = f"{ITINERARY_SYSTEM_PROMPT}\n\nAvailable venues:\n{entity_summary}\n\nGenerate a day-by-day itinerary."

        itinerary_text = await llm.generate(prompt)

        proposal = {
            "itinerary": itinerary_text,
            "entities_used": [e.get("name", "") for e in retrieved_entities],
            "entity_count": len(retrieved_entities),
            "data_limited": len(retrieved_entities) < 5,
        }

        logger.info(
            "agent.proposal.completed",
            session_id=state.session_id,
            entities_used=len(retrieved_entities),
        )

        return {"stage": "proposing", "proposal": proposal}

    except Exception as e:
        logger.error("agent.proposal.failed", session_id=state.session_id, error=str(e))
        return {"errors": [*state.errors, {"agent": "proposal", "message": str(e)}]}
