from pydantic import BaseModel


class DemoSessionResponse(BaseModel):
    session_id: str
    status: str = "profiling"


class DemoChatRequest(BaseModel):
    message: str


class DemoChatResponse(BaseModel):
    session_id: str
    reply: str
    stage: str
    is_complete: bool = False
    is_demo: bool = True  # Signals this is demo mode, not real LLM output
