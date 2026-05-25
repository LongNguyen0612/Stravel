from pydantic import BaseModel


class AccommodationOption(BaseModel):
    name: str
    region: str
    price_per_night: float
    rating: float | None = None
    amenities: list[str] = []
    why_it_fits: str = ""
    source_url: str = ""
    freshness_status: str = "fresh"


class AccommodationTable(BaseModel):
    destination: str
    options: list[AccommodationOption] = []


class BudgetLineItem(BaseModel):
    description: str
    amount: float
    source: str = ""  # "calculation" or "entity"


class BudgetBreakdown(BaseModel):
    category: str
    allocated: float
    line_items: list[BudgetLineItem] = []
    subtotal: float = 0


class BookingAction(BaseModel):
    item: str
    priority: int  # 1 = most urgent
    deadline: str = ""
    reason: str = ""


class ProposalContent(BaseModel):
    itinerary: str = ""
    accommodation_tables: list[AccommodationTable] = []
    budget_breakdown: list[BudgetBreakdown] = []
    booking_actions: list[BookingAction] = []
    entities_used: list[str] = []
    data_limited: bool = False
    compliance_status: str = "pending"
