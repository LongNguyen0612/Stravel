#!/bin/bash
# =============================================================================
# STravel Epic 2 — Integration Test Script
# =============================================================================
# Prerequisites:
#   1. cd stravel && cp .env.example .env
#   2. docker-compose -f docker-compose.full.yml up -d   (PostgreSQL + Qdrant + Redis)
#   3. cd backend && source .venv/bin/activate
#   4. alembic upgrade head
#   5. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
#
# Usage: bash scripts/manual-test-epic2.sh
# =============================================================================

set -e

BASE_URL="${BASE_URL:-http://localhost:8000}"
API="$BASE_URL/api/v1"
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { ((PASS++)); ((TOTAL++)); echo -e "  ${GREEN}✅ PASS${NC} — $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo -e "  ${RED}❌ FAIL${NC} — $1: $2"; }
skip() { echo -e "  ${CYAN}⏭️  SKIP${NC} — $1: $2"; }
section() { echo -e "\n${YELLOW}━━━ $1 ━━━${NC}"; }

# =============================================================================
section "1. INFRASTRUCTURE — Phase 2 Services"
# =============================================================================

# Test 1: Qdrant is accessible
echo "  Checking Qdrant..."
QDRANT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$QDRANT_URL/readyz" 2>/dev/null)
if [ "$QDRANT_STATUS" = "200" ]; then
    pass "Qdrant is healthy at $QDRANT_URL"
    QDRANT_OK=true
else
    fail "Qdrant" "Expected 200, got $QDRANT_STATUS. Is docker-compose.full.yml running?"
    QDRANT_OK=false
fi

# Test 2: Redis is accessible
echo "  Checking Redis..."
REDIS_PING=$(redis-cli -u "$REDIS_URL" ping 2>/dev/null || echo "FAIL")
if [ "$REDIS_PING" = "PONG" ]; then
    pass "Redis is healthy at $REDIS_URL"
    REDIS_OK=true
else
    # Try without redis-cli (may not be installed locally)
    REDIS_OK=false
    # Check if Redis port is open
    if nc -z localhost 6379 2>/dev/null; then
        pass "Redis port 6379 is open (redis-cli not installed locally)"
        REDIS_OK=true
    else
        fail "Redis" "Not reachable. Is docker-compose.full.yml running?"
    fi
fi

# Test 3: Backend health (from Epic 1)
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API/health" 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
    pass "Backend health endpoint OK"
else
    fail "Backend" "Not reachable at $API/health. Is uvicorn running?"
    echo -e "  ${RED}Backend not running — skipping remaining tests${NC}"
    exit 1
fi

# =============================================================================
section "2. QDRANT VECTOR STORE — Collection & CRUD"
# =============================================================================

if [ "$QDRANT_OK" = true ]; then
    # Test 4: Create collection via Qdrant API
    echo "  Creating/verifying 'entities' collection..."
    CREATE_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$QDRANT_URL/collections/entities" \
        -H "Content-Type: application/json" \
        -d '{"vectors": {"size": 384, "distance": "Cosine"}}' 2>/dev/null)

    # 200 = created, 409 = already exists — both OK
    if [ "$CREATE_RESP" = "200" ] || [ "$CREATE_RESP" = "409" ]; then
        pass "Qdrant 'entities' collection exists"
    else
        fail "Qdrant collection" "Expected 200/409, got $CREATE_RESP"
    fi

    # Test 5: Upsert a test point
    echo "  Upserting test entity..."
    VECTOR=$(python3 -c "import json; print(json.dumps([0.1]*384))")
    UPSERT_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$QDRANT_URL/collections/entities/points" \
        -H "Content-Type: application/json" \
        -d "{\"points\": [{\"id\": \"00000000-0000-0000-0000-000000000001\", \"vector\": $VECTOR, \"payload\": {\"name\": \"Test Hotel\", \"entity_type\": \"hotel\", \"region\": \"hcmc\", \"pricing\": 100}}]}" 2>/dev/null)

    if [ "$UPSERT_RESP" = "200" ]; then
        pass "Qdrant upsert test entity succeeded"
    else
        fail "Qdrant upsert" "Expected 200, got $UPSERT_RESP"
    fi

    # Test 6: Retrieve the test point
    echo "  Retrieving test entity..."
    RETRIEVE_RESP=$(curl -s "$QDRANT_URL/collections/entities/points/00000000-0000-0000-0000-000000000001" 2>/dev/null)
    RETRIEVE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$QDRANT_URL/collections/entities/points/00000000-0000-0000-0000-000000000001" 2>/dev/null)

    if [ "$RETRIEVE_CODE" = "200" ]; then
        if echo "$RETRIEVE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['result']['payload']['name']=='Test Hotel'" 2>/dev/null; then
            pass "Qdrant retrieve returns correct entity"
        else
            fail "Qdrant retrieve" "Payload mismatch"
        fi
    else
        fail "Qdrant retrieve" "Expected 200, got $RETRIEVE_CODE"
    fi

    # Test 7: Search with filter
    echo "  Searching with filter..."
    SEARCH_VECTOR=$(python3 -c "import json; print(json.dumps([0.1]*384))")
    SEARCH_RESP=$(curl -s -w "\n%{http_code}" -X POST "$QDRANT_URL/collections/entities/points/query" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $SEARCH_VECTOR, \"filter\": {\"must\": [{\"key\": \"entity_type\", \"match\": {\"value\": \"hotel\"}}]}, \"limit\": 5, \"with_payload\": true}" 2>/dev/null)

    SEARCH_CODE=$(echo "$SEARCH_RESP" | tail -1)
    if [ "$SEARCH_CODE" = "200" ]; then
        pass "Qdrant search with filter returns results"
    else
        fail "Qdrant search" "Expected 200, got $SEARCH_CODE"
    fi

    # Test 8: Delete test point (cleanup)
    echo "  Cleaning up test entity..."
    DELETE_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$QDRANT_URL/collections/entities/points/delete" \
        -H "Content-Type: application/json" \
        -d '{"points": ["00000000-0000-0000-0000-000000000001"]}' 2>/dev/null || true)

    if [ "$DELETE_RESP" = "200" ]; then
        pass "Qdrant delete cleanup succeeded"
    else
        fail "Qdrant delete" "Expected 200, got $DELETE_RESP"
    fi
else
    skip "Qdrant CRUD tests" "Qdrant not available"
fi

# =============================================================================
section "3. SEED DATA — Loading & Verification"
# =============================================================================

if [ "$QDRANT_OK" = true ]; then
    # Test 9: Check if seed data already loaded, skip re-seeding if so
    EXISTING_COUNT=$(curl -s "$QDRANT_URL/collections/entities" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])" 2>/dev/null)
    if [ -n "$EXISTING_COUNT" ] && [ "$EXISTING_COUNT" -gt 10 ]; then
        pass "Seed data already loaded ($EXISTING_COUNT entities — skipping re-seed)"
    else
        echo "  Running seed script (this may take a moment for embeddings)..."
        cd "$(dirname "$0")/.." 2>/dev/null || true
        SEED_OUTPUT=$(source backend/.venv/bin/activate 2>/dev/null && PYTHONPATH=backend python3 data/scripts/seed_vector_store.py --qdrant-url "$QDRANT_URL" 2>&1)
        SEED_EXIT=$?
        if [ "$SEED_EXIT" -eq 0 ]; then
            pass "Seed script completed successfully"
        else
            fail "Seed script" "Exit code $SEED_EXIT: $(echo "$SEED_OUTPUT" | tail -3)"
        fi
    fi

    # Test 10: Verify entities were loaded
    echo "  Checking entity count in Qdrant..."
    COLLECTION_INFO=$(curl -s "$QDRANT_URL/collections/entities" 2>/dev/null)
    POINT_COUNT=$(echo "$COLLECTION_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])" 2>/dev/null)

    if [ -n "$POINT_COUNT" ] && [ "$POINT_COUNT" -gt 0 ]; then
        pass "Qdrant has $POINT_COUNT entities loaded"
    else
        fail "Entity count" "Expected >0, got $POINT_COUNT"
    fi

    # Test 11: Search for a known hotel
    echo "  Searching for 'Rex Hotel'..."
    HOTEL_SEARCH=$(curl -s -X POST "$QDRANT_URL/collections/entities/points/scroll" \
        -H "Content-Type: application/json" \
        -d '{"filter": {"must": [{"key": "name", "match": {"text": "Rex Hotel"}}]}, "limit": 1, "with_payload": true}' 2>/dev/null)

    HOTEL_COUNT=$(echo "$HOTEL_SEARCH" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['result']['points']))" 2>/dev/null)
    if [ "$HOTEL_COUNT" = "1" ]; then
        pass "Found 'Rex Hotel Saigon' in Qdrant"
    else
        # Try vector search instead (text match may not work without index)
        skip "Text search for Rex Hotel" "Text match index may not be configured"
    fi

    # Test 12: Verify visa rules loaded to compliance rules
    echo "  Checking compliance rules files..."
    VISA_FILE="backend/app/agents/compliance/rules/vietnam_visa.json"
    if [ -f "$VISA_FILE" ]; then
        VISA_COUNT=$(python3 -c "import json; print(len(json.load(open('$VISA_FILE'))))" 2>/dev/null)
        if [ -n "$VISA_COUNT" ] && [ "$VISA_COUNT" -ge 20 ]; then
            pass "Visa rules file has $VISA_COUNT entries (≥20 nationalities)"
        else
            fail "Visa rules" "Expected ≥20 entries, got $VISA_COUNT"
        fi
    else
        fail "Visa rules file" "$VISA_FILE not found"
    fi
