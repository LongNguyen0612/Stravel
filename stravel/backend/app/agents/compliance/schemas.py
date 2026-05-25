from enum import Enum

from pydantic import BaseModel


class ComplianceSeverity(str, Enum):
    BLOCK = "block"
    WARNING = "warning"
    PASS = "pass"


class ComplianceCheckType(str, Enum):
    VISA = "visa"
    PASSPORT = "passport"
    HEALTH = "health"
    TRAVEL_ADVISORY = "travel_advisory"
    AGE_RESTRICTION = "age_restriction"
    SEASONAL = "seasonal"
    BUDGET = "budget"
    ACCESSIBILITY = "accessibility"


class ComplianceFlag(BaseModel):
    check_type: ComplianceCheckType
    severity: ComplianceSeverity
    message: str
    resolution: str = ""
    alternative: str = ""
    source_url: str = ""


class ComplianceCheck(BaseModel):
    check_type: ComplianceCheckType
    status: ComplianceSeverity
    flags: list[ComplianceFlag] = []


class ComplianceReport(BaseModel):
    checks: list[ComplianceCheck] = []
    overall_status: ComplianceSeverity = ComplianceSeverity.PASS
    block_count: int = 0
    warning_count: int = 0

    def add_check(self, check: ComplianceCheck) -> None:
        self.checks.append(check)
        for flag in check.flags:
            if flag.severity == ComplianceSeverity.BLOCK:
                self.block_count += 1
            elif flag.severity == ComplianceSeverity.WARNING:
                self.warning_count += 1
        # Update overall status
        if self.block_count > 0:
            self.overall_status = ComplianceSeverity.BLOCK
        elif self.warning_count > 0:
            self.overall_status = ComplianceSeverity.WARNING
