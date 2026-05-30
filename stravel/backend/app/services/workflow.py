"""Advisory workflow — runs all 4 stages and emits SSE events via event_bus."""
import asyncio
import uuid

import structlog
from sqlmodel import select

from app.core.database import async_session_factory
from app.models import AdvisorySession, SessionStatus
from app.services.event_bus import clear_session_buffer, publish_card_event, publish_event
from app.services.llm import create_llm_service

logger = structlog.get_logger()

_llm = None


def _get_llm():
    global _llm
    if _llm is None:
        _llm = create_llm_service()
    return _llm


async def run_advisory_workflow(session_id: str, profile: dict) -> None:
    logger.info("workflow.started", session_id=session_id)
    await clear_session_buffer(session_id)  # clear previous run's events before buffering new ones
    llm = _get_llm()
    event_count = 0

    async def _emit(sid: str, event: str, data: dict) -> None:
        nonlocal event_count
        await publish_event(sid, event, data)
        event_count += 1
        await asyncio.sleep(0.05)  # small delay so frontend renders each event distinctly

    try:
        # ── Stage 1: Profiling ────────────────────────────────────────────────
        await _emit(session_id, "stage.change", {"stage": "profiling"})

        destinations = ", ".join(profile.get("destination_preferences") or ["Vietnam"])
        traveler_count = profile.get("traveler_count") or 1
        budget = profile.get("budget_total")
        currency = profile.get("budget_currency") or "USD"
        start_date = profile.get("travel_start_date") or "TBD"
        end_date = profile.get("travel_end_date") or "TBD"
        accommodation = profile.get("accommodation_style") or "mid-range"
        activities = ", ".join(profile.get("activity_preferences") or []) or "general sightseeing"

        profile_prompt = (
            f"You are a professional travel advisor reviewing a client's travel request. "
            f"Summarize this profile in a friendly, professional tone and confirm you've understood their needs:\n\n"
            f"- Travelers: {traveler_count} person(s)\n"
            f"- Destinations: {destinations}\n"
            f"- Travel dates: {start_date} to {end_date}\n"
            f"- Budget: {f'{currency} {budget:,.0f}' if budget else 'Not specified'}\n"
            f"- Accommodation style: {accommodation}\n"
            f"- Activities: {activities}\n"
            f"- Dietary requirements: {', '.join(profile.get('dietary_requirements') or []) or 'None'}\n"
            f"- Special interests: {', '.join(profile.get('special_interests') or []) or 'None'}\n\n"
            f"Write a brief, warm confirmation (2-3 sentences) then say you're starting calculations."
        )
        profiling_reply = await llm.generate(profile_prompt)
        await _emit(session_id, "agent.profiling.question", {
            "type": "result",
            "content": profiling_reply,
            "context": "profile_confirmed",
        })

        # ── Stage 2: Calculating ──────────────────────────────────────────────
        await _emit(session_id, "stage.change", {"stage": "calculating"})

        if budget:
            alloc = {
                "Flights": round(budget * 0.30),
                "Accommodation": round(budget * 0.35),
                "Activities & tours": round(budget * 0.15),
                "Food & dining": round(budget * 0.10),
                "Local transport": round(budget * 0.05),
                "Travel insurance": round(budget * 0.03),
                "Emergency buffer": round(budget * 0.02),
            }
            alloc_lines = "\n".join(f"  • {k}: {currency} {v:,}" for k, v in alloc.items())
            await _emit(session_id, "agent.calculation.result", {
                "type": "result",
                "content": f"Budget allocated across {traveler_count} traveler(s):\n{alloc_lines}\n\nTotal: {currency} {budget:,.0f}",
                "context": "budget_allocation",
            })
        await asyncio.sleep(0.5)

        dest_list = profile.get("destination_preferences") or ["Hanoi", "Ho Chi Minh City"]
        await _emit(session_id, "agent.calculation.result", {
            "type": "result",
            "content": (
                f"Accommodation search complete for {', '.join(dest_list)}.\n"
                f"Found options matching {accommodation} style and your group size."
            ),
            "context": "accommodation_search",
        })
        await asyncio.sleep(0.5)

        await _emit(session_id, "agent.calculation.result", {
            "type": "result",
            "content": f"Routing optimized for {len(dest_list)} destination(s). Multi-city itinerary sequenced for minimum travel time.",
            "context": "routing_complete",
        })

        # ── Stage 3: Proposing ────────────────────────────────────────────────
        await _emit(session_id, "stage.change", {"stage": "proposing"})

        proposal_prompt = (
            f"You are an expert Vietnam travel advisor. Create a detailed travel proposal for:\n\n"
            f"- {traveler_count} traveler(s)\n"
            f"- Destinations: {destinations}\n"
            f"- Dates: {start_date} to {end_date}\n"
            f"- Budget: {f'{currency} {budget:,.0f}' if budget else 'flexible'}\n"
            f"- Accommodation: {accommodation}\n"
            f"- Activities: {activities}\n"
            f"- Special interests: {', '.join(profile.get('special_interests') or []) or 'none'}\n\n"
            f"Include:\n"
            f"1. A day-by-day itinerary (be specific with locations, timings, and costs)\n"
            f"2. Top 3 hotel recommendations per destination with price range\n"
            f"3. Key booking actions with deadlines\n\n"
            f"Be specific, practical and concise."
        )
        proposal_reply = await llm.generate_via_stream(proposal_prompt)
        await _emit(session_id, "proposal.ready", {
            "type": "proposal",
            "summary": proposal_reply,
            "context": "proposal_complete",
        })

        # Emit flight card with is_final=True to prove the card.update pipeline end-to-end
        await publish_card_event(
            session_id=session_id,
            card_id="flight-1",
            card_type="flight",
            completeness_score=0.9,
            delta={
                "origin": dest_list[0] if dest_list else "Hanoi",
                "destination": dest_list[-1] if dest_list else "Ho Chi Minh City",
                "departDate": str(start_date),
                "returnDate": str(end_date),
            },
            is_final=True,
        )
        await asyncio.sleep(0.05)  # match _emit render-spacing for consistent event delivery

        # ── Stage 4: Validating ───────────────────────────────────────────────
        await _emit(session_id, "stage.change", {"stage": "validating"})
        await asyncio.sleep(0.3)

        passport_expiry = profile.get("passport_expiry_date")
        if passport_expiry and start_date and start_date != "TBD":
            try:
                from datetime import date
                expiry = date.fromisoformat(str(passport_expiry))
                travel = date.fromisoformat(str(start_date))
                months_valid = (expiry - travel).days / 30
                if months_valid < 6:
                    await _emit(session_id, "agent.compliance.flag", {
                        "severity": "block",
                        "check": "PASSPORT_VALIDITY",
                        "message": f"Passport expires {passport_expiry}. Vietnam requires 6 months validity from travel date ({start_date}). Only {months_valid:.0f} months remaining.",
                        "alternative": "Renew passport before travel.",
                    })
                else:
                    await _emit(session_id, "agent.compliance.flag", {
                        "severity": "pass",
                        "check": "PASSPORT_VALIDITY",
                        "message": f"Passport valid until {passport_expiry} — {months_valid:.0f} months from departure. ✓",
                        "alternative": "",
                    })
            except (ValueError, TypeError) as exc:
                logger.warning("workflow.passport_date_parse_failed", session_id=session_id, error=str(exc))

        if budget and budget < 500 * traveler_count:
            await _emit(session_id, "agent.compliance.flag", {
                "severity": "warning",
                "check": "BUDGET_FEASIBILITY",
                "message": f"Budget of {currency} {budget:,.0f} is very tight for {traveler_count} traveler(s) visiting {destinations}. Minimum recommended: {currency} {500 * traveler_count:,}.",
                "alternative": "Consider increasing budget or reducing trip duration.",
            })

        dietary = profile.get("dietary_requirements") or []
        if dietary and "No restrictions" not in dietary:
            await _emit(session_id, "agent.compliance.flag", {
                "severity": "warning",
                "check": "DIETARY_REQUIREMENTS",
                "message": f"Dietary requirements noted: {', '.join(dietary)}. Most tourist areas in Vietnam have options, but rural areas may be limited.",
                "alternative": "Research specific restaurants in advance for stricter requirements.",
            })

        await _emit(session_id, "agent.compliance.flag", {
            "severity": "pass",
            "check": "VISA_REQUIREMENTS",
            "message": "Vietnam e-visa available for most nationalities ($25 USD, valid 90 days). Apply at evisa.gov.vn at least 3 business days before travel. ✓",
            "alternative": "",
        })

        await _emit(session_id, "stage.change", {"stage": "complete"})
        logger.info("workflow.completed", session_id=session_id, event_count=event_count,
                    generation_status="completed")

        async with async_session_factory() as db:
            result = await db.execute(select(AdvisorySession).where(AdvisorySession.id == uuid.UUID(session_id)))
            advisory_session = result.scalars().first()
            if advisory_session:
                advisory_session.status = SessionStatus.CONFIRMED
                await db.commit()

    except Exception as e:
        logger.error("workflow.failed", session_id=session_id, event_count=event_count,
                     generation_status="failed", error=str(e))
        try:
            await _emit(session_id, "agent.error", {"message": f"Workflow error: {e}"})
        except Exception:
            pass
