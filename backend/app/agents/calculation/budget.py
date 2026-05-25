import structlog

from app.agents.calculation.cost_index import ALLOCATION_PROFILES, get_average_cost_index
from app.agents.calculation.schemas import BudgetAllocation, BudgetCategory, BudgetResult

logger = structlog.get_logger()


def allocate_budget(
    total_budget: float,
    duration_days: int,
    destinations: list[str] | None = None,
    accommodation_style: str = "default",
) -> BudgetResult:
    """Compute budget allocation across categories. Guarantees total == budget (no rounding drift)."""
    if total_budget <= 0 or duration_days <= 0:
        return BudgetResult(
            total_budget=total_budget,
            duration_days=max(duration_days, 1),
            allocations=[
                BudgetAllocation(category=cat, percentage=0, amount=0, amount_per_day=0) for cat in BudgetCategory
            ],
        )

    cost_index = get_average_cost_index(destinations or [])
    profile_key = accommodation_style if accommodation_style in ALLOCATION_PROFILES else "default"
    profile = ALLOCATION_PROFILES[profile_key]

    # Integer math in cents to avoid floating point drift
    total_cents = round(total_budget * 100)
    allocated_cents = 0
    allocations: list[BudgetAllocation] = []

    categories = list(BudgetCategory)
    for i, cat in enumerate(categories):
        pct = profile.get(cat.value, 0.05)

        if i == len(categories) - 1:
            # Last category (buffer) gets the remainder
            amount_cents = total_cents - allocated_cents
        else:
            amount_cents = round(total_cents * pct)
            allocated_cents += amount_cents

        amount = amount_cents / 100
        amount_per_day = round(amount / duration_days, 2) if duration_days > 0 else 0

        allocations.append(
            BudgetAllocation(
                category=cat,
                percentage=round(pct * 100, 1),
                amount=amount,
                amount_per_day=amount_per_day,
            )
        )

    logger.info(
        "budget.allocated",
        total=total_budget,
        duration_days=duration_days,
        cost_index=cost_index,
        style=profile_key,
    )

    return BudgetResult(
        total_budget=total_budget,
        duration_days=duration_days,
        allocations=allocations,
        destination_cost_index=cost_index,
    )