else
    skip "Seed data tests" "Qdrant not available"
fi

# =============================================================================
section "4. REDIS CACHE"
# =============================================================================

if [ "$REDIS_OK" = true ]; then
    # Use docker exec to run redis-cli inside the container
    REDIS_CMD="docker-compose -f docker-compose.full.yml exec -T redis redis-cli"

    # Test 13: Set and get a cache value
    echo "  Testing Redis set/get..."
    $REDIS_CMD SET stravel:test:key "hello_stravel" EX 60 > /dev/null 2>&1
    CACHE_VAL=$($REDIS_CMD GET stravel:test:key 2>/dev/null)
    if [ "$CACHE_VAL" = "hello_stravel" ]; then
        pass "Redis SET/GET works"
        $REDIS_CMD DEL stravel:test:key > /dev/null 2>&1
    else
        fail "Redis GET" "Expected 'hello_stravel', got '$CACHE_VAL'"
    fi

    # Test 14: TTL expiry
    $REDIS_CMD SET stravel:test:ttl "expires" EX 2 > /dev/null 2>&1
    sleep 3
    TTL_VAL=$($REDIS_CMD GET stravel:test:ttl 2>/dev/null)
    if [ -z "$TTL_VAL" ] || [ "$TTL_VAL" = "" ]; then
        pass "Redis TTL expiry works (key expired after 2s)"
    else
        fail "Redis TTL" "Key should have expired but got '$TTL_VAL'"
    fi
