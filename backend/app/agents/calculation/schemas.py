from enum import Enum

from pydantic import BaseModel


class BudgetCategory(str, Enum):
    FLIGHTS = "flights"
    ACCOMMODATION = "accommodation"
    ACTIVITIES = "activities"
    FOOD = "food"
    TRANSPORT = "transport"
    INSURANCE = "insurance"
    BUFFER = "buffer"


class BudgetAllocation(BaseModel):
    category: BudgetCategory
    percentage: float
    amount: float
    amount_per_day: float = 0.0


class BudgetResult(BaseModel):
    total_budget: float
    currency: str = "USD"
    duration_days: int
    allocations: list[BudgetAllocation]
    destination_cost_index: float = 1.0

    @property
    def total_allocated(self) -> float:
        return sum(a.amount for a in self.allocations)


class AccommodationMatch(BaseModel):
    entity_id: str
    name: str
    region: str
    price_per_night: float
    rating: float | None = None
    style: str = ""
    score: float = 0.0
    why_it_fits: str = ""
    source_url: str = ""
    freshness_status: str = "fresh"


class Routeleg(BaseModel):
    from_city: str
    to_city: str
    transport_mode: str  # flight, train, bus
    cost_usd: float
    duration_hours: float
    via: str | None = None  # connection city if indirect


class OptimizedRoute(BaseModel):
    destinations: list[str]
    legs: list[Routeleg]
    total_cost: float
    total_hours: float


class SeasonalPricePoint(BaseModel):
    week_start: str
    multiplier: float
    season_type: str  # peak, shoulder, low
    notes: str = ""


class InsuranceEstimate(BaseModel):
    premium_low: float
    premium_high: float
    currency: str = "USD"
    high_risk_activities: list[str] = []
    coverage_notes: list[str] = []


class CalculationResults(BaseModel):
    budget: BudgetResult | None = None
    accommodation_matches: list[AccommodationMatch] = []
    route: OptimizedRoute | None = None
    seasonal_pricing: list[SeasonalPricePoint] = []
    insurance: InsuranceEstimate | None = None
