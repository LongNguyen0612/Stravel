from typing import Literal

from pydantic import BaseModel

from app.schemas.profile import TravelerProfileResponse


class AdvisoryState(BaseModel):
    """Shared state across all agents in the advisory workflow.

    All agents read from and write to this shared state via LangGraph.
    Agents NEVER communicate via side channels.
    """

    session_id: str
    tenant_id: str
    stage: Literal["profiling", "calculating", "proposing", "validating"] = "profiling"
    traveler_profile: TravelerProfileResponse | None = None
    calculations: dict | None = None
    proposal: dict | None = None
    compliance_report: dict | None = None
    errors: list[dict] = []
