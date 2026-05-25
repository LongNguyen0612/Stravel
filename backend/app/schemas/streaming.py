from pydantic import BaseModel


class AgentMessage(BaseModel):
    type: str  # "question", "result", "proposal"
    content: str
    context: str = ""


class StageChange(BaseModel):
    stage: str  # "profiling", "calculating", "proposing", "validating"


class AgentError(BaseModel):
    agent: str
    message: str


class ComplianceFlag(BaseModel):
    type: str = "flag"
    severity: str  # "block", "warning"
    check: str
    message: str
    alternative: str = ""
