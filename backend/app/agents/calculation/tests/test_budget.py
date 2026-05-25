from app.agents.calculation.budget import allocate_budget
from app.agents.calculation.cost_index import get_average_cost_index, get_cost_index


def test_basic_allocation():
    result = allocate_budget(3000, 10, ["hanoi"])
    assert result.total_budget == 3000
    assert result.duration_days == 10
    assert len(result.allocations) == 7
    assert result.total_allocated == 3000  # No rounding drift


def test_zero_budget():
    result = allocate_budget(0, 10)
    assert all(a.amount == 0 for a in result.allocations)


def test_single_day_trip():
    result = allocate_budget(500, 1, ["hcmc"])
    assert result.total_allocated == 500
    for a in result.allocations:
        assert a.amount_per_day == a.amount  # 1 day = same


def test_thirty_day_trip():
    result = allocate_budget(10000, 30, ["hanoi", "hcmc", "danang"])
    assert result.total_allocated == 10000
    assert result.duration_days == 30


def test_luxury_allocation():
    result = allocate_budget(5000, 7, ["phuquoc"], accommodation_style="luxury")
    accom = next(a for a in result.allocations if a.category.value == "accommodation")
    assert accom.percentage == 40.0  # Luxury profile


def test_budget_allocation():
    result = allocate_budget(1000, 14, ["sapa"], accommodation_style="budget")
    accom = next(a for a in result.allocations if a.category.value == "accommodation")
    assert accom.percentage == 25.0  # Budget profile


def test_rounding_exact():
    """Total allocated must be within 1 cent of total budget."""
    for budget in [100, 333.33, 1000, 7777.77, 99.99]:
        result = allocate_budget(budget, 7, ["hanoi"])
        assert abs(result.total_allocated - budget) < 0.01, f"Drift for budget {budget}: {result.total_allocated}"


def test_cost_index_known():
    assert get_cost_index("phuquoc") == 1.10
    assert get_cost_index("hanoi") == 0.85


def test_cost_index_unknown():
    assert get_cost_index("unknown_city") == 1.0


def test_cost_index_case_insensitive():
    assert get_cost_index("HANOI") == get_cost_index("hanoi")
    assert get_cost_index("  PhuQuoc  ") == get_cost_index("phuquoc")


def test_average_cost_index():
    avg = get_average_cost_index(["hanoi", "phuquoc"])
    expected = (0.85 + 1.10) / 2
    assert abs(avg - expected) < 0.001


def test_average_cost_index_empty():
    assert get_average_cost_index([]) == 1.0