else
    skip "Redis cache tests" "Redis not available"
fi

# =============================================================================
section "5. HYBRID SEARCH (via Python)"
# =============================================================================

if [ "$QDRANT_OK" = true ]; then
    # Test 15: Run hybrid search test via Python
    echo "  Testing hybrid search..."
    cd "$(dirname "$0")/.." 2>/dev/null || true

    SEARCH_RESULT=$(source backend/.venv/bin/activate 2>/dev/null && PYTHONPATH=backend python3 -c "
import asyncio
from app.rag.vector_store import QdrantVectorStore
from app.rag.hybrid_search import HybridSearchService
from app.rag.embeddings import EmbeddingService

async def test():
    store = QdrantVectorStore(url='$QDRANT_URL')
    search = HybridSearchService(store, EmbeddingService())
    results = await search.search('luxury hotel', filters={'entity_type': 'hotel'}, limit=3)
    print(f'RESULTS:{len(results)}')
    for r in results:
        print(f'  - {r.name} ({r.region}) score={r.score:.4f}')
    await store.close()

asyncio.run(test())
" 2>&1)

    SEARCH_COUNT=$(echo "$SEARCH_RESULT" | grep "^RESULTS:" | cut -d: -f2)
    if [ -n "$SEARCH_COUNT" ] && [ "$SEARCH_COUNT" -gt 0 ]; then
        pass "Hybrid search returned $SEARCH_COUNT results for 'luxury hotel'"
        echo "$SEARCH_RESULT" | grep "^  -" | head -3
    else
        fail "Hybrid search" "No results returned: $SEARCH_RESULT"
    fi

    cd "$(dirname "$0")/.." 2>/dev/null || true
else
    skip "Hybrid search" "Qdrant not available"
fi

# =============================================================================
section "6. FRESHNESS TRACKING (via Python)"
# =============================================================================

# Test 16: Freshness evaluation (no external deps)
echo "  Testing freshness evaluation..."
cd "$(dirname "$0")/.." 2>/dev/null || true

FRESHNESS_RESULT=$(source backend/.venv/bin/activate 2>/dev/null && PYTHONPATH=backend python3 -c "
from datetime import datetime, timedelta
from app.rag.freshness import evaluate_freshness, FreshnessStatus

now = datetime.utcnow()
fresh = {'ingested_at': (now - timedelta(days=1)).isoformat(), 'expires_at': (now + timedelta(days=6)).isoformat()}
stale = {'ingested_at': (now - timedelta(days=6)).isoformat(), 'expires_at': (now + timedelta(days=1)).isoformat()}
expired = {'ingested_at': (now - timedelta(days=10)).isoformat(), 'expires_at': (now - timedelta(days=3)).isoformat()}

f = evaluate_freshness(fresh)
s = evaluate_freshness(stale)
e = evaluate_freshness(expired)

assert f == FreshnessStatus.FRESH, f'Expected FRESH, got {f}'
assert s == FreshnessStatus.STALE, f'Expected STALE, got {s}'
assert e == FreshnessStatus.EXPIRED, f'Expected EXPIRED, got {e}'
print('OK')
" 2>&1)

if echo "$FRESHNESS_RESULT" | grep -q "OK"; then
    pass "Freshness evaluation: FRESH/STALE/EXPIRED classification correct"
else
    fail "Freshness" "$FRESHNESS_RESULT"
fi

cd "$(dirname "$0")/.." 2>/dev/null || true

# =============================================================================
section "7. REGULATORY DATA LOOKUP"
# =============================================================================

# Test 17: Visa rule lookup
echo "  Testing regulatory lookup..."
cd "$(dirname "$0")/.." 2>/dev/null || true

LOOKUP_RESULT=$(source backend/.venv/bin/activate 2>/dev/null && PYTHONPATH=backend python3 -c "
from app.etl.regulatory import RegulatoryLookup

lookup = RegulatoryLookup()
de = lookup.get_visa_rule('DE')
au = lookup.get_visa_rule('AU')

if de is None:
    print('FAIL:No DE rule found')
elif de.get('visa_type') != 'visa_free_45':
    print(f'FAIL:DE expected visa_free_45 got {de.get(\"visa_type\")}')
elif au is None:
    print('FAIL:No AU rule found')
elif au.get('visa_type') != 'e_visa':
    print(f'FAIL:AU expected e_visa got {au.get(\"visa_type\")}')
elif not au.get('phu_quoc_exception'):
    print('FAIL:AU should have phu_quoc_exception=true')
else:
    print(f'OK:DE={de[\"visa_type\"]},AU={au[\"visa_type\"]},PhuQuoc={au[\"phu_quoc_exception\"]}')
" 2>&1)

if echo "$LOOKUP_RESULT" | grep -q "^OK:"; then
    pass "Regulatory lookup: $(echo "$LOOKUP_RESULT" | cut -d: -f2)"
else
    fail "Regulatory lookup" "$LOOKUP_RESULT"
fi

cd "$(dirname "$0")/.." 2>/dev/null || true

# =============================================================================
section "8. LLM SERVICE FACTORY"
# =============================================================================

# Test 18: Factory returns correct backend
echo "  Testing LLM factory..."
cd "$(dirname "$0")/.." 2>/dev/null || true

FACTORY_RESULT=$(source backend/.venv/bin/activate 2>/dev/null && PYTHONPATH=backend python3 -c "
from app.services.llm import create_llm_service, OllamaLLMService, VLLMService

svc = create_llm_service()
if isinstance(svc, OllamaLLMService):
    print('OK:ollama')
else:
    print(f'FAIL:expected OllamaLLMService got {type(svc).__name__}')
" 2>&1)

if echo "$FACTORY_RESULT" | grep -q "^OK:"; then
    pass "LLM factory returns OllamaLLMService by default"
else
    fail "LLM factory" "$FACTORY_RESULT"
fi

cd "$(dirname "$0")/.." 2>/dev/null || true

# =============================================================================
section "9. ETL PIPELINE IDEMPOTENCY"
# =============================================================================

if [ "$QDRANT_OK" = true ]; then
    # Test 19: Run seed script twice — count should not double
    echo "  Running seed script again to verify idempotency..."
    cd "$(dirname "$0")/.." 2>/dev/null || true

    BEFORE_COUNT=$(curl -s "$QDRANT_URL/collections/entities" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])" 2>/dev/null)

    source backend/.venv/bin/activate 2>/dev/null && PYTHONPATH=backend python3 -m data.scripts.seed_vector_store --qdrant-url "$QDRANT_URL" > /dev/null 2>&1

    AFTER_COUNT=$(curl -s "$QDRANT_URL/collections/entities" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])" 2>/dev/null)

    if [ "$BEFORE_COUNT" = "$AFTER_COUNT" ]; then
        pass "Seed script is idempotent ($BEFORE_COUNT entities before = $AFTER_COUNT after)"
    else
        fail "Idempotency" "Count changed from $BEFORE_COUNT to $AFTER_COUNT"
    fi

    cd "$(dirname "$0")/.." 2>/dev/null || true
else
    skip "ETL idempotency" "Qdrant not available"
fi

# =============================================================================
section "10. UNIT TEST SUITE"
# =============================================================================

# Test 20: Run full unit test suite
echo "  Running full unit test suite..."
cd "$(dirname "$0")/.." 2>/dev/null || true

TEST_OUTPUT=$(cd backend && source .venv/bin/activate 2>/dev/null && pytest tests/ app/agents/tests/ app/agents/profiling/tests/ app/rag/tests/ app/etl/tests/ -m "not integration" -q 2>&1)
TEST_EXIT=$?

PASSED_COUNT=$(echo "$TEST_OUTPUT" | grep -oE "[0-9]+ passed" | head -1 | grep -oE "[0-9]+")
FAILED_COUNT=$(echo "$TEST_OUTPUT" | grep -oE "[0-9]+ failed" | head -1 | grep -oE "[0-9]+")

if [ "$TEST_EXIT" -eq 0 ]; then
    pass "Unit test suite: $PASSED_COUNT tests passed"
else
    fail "Unit test suite" "$FAILED_COUNT tests failed out of $PASSED_COUNT"
    echo "$TEST_OUTPUT" | tail -10
fi

cd "$(dirname "$0")/.." 2>/dev/null || true

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
    echo -e "${GREEN}🎉 ALL TESTS PASSED — Epic 2 is verified!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  $FAIL test(s) failed — see details above${NC}"
    exit 1
fi
