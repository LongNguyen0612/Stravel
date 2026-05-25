#!/bin/bash
# =============================================================================
# STravel Epic 3 — Trip Planning & Proposal Generation Integration Tests
# =============================================================================
# Prerequisites:
#   1. cd stravel && cp .env.example .env
#   2. docker-compose -f docker-compose.full.yml up -d  (PostgreSQL + Qdrant + Redis)
#   3. cd backend && source .venv/bin/activate
#   4. Seed data loaded (python data/scripts/seed_vector_store.py)
#   5. uvicorn app.main:app --port 8000 --reload
#
# Usage: bash scripts/manual-test-epic3.sh
# =============================================================================

set -e

PASS=0
FAIL=0
TOTAL=0
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { ((PASS++)); ((TOTAL++)); echo -e "  ${GREEN}✅ PASS${NC} — $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo -e "  ${RED}❌ FAIL${NC} — $1: $2"; }
section() { echo -e "\n${YELLOW}━━━ $1 ━━━${NC}"; }

run_python() {
    cd "$BACKEND_DIR" && source .venv/bin/activate 2>/dev/null && python3 -c "$1" 2>&1
}

# =============================================================================
section "1. BUDGET ALLOCATION"
# =============================================================================

# Test 1: Basic budget allocation
echo "  Testing budget allocation..."
RESULT=$(run_python "
from app.agents.calculation.budget import allocate_budget
r = allocate_budget(3000, 10, ['hanoi', 'hcmc'])
assert r.total_budget == 3000
assert r.duration_days == 10
assert len(r.allocations) == 7
drift = abs(r.total_allocated - 3000)
assert drift < 0.01, f'Rounding drift: {drift}'
print(f'OK:total={r.total_budget},categories={len(r.allocations)},drift={drift:.4f}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Budget allocation: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Budget allocation" "$RESULT"
fi

# Test 2: Luxury vs budget style
echo "  Testing allocation styles..."
RESULT=$(run_python "
from app.agents.calculation.budget import allocate_budget
lux = allocate_budget(5000, 7, ['phuquoc'], accommodation_style='luxury')
bud = allocate_budget(5000, 7, ['sapa'], accommodation_style='budget')
lux_accom = next(a for a in lux.allocations if a.category.value == 'accommodation')
bud_accom = next(a for a in bud.allocations if a.category.value == 'accommodation')
assert lux_accom.percentage > bud_accom.percentage, f'Luxury {lux_accom.percentage}% should > Budget {bud_accom.percentage}%'
print(f'OK:luxury_accom={lux_accom.percentage}%,budget_accom={bud_accom.percentage}%')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Allocation styles: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Allocation styles" "$RESULT"
fi

# Test 3: Cost index
echo "  Testing destination cost index..."
RESULT=$(run_python "
from app.agents.calculation.cost_index import get_cost_index, get_average_cost_index
pq = get_cost_index('phuquoc')
hn = get_cost_index('hanoi')
assert pq > hn, f'Phu Quoc ({pq}) should be more expensive than Hanoi ({hn})'
avg = get_average_cost_index(['hanoi', 'phuquoc'])
assert hn < avg < pq, f'Average ({avg}) should be between Hanoi ({hn}) and Phu Quoc ({pq})'
unknown = get_cost_index('tokyo')
assert unknown == 1.0, f'Unknown should be 1.0, got {unknown}'
print(f'OK:phuquoc={pq},hanoi={hn},avg={avg:.2f},unknown={unknown}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Cost index: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Cost index" "$RESULT"
fi

# =============================================================================
section "2. ACCOMMODATION MATCHING"
# =============================================================================

# Test 4: Score accommodation (no Qdrant needed)
echo "  Testing accommodation scoring..."
RESULT=$(run_python "
from app.agents.calculation.accommodation import score_accommodation
hotel = {'pricing': 80, 'rating': 4.5, 'region': 'hcmc', 'accommodation_style': 'luxury', 'freshness_status': 'fresh'}
score = score_accommodation(hotel, budget_per_night=100, target_region='hcmc', target_style='luxury')
assert 0 < score <= 1, f'Score {score} out of range'
# Over-budget hotel should score lower
expensive = {'pricing': 300, 'rating': 4.5, 'region': 'hcmc', 'accommodation_style': 'luxury', 'freshness_status': 'fresh'}
score_exp = score_accommodation(expensive, budget_per_night=100, target_region='hcmc')
assert score > score_exp, f'Cheap ({score}) should score higher than expensive ({score_exp})'
print(f'OK:within_budget={score:.3f},over_budget={score_exp:.3f}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Accommodation scoring: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Accommodation scoring" "$RESULT"
fi

# Test 5: Match from Qdrant (needs seeded data)
echo "  Testing accommodation matching from Qdrant..."
QDRANT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$QDRANT_URL/readyz" 2>/dev/null)
if [ "$QDRANT_STATUS" = "200" ]; then
    RESULT=$(cd "$BACKEND_DIR" && source .venv/bin/activate 2>/dev/null && PYTHONPATH=. python3 -c "
import asyncio
from app.rag.vector_store import QdrantVectorStore
from app.agents.calculation.accommodation import match_accommodations

async def test():
    store = QdrantVectorStore(url='$QDRANT_URL')
    results = await match_accommodations(store, 'hcmc', budget_per_night=150, limit=5)
    await store.close()
    if results:
        print(f'OK:count={len(results)},top={results[0].name},score={results[0].score:.3f}')
    else:
        print('FAIL:No accommodation results returned')

asyncio.run(test())
" 2>&1)
    if echo "$RESULT" | grep -q "^OK:"; then
        pass "Qdrant accommodation match: $(echo "$RESULT" | cut -d: -f2-)"
    else
        fail "Qdrant accommodation match" "$RESULT"
    fi
else
    echo -e "  ⏭️  SKIP — Qdrant not available"
fi

# =============================================================================
section "3. ROUTING OPTIMIZATION"
# =============================================================================

# Test 6: Multi-city route
echo "  Testing multi-city routing..."
RESULT=$(run_python "
from app.agents.calculation.routing import optimize_route
route = optimize_route(['hanoi', 'halong', 'danang', 'hcmc'])
assert len(route.legs) >= 2, f'Expected >=2 legs, got {len(route.legs)}'
assert route.total_cost > 0, f'Expected cost > 0, got {route.total_cost}'
legs_str = ' → '.join([route.destinations[0]] + [l.to_city for l in route.legs])
print(f'OK:route={legs_str},cost=\${route.total_cost:.0f},hours={route.total_hours:.1f}h')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Multi-city routing: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Multi-city routing" "$RESULT"
fi

# Test 7: Single destination
echo "  Testing single destination..."
RESULT=$(run_python "
from app.agents.calculation.routing import optimize_route
route = optimize_route(['hanoi'])
assert len(route.legs) == 0
assert route.total_cost == 0
print('OK:no_legs,zero_cost')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Single destination gracefully handled"
else
    fail "Single destination" "$RESULT"
fi

# Test 8: Transport lookup
echo "  Testing transport options..."
RESULT=$(run_python "
from app.agents.calculation.routing import get_transport
opts = get_transport('hanoi', 'danang')
assert len(opts) >= 1, 'Expected at least 1 transport option'
modes = [o[0] for o in opts]
print(f'OK:options={len(opts)},modes={\",\".join(modes)}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Transport options: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Transport options" "$RESULT"
fi

# =============================================================================
section "4. SEASONAL PRICING"
# =============================================================================

# Test 9: Low season pricing
echo "  Testing low season pricing..."
RESULT=$(run_python "
from datetime import date
from app.agents.calculation.pricing import analyze_seasonal_pricing
points = analyze_seasonal_pricing('hanoi', date(2026, 3, 1), date(2026, 3, 28))
assert len(points) == 4, f'Expected 4 weeks, got {len(points)}'
assert all(p.multiplier == 1.0 for p in points), 'Low season should have 1.0 multiplier'
print(f'OK:weeks={len(points)},all_low_season=true')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Low season pricing: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Low season pricing" "$RESULT"
fi

# Test 10: Tet holiday pricing
echo "  Testing Tet holiday pricing..."
RESULT=$(run_python "
from datetime import date
from app.agents.calculation.pricing import analyze_seasonal_pricing
points = analyze_seasonal_pricing('phuquoc', date(2026, 2, 14), date(2026, 2, 25))
tet = [p for p in points if 'tet' in p.season_type]
assert len(tet) > 0, 'Should detect Tet period'
assert tet[0].multiplier > 1.5, f'Tet multiplier should be > 1.5, got {tet[0].multiplier}'
print(f'OK:tet_weeks={len(tet)},multiplier={tet[0].multiplier}x')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Tet pricing: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Tet pricing" "$RESULT"
fi

# Test 11: Christmas pricing
echo "  Testing Christmas pricing..."
RESULT=$(run_python "
from datetime import date
from app.agents.calculation.pricing import analyze_seasonal_pricing
points = analyze_seasonal_pricing('danang', date(2026, 12, 20), date(2027, 1, 5))
xmas = [p for p in points if 'christmas' in p.season_type]
assert len(xmas) > 0, 'Should detect Christmas'
print(f'OK:christmas_weeks={len(xmas)},multiplier={xmas[0].multiplier}x')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Christmas pricing: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Christmas pricing" "$RESULT"
fi

# =============================================================================
section "5. TRAVEL INSURANCE"
# =============================================================================

# Test 12: Basic insurance
echo "  Testing insurance estimation..."
RESULT=$(run_python "
from app.agents.calculation.insurance import estimate_insurance
est = estimate_insurance(traveler_count=2, traveler_ages=[30, 28], duration_days=10)
assert est.premium_low > 0
assert est.premium_high > est.premium_low
print(f'OK:low=\${est.premium_low:.2f},high=\${est.premium_high:.2f}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Insurance estimation: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Insurance estimation" "$RESULT"
fi

# Test 13: High-risk activities
echo "  Testing high-risk activity surcharge..."
RESULT=$(run_python "
from app.agents.calculation.insurance import estimate_insurance
safe = estimate_insurance(1, [30], 7, ['sightseeing'])
risky = estimate_insurance(1, [30], 7, ['scuba diving', 'motorbike tour'])
assert risky.premium_high > safe.premium_high, 'High-risk should cost more'
assert 'scuba diving' in risky.high_risk_activities
print(f'OK:safe=\${safe.premium_high:.2f},risky=\${risky.premium_high:.2f},surcharge={((risky.premium_high/safe.premium_high)-1)*100:.0f}%')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Risk surcharge: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Risk surcharge" "$RESULT"
fi

# Test 14: Senior traveler
echo "  Testing senior traveler premium..."
RESULT=$(run_python "
from app.agents.calculation.insurance import estimate_insurance
young = estimate_insurance(1, [25], 7)
senior = estimate_insurance(1, [70], 7)
assert senior.premium_high > young.premium_high
assert any('Senior' in n for n in senior.coverage_notes)
print(f'OK:young=\${young.premium_high:.2f},senior=\${senior.premium_high:.2f}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Senior premium: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Senior premium" "$RESULT"
fi

# =============================================================================
section "6. GUARDRAILS — Entity & Price Validation"
# =============================================================================

# Test 15: Entity validation
echo "  Testing entity validator..."
RESULT=$(run_python "
import asyncio
from app.guardrails.entity_validator import EntityValidator

class MockStore:
    async def search(self, query, filters, limit=10):
        if 'Rex' in query: return [{'name': 'Rex Hotel', 'region': 'hcmc'}]
        return []

async def test():
    v = EntityValidator(MockStore())
    r = await v.validate_entities(['Rex Hotel', 'Fake Hotel'])
    assert len(r['valid']) == 1
    assert len(r['invalid']) == 1
    assert 'Fake Hotel' in r['invalid']
    print(f'OK:valid={len(r[\"valid\"])},invalid={len(r[\"invalid\"])}')

asyncio.run(test())
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Entity validator: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Entity validator" "$RESULT"
fi

# Test 16: Price validation
echo "  Testing price validator..."
RESULT=$(run_python "
import asyncio
from app.guardrails.price_validator import PriceValidator

class MockStore:
    async def search(self, query, filters, limit=10):
        if 'Rex' in query: return [{'name': 'Rex Hotel', 'pricing': 120}]
        return []

async def test():
    v = PriceValidator(MockStore())
    # Valid price (within 10% tolerance)
    r1 = await v.validate_price('Rex Hotel', 125)
    assert r1['valid'], f'125 should be within 10% of 120'
    # Invalid price (way off)
    r2 = await v.validate_price('Rex Hotel', 999)
    assert not r2['valid'], '999 should not match 120'
    # Unknown entity
    r3 = await v.validate_price('Fake Hotel', 100)
    assert not r3['valid']
    print(f'OK:valid_price=pass,mismatch=caught,unknown=caught')

asyncio.run(test())
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Price validator: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Price validator" "$RESULT"
fi

# =============================================================================
section "7. PROPOSAL GENERATION"
# =============================================================================

# Test 17: Proposal agent with mock
echo "  Testing proposal agent..."
RESULT=$(run_python "
import asyncio, uuid
from app.agents.proposal.agent import proposal_node
from app.agents.state import AdvisoryState
from app.schemas.profile import TravelerProfileResponse

class MockLLM:
    async def generate(self, prompt, **kw):
        return 'Day 1: Visit War Museum. Lunch at Pho 24. Stay at Rex Hotel.'

class MockStore:
    async def search(self, query, filters, limit=10):
        return [
            {'name': 'Rex Hotel', 'entity_type': 'hotel', 'region': 'hcmc', 'pricing': 120},
            {'name': 'War Museum', 'entity_type': 'attraction', 'region': 'hcmc', 'pricing': 3},
        ]

async def test():
    state = AdvisoryState(
        session_id='test', tenant_id='default', stage='proposing',
        calculations={'budget': {'total_budget': 3000}},
        traveler_profile=TravelerProfileResponse(
            id=str(uuid.uuid4()), advisory_session_id=str(uuid.uuid4()),
            destination_preferences=['hcmc'], traveler_count=2, budget_total=3000.0,
            created_at='2026-01-01T00:00:00', updated_at='2026-01-01T00:00:00',
        ),
    )
    result = await proposal_node(state, MockLLM(), MockStore())
    assert 'proposal' in result, f'No proposal in result: {result.keys()}'
    assert result['proposal']['entity_count'] > 0
    print(f'OK:entities={result[\"proposal\"][\"entity_count\"]},limited={result[\"proposal\"][\"data_limited\"]}')

asyncio.run(test())
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Proposal agent: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Proposal agent" "$RESULT"
fi

# =============================================================================
section "8. PROPOSAL EXPORT"
# =============================================================================

# Test 18: HTML formatting
echo "  Testing proposal HTML export..."
RESULT=$(run_python "
from app.agents.proposal.export import format_proposal_html
content = {
    'itinerary': 'Day 1: HCMC exploration',
    'accommodation_tables': [{'destination': 'HCMC', 'options': [
        {'name': 'Rex Hotel', 'price_per_night': 120, 'rating': 4.5, 'why_it_fits': 'Historic'}
    ]}],
    'budget_breakdown': [{'category': 'accommodation', 'allocated': 1200}],
    'booking_actions': [{'item': 'Book flights', 'priority': 1, 'reason': 'Prices volatile'}],
}
html = format_proposal_html(content)
assert '<html>' in html
assert 'Rex Hotel' in html
assert 'Book flights' in html
print(f'OK:html_length={len(html)},has_hotel=true,has_actions=true')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "HTML export: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "HTML export" "$RESULT"
fi

# Test 19: Share token generation
echo "  Testing share token..."
RESULT=$(run_python "
from app.agents.proposal.export import generate_share_token
t1 = generate_share_token()
t2 = generate_share_token()
assert len(t1) > 20, f'Token too short: {len(t1)}'
assert t1 != t2, 'Tokens should be unique'
print(f'OK:length={len(t1)},unique=true')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Share token: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Share token" "$RESULT"
fi

# Test 20: PDF generation (fallback)
echo "  Testing PDF generation..."
RESULT=$(run_python "
from app.agents.proposal.export import generate_pdf_bytes
html = '<html><body><h1>Test Proposal</h1></body></html>'
pdf = generate_pdf_bytes(html)
assert len(pdf) > 0, 'PDF should not be empty'
print(f'OK:size={len(pdf)}bytes')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "PDF generation: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "PDF generation" "$RESULT"
fi

# =============================================================================
section "9. END-TO-END CALCULATION PIPELINE"
# =============================================================================

# Test 21: Full calculation pipeline (all 4 calculation modules)
echo "  Testing full calculation pipeline..."
RESULT=$(run_python "
from datetime import date
from app.agents.calculation.budget import allocate_budget
from app.agents.calculation.routing import optimize_route
from app.agents.calculation.pricing import analyze_seasonal_pricing
from app.agents.calculation.insurance import estimate_insurance

# Budget
budget = allocate_budget(5000, 10, ['hanoi', 'danang', 'hcmc'], accommodation_style='mid-range')
assert abs(budget.total_allocated - 5000) < 0.01

# Routing
route = optimize_route(['hanoi', 'danang', 'hcmc'])
assert len(route.legs) >= 2
assert route.total_cost > 0

# Pricing
pricing = analyze_seasonal_pricing('danang', date(2026, 7, 1), date(2026, 7, 14))
assert len(pricing) >= 2

# Insurance
insurance = estimate_insurance(2, [30, 28], 10, ['trekking', 'kayaking'])
assert insurance.premium_low > 0

print(f'OK:budget=\${budget.total_allocated:.0f},route_cost=\${route.total_cost:.0f},pricing_weeks={len(pricing)},insurance=\${insurance.premium_low:.0f}-\${insurance.premium_high:.0f}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Full pipeline: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Full pipeline" "$RESULT"
fi

# =============================================================================
section "10. UNIT TEST SUITE"
# =============================================================================

# Test 22: Run full unit test suite
echo "  Running full unit test suite..."
cd "$BACKEND_DIR"
TEST_OUTPUT=$(source .venv/bin/activate 2>/dev/null && pytest tests/ app/agents/ app/rag/ app/etl/ app/guardrails/ -m "not integration" -q 2>&1)
TEST_EXIT=$?

PASSED_COUNT=$(echo "$TEST_OUTPUT" | grep -oE "[0-9]+ passed" | head -1 | grep -oE "[0-9]+")

if [ "$TEST_EXIT" -eq 0 ]; then
    pass "Unit test suite: $PASSED_COUNT tests passed"
else
    FAILED_COUNT=$(echo "$TEST_OUTPUT" | grep -oE "[0-9]+ failed" | head -1 | grep -oE "[0-9]+")
    fail "Unit test suite" "$FAILED_COUNT tests failed"
    echo "$TEST_OUTPUT" | tail -10
fi

# =============================================================================
section "RESULTS"
# =============================================================================

echo ""
echo -e "  Total:  $TOTAL"
echo -e "  ${GREEN}Passed: $PASS${NC}"
if [ "$FAIL" -gt 0 ]; then
    echo -e "  ${RED}Failed: $FAIL${NC}"
else
    echo -e "  Failed: 0"
fi
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED — Epic 3 is verified!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  $FAIL test(s) failed — see details above${NC}"
    exit 1
fi
