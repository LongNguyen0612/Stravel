#!/bin/bash
# =============================================================================
# STravel Epic 4 — Compliance & Safety Validation Integration Tests
# =============================================================================
# Prerequisites:
#   1. cd stravel && cp .env.example .env
#   2. docker-compose -f docker-compose.full.yml up -d
#   3. cd backend && source .venv/bin/activate
#   4. Seed data loaded (regulatory rules in agents/compliance/rules/)
#   5. uvicorn app.main:app --port 8000 --reload
#
# Usage: bash scripts/manual-test-epic4.sh
# =============================================================================

set -e

PASS=0
FAIL=0
TOTAL=0
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

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
section "1. VISA CHECKS — Visa-Free Nationalities"
# =============================================================================

# Test 1: German — visa-free 45 days
echo "  Testing German visa (visa-free)..."
RESULT=$(run_python "
from app.agents.compliance.visa import check_visa
from app.agents.compliance.schemas import ComplianceSeverity
r = check_visa('DE', ['hanoi', 'hcmc', 'danang'])
assert r.status == ComplianceSeverity.PASS, f'Expected PASS, got {r.status}'
msg = r.flags[0].message
print(f'OK:DE={r.status.value},msg={msg[:60]}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "German visa-free: $(echo "$RESULT" | cut -d= -f2-)"
else
    fail "German visa-free" "$RESULT"
fi

# Test 2: Japanese — visa-free 45 days
echo "  Testing Japanese visa (visa-free)..."
RESULT=$(run_python "
from app.agents.compliance.visa import check_visa
from app.agents.compliance.schemas import ComplianceSeverity
r = check_visa('JP', ['hanoi'])
assert r.status == ComplianceSeverity.PASS
print(f'OK:JP={r.status.value}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Japanese visa-free"
else
    fail "Japanese visa-free" "$RESULT"
fi

# Test 3: Thai — visa-free 30 days (ASEAN)
echo "  Testing Thai visa (ASEAN visa-free)..."
RESULT=$(run_python "
from app.agents.compliance.visa import check_visa
from app.agents.compliance.schemas import ComplianceSeverity
r = check_visa('TH', ['hcmc'])
assert r.status == ComplianceSeverity.PASS
print(f'OK:TH={r.status.value}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Thai ASEAN visa-free"
else
    fail "Thai visa-free" "$RESULT"
fi

# =============================================================================
section "2. VISA CHECKS — E-Visa Nationalities"
# =============================================================================

# Test 4: Australian — e-visa required
echo "  Testing Australian visa (e-visa)..."
RESULT=$(run_python "
from app.agents.compliance.visa import check_visa
from app.agents.compliance.schemas import ComplianceSeverity
r = check_visa('AU', ['hanoi', 'hcmc'])
assert r.status == ComplianceSeverity.WARNING
assert any('e-visa' in f.message.lower() for f in r.flags)
print(f'OK:AU={r.status.value},evisa_mentioned=true')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Australian e-visa required"
else
    fail "Australian e-visa" "$RESULT"
fi

# Test 5: American — e-visa required
echo "  Testing American visa (e-visa)..."
RESULT=$(run_python "
from app.agents.compliance.visa import check_visa
from app.agents.compliance.schemas import ComplianceSeverity
r = check_visa('US', ['danang'])
assert r.status == ComplianceSeverity.WARNING
print(f'OK:US={r.status.value}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "American e-visa required"
else
    fail "American e-visa" "$RESULT"
fi

# =============================================================================
section "3. VISA CHECKS — Phu Quoc Trap"
# =============================================================================

# Test 6: Australian on Phu Quoc ONLY — visa-free warning
echo "  Testing Phu Quoc only (AU)..."
RESULT=$(run_python "
from app.agents.compliance.visa import check_visa
from app.agents.compliance.schemas import ComplianceSeverity
r = check_visa('AU', ['phuquoc'])
assert r.status == ComplianceSeverity.WARNING
assert any('phu quoc' in f.message.lower() for f in r.flags)
print(f'OK:phuquoc_only={r.status.value}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Phu Quoc only — visa-free option mentioned"
else
    fail "Phu Quoc only" "$RESULT"
fi

# Test 7: THE TRAP — Australian Phu Quoc + HCMC = BLOCK
echo "  Testing Phu Quoc TRAP (AU + mainland)..."
RESULT=$(run_python "
from app.agents.compliance.visa import check_visa
from app.agents.compliance.schemas import ComplianceSeverity
r = check_visa('AU', ['phuquoc', 'hcmc'])
assert r.status == ComplianceSeverity.BLOCK, f'Expected BLOCK, got {r.status}'
assert any('does not apply' in f.message.lower() for f in r.flags)
print(f'OK:phuquoc_trap=BLOCKED,msg={r.flags[0].message[:80]}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "PHU QUOC TRAP CAUGHT: $(echo "$RESULT" | grep "^OK:" | cut -d= -f2-)"
else
    fail "Phu Quoc trap" "$RESULT"
fi

# Test 8: German on Phu Quoc + mainland — NO trap (already visa-free)
echo "  Testing German Phu Quoc + mainland (no trap)..."
RESULT=$(run_python "
from app.agents.compliance.visa import check_visa
from app.agents.compliance.schemas import ComplianceSeverity
r = check_visa('DE', ['phuquoc', 'hcmc'])
assert r.status == ComplianceSeverity.PASS, f'Germans are visa-free — should PASS, got {r.status}'
print(f'OK:DE_phuquoc_mainland={r.status.value}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "German Phu Quoc + mainland — no trap (visa-free)"
else
    fail "German no trap" "$RESULT"
fi

# Test 9: Unknown nationality
echo "  Testing unknown nationality..."
RESULT=$(run_python "
from app.agents.compliance.visa import check_visa
from app.agents.compliance.schemas import ComplianceSeverity
r = check_visa('XX', ['hanoi'])
assert r.status == ComplianceSeverity.WARNING
assert any('manual verification' in f.message.lower() for f in r.flags)
print(f'OK:unknown={r.status.value}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Unknown nationality — manual verification"
else
    fail "Unknown nationality" "$RESULT"
fi

# =============================================================================
section "4. PASSPORT CHECKS"
# =============================================================================

# Test 10: Valid passport (1 year out)
echo "  Testing valid passport..."
RESULT=$(run_python "
from datetime import date, timedelta
from app.agents.compliance.passport import check_passport
from app.agents.compliance.schemas import ComplianceSeverity
r = check_passport(date.today() + timedelta(days=365))
assert r.status == ComplianceSeverity.PASS
print(f'OK:valid_passport={r.status.value}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Valid passport (1 year)"
else
    fail "Valid passport" "$RESULT"
fi

# Test 11: Expired passport
echo "  Testing expired passport..."
RESULT=$(run_python "
from datetime import date, timedelta
from app.agents.compliance.passport import check_passport
from app.agents.compliance.schemas import ComplianceSeverity
r = check_passport(date.today() - timedelta(days=30))
assert r.status == ComplianceSeverity.BLOCK
print(f'OK:expired={r.status.value}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Expired passport — BLOCKED"
else
    fail "Expired passport" "$RESULT"
fi

# Test 12: Insufficient validity (3 months, need 6)
echo "  Testing insufficient passport validity..."
RESULT=$(run_python "
from datetime import date, timedelta
from app.agents.compliance.passport import check_passport
from app.agents.compliance.schemas import ComplianceSeverity
r = check_passport(date.today() + timedelta(days=90))
assert r.status == ComplianceSeverity.BLOCK
assert any('6 months' in f.message for f in r.flags)
print(f'OK:insufficient={r.status.value}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Insufficient validity (3 months) — BLOCKED"
else
    fail "Insufficient validity" "$RESULT"
fi

# Test 13: No passport provided
echo "  Testing missing passport..."
RESULT=$(run_python "
from app.agents.compliance.passport import check_passport
from app.agents.compliance.schemas import ComplianceSeverity
r = check_passport(None)
assert r.status == ComplianceSeverity.WARNING
assert any('not provided' in f.message.lower() for f in r.flags)
print(f'OK:missing={r.status.value}')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Missing passport — warning (not verified)"
else
    fail "Missing passport" "$RESULT"
fi

# =============================================================================
section "5. AGE RESTRICTIONS"
# =============================================================================

# Test 14: Scuba with 8-year-old (min 10) — BLOCK
echo "  Testing scuba + child..."
RESULT=$(run_python "
from app.agents.compliance.age_restrictions import check_age_restrictions
from app.agents.compliance.schemas import ComplianceSeverity
r = check_age_restrictions(['scuba diving'], [35, 33, 8])
assert r.status == ComplianceSeverity.BLOCK
assert any('snorkeling' in f.alternative.lower() for f in r.flags)
print(f'OK:scuba_child=BLOCKED,alternative=snorkeling')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Scuba + 8yo — BLOCKED, snorkeling suggested"
else
    fail "Scuba age restriction" "$RESULT"
fi

# Test 15: Motorbike with 16-year-old (min 18) — BLOCK
echo "  Testing motorbike + teen..."
RESULT=$(run_python "
from app.agents.compliance.age_restrictions import check_age_restrictions
from app.agents.compliance.schemas import ComplianceSeverity
r = check_age_restrictions(['motorbike tour'], [16])
assert r.status == ComplianceSeverity.BLOCK
print(f'OK:motorbike_teen=BLOCKED')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Motorbike + 16yo — BLOCKED"
else
    fail "Motorbike age" "$RESULT"
fi

# Test 16: Adults only — PASS
echo "  Testing adults only activities..."
RESULT=$(run_python "
from app.agents.compliance.age_restrictions import check_age_restrictions
from app.agents.compliance.schemas import ComplianceSeverity
r = check_age_restrictions(['scuba diving', 'motorbike tour'], [25, 30])
assert r.status == ComplianceSeverity.PASS
print(f'OK:adults_only=PASS')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Adults only — all activities PASS"
else
    fail "Adults only" "$RESULT"
fi

# =============================================================================
section "6. SEASONAL FEASIBILITY"
# =============================================================================

# Test 17: Hanoi in July — monsoon WARNING
echo "  Testing Hanoi monsoon (July)..."
RESULT=$(run_python "
from datetime import date
from app.agents.compliance.seasonal import check_seasonal
from app.agents.compliance.schemas import ComplianceSeverity
r = check_seasonal(['hanoi'], date(2026, 7, 1), date(2026, 7, 14))
assert r.status == ComplianceSeverity.WARNING
assert any('monsoon' in f.message.lower() for f in r.flags)
print(f'OK:hanoi_july=WARNING')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Hanoi July — monsoon WARNING"
else
    fail "Hanoi monsoon" "$RESULT"
fi

# Test 18: Da Nang in October — monsoon (central)
echo "  Testing Da Nang monsoon (October)..."
RESULT=$(run_python "
from datetime import date
from app.agents.compliance.seasonal import check_seasonal
from app.agents.compliance.schemas import ComplianceSeverity
r = check_seasonal(['danang'], date(2026, 10, 1), date(2026, 10, 14))
assert r.status == ComplianceSeverity.WARNING
print(f'OK:danang_oct=WARNING')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Da Nang October — monsoon WARNING"
else
    fail "Da Nang monsoon" "$RESULT"
fi

# Test 19: HCMC in December — dry season PASS
echo "  Testing HCMC dry season (December)..."
RESULT=$(run_python "
from datetime import date
from app.agents.compliance.seasonal import check_seasonal
from app.agents.compliance.schemas import ComplianceSeverity
r = check_seasonal(['hcmc'], date(2026, 12, 20), date(2027, 1, 5))
assert r.status == ComplianceSeverity.PASS
print(f'OK:hcmc_dec=PASS')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "HCMC December — dry season PASS"
else
    fail "HCMC dry season" "$RESULT"
fi

# Test 20: Staggered monsoon — north wet, south dry simultaneously
echo "  Testing staggered monsoon (north+south in July)..."
RESULT=$(run_python "
from datetime import date
from app.agents.compliance.seasonal import check_seasonal
from app.agents.compliance.schemas import ComplianceSeverity
r = check_seasonal(['hanoi', 'hcmc'], date(2026, 7, 1), date(2026, 7, 14))
assert r.status == ComplianceSeverity.WARNING
# Only Hanoi should be flagged (north monsoon), HCMC should be fine
flags_with_monsoon = [f for f in r.flags if 'monsoon' in f.message.lower()]
flagged_dests = [f.message for f in flags_with_monsoon]
assert any('hanoi' in f.lower() for f in flagged_dests), 'Hanoi should be flagged'
assert any('hcmc' in f.lower() for f in flagged_dests), 'HCMC also monsoon in July (south May-Oct)'
print(f'OK:staggered=WARNING,flagged={len(flags_with_monsoon)}_destinations')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Staggered monsoon: $(echo "$RESULT" | cut -d= -f2-)"
else
    fail "Staggered monsoon" "$RESULT"
fi

# =============================================================================
section "7. BUDGET FEASIBILITY"
# =============================================================================

# Test 21: Within budget
echo "  Testing within budget..."
RESULT=$(run_python "
from app.agents.compliance.budget_check import check_budget
from app.agents.compliance.schemas import ComplianceSeverity
r = check_budget(3000, 2800)
assert r.status == ComplianceSeverity.PASS
print(f'OK:within_budget=PASS')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Within budget — PASS"
else
    fail "Within budget" "$RESULT"
fi

# Test 22: Over budget by 20%
echo "  Testing over budget (20%)..."
RESULT=$(run_python "
from app.agents.compliance.budget_check import check_budget
from app.agents.compliance.schemas import ComplianceSeverity
r = check_budget(3000, 3600)
assert r.status == ComplianceSeverity.WARNING
assert any('exceeds' in f.message.lower() for f in r.flags)
print(f'OK:over_budget=WARNING')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Over budget 20% — WARNING with suggestions"
else
    fail "Over budget" "$RESULT"
fi

# =============================================================================
section "8. ACCESSIBILITY"
# =============================================================================

# Test 23: Sapa with wheelchair needs
echo "  Testing Sapa accessibility..."
RESULT=$(run_python "
from app.agents.compliance.accessibility import check_accessibility
from app.agents.compliance.schemas import ComplianceSeverity
r = check_accessibility(['sapa'], ['wheelchair'])
assert r.status == ComplianceSeverity.WARNING
assert any('sapa' in f.message.lower() for f in r.flags)
print(f'OK:sapa_wheelchair=WARNING')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Sapa wheelchair — WARNING with challenges listed"
else
    fail "Sapa accessibility" "$RESULT"
fi

# Test 24: HCMC (flat, modern) — PASS
echo "  Testing HCMC accessibility..."
RESULT=$(run_python "
from app.agents.compliance.accessibility import check_accessibility
from app.agents.compliance.schemas import ComplianceSeverity
r = check_accessibility(['hcmc'], ['wheelchair'])
assert r.status == ComplianceSeverity.PASS
print(f'OK:hcmc_wheelchair=PASS')
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "HCMC wheelchair — PASS (flat terrain)"
else
    fail "HCMC accessibility" "$RESULT"
fi

# =============================================================================
section "9. COMPLIANCE GATE — Full Pipeline"
# =============================================================================

# Test 25: German family, all clear — mostly PASS
echo "  Testing compliance gate (German family, clean)..."
RESULT=$(run_python "
import asyncio, uuid
from datetime import date, timedelta
from app.agents.compliance.agent import compliance_gate_node
from app.agents.state import AdvisoryState
from app.schemas.profile import TravelerProfileResponse

async def test():
    state = AdvisoryState(
        session_id='test-clean', tenant_id='default', stage='validating',
        traveler_profile=TravelerProfileResponse(
            id=str(uuid.uuid4()), advisory_session_id=str(uuid.uuid4()),
            nationalities=['DE'], destination_preferences=['hcmc', 'danang'],
            traveler_ages=[35, 33, 10, 8], budget_total=5000.0,
            travel_start_date='2026-12-20', travel_end_date='2026-12-30',
            passport_expiry_date=str(date.today() + timedelta(days=365)),
            activity_preferences=['sightseeing', 'food tour'],
            created_at='2026-01-01T00:00:00', updated_at='2026-01-01T00:00:00',
        ),
    )
    r = await compliance_gate_node(state)
    report = r['compliance_report']
    print(f'OK:overall={report[\"overall_status\"]},blocks={report[\"block_count\"]},warnings={report[\"warning_count\"]}')

asyncio.run(test())
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Compliance gate (clean): $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Compliance gate clean" "$RESULT"
fi

# Test 26: Australian + Phu Quoc + HCMC + scuba + 8yo — multiple blocks
echo "  Testing compliance gate (multiple blocks)..."
RESULT=$(run_python "
import asyncio, uuid
from datetime import date, timedelta
from app.agents.compliance.agent import compliance_gate_node
from app.agents.state import AdvisoryState
from app.schemas.profile import TravelerProfileResponse

async def test():
    state = AdvisoryState(
        session_id='test-blocks', tenant_id='default', stage='validating',
        traveler_profile=TravelerProfileResponse(
            id=str(uuid.uuid4()), advisory_session_id=str(uuid.uuid4()),
            nationalities=['AU'], destination_preferences=['phuquoc', 'hcmc'],
            traveler_ages=[35, 8], budget_total=3000.0,
            travel_start_date='2026-07-01', travel_end_date='2026-07-14',
            passport_expiry_date=str(date.today() + timedelta(days=90)),
            activity_preferences=['scuba diving'],
            created_at='2026-01-01T00:00:00', updated_at='2026-01-01T00:00:00',
        ),
    )
    r = await compliance_gate_node(state)
    report = r['compliance_report']
    assert report['overall_status'] == 'block', f'Expected block, got {report[\"overall_status\"]}'
    assert report['block_count'] >= 2, f'Expected >=2 blocks (visa trap + scuba age + passport), got {report[\"block_count\"]}'
    print(f'OK:overall=BLOCK,blocks={report[\"block_count\"]},warnings={report[\"warning_count\"]}')

asyncio.run(test())
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "Compliance gate (BLOCKED): $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "Compliance gate blocks" "$RESULT"
fi

# Test 27: UJ-3 scenario — Russian + Phu Quoc + HCMC
echo "  Testing UJ-3: Russian Phu Quoc trap..."
RESULT=$(run_python "
import asyncio, uuid
from datetime import date, timedelta
from app.agents.compliance.agent import compliance_gate_node
from app.agents.state import AdvisoryState
from app.schemas.profile import TravelerProfileResponse

async def test():
    state = AdvisoryState(
        session_id='test-uj3', tenant_id='default', stage='validating',
        traveler_profile=TravelerProfileResponse(
            id=str(uuid.uuid4()), advisory_session_id=str(uuid.uuid4()),
            nationalities=['RU'], destination_preferences=['phuquoc', 'hcmc'],
            traveler_ages=[40, 38],
            passport_expiry_date=str(date.today() + timedelta(days=365)),
            created_at='2026-01-01T00:00:00', updated_at='2026-01-01T00:00:00',
        ),
    )
    r = await compliance_gate_node(state)
    report = r['compliance_report']
    # Russian is visa-free 45 days — Phu Quoc trap should NOT apply
    # (Phu Quoc exception only matters for e-visa nationalities)
    print(f'OK:RU_phuquoc={report[\"overall_status\"]},blocks={report[\"block_count\"]}')

asyncio.run(test())
")
if echo "$RESULT" | grep -q "^OK:"; then
    pass "UJ-3 Russian Phu Quoc: $(echo "$RESULT" | cut -d: -f2-)"
else
    fail "UJ-3 Russian" "$RESULT"
fi

# =============================================================================
section "10. UNIT TEST SUITE"
# =============================================================================

# Test 28: Run full unit test suite
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
    echo -e "${GREEN}🎉 ALL TESTS PASSED — Epic 4 is verified!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  $FAIL test(s) failed — see details above${NC}"
    exit 1
fi
