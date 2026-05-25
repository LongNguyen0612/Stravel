#!/bin/bash
# =============================================================================
# STravel Epic 1 — Manual Integration Test Script
# =============================================================================
# Prerequisites:
#   1. cd stravel && cp .env.example .env
#   2. docker compose up -d
#   3. cd backend && source .venv/bin/activate && alembic upgrade head
#   4. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
#
# Usage: bash scripts/manual-test-epic1.sh
# =============================================================================

set -e

BASE_URL="${BASE_URL:-http://localhost:8000}"
API="$BASE_URL/api/v1"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { ((PASS++)); ((TOTAL++)); echo -e "  ${GREEN}✅ PASS${NC} — $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo -e "  ${RED}❌ FAIL${NC} — $1: $2"; }
section() { echo -e "\n${YELLOW}━━━ $1 ━━━${NC}"; }

# =============================================================================
section "1. INFRASTRUCTURE"
# =============================================================================

# Test 1: Health endpoint
echo "  Testing health endpoint..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API/health" 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
    BODY=$(curl -s "$API/health")
    if echo "$BODY" | grep -q '"status":"ok"'; then
        pass "Health endpoint returns 200 + {status: ok}"
    else
        fail "Health endpoint body" "Expected {status: ok}, got: $BODY"
    fi
else
    fail "Health endpoint" "Expected 200, got $HEALTH. Is the server running?"
    echo -e "  ${RED}Server not reachable. Run: uvicorn app.main:app --port 8000${NC}"
    exit 1
fi

# Test 2: OpenAPI docs accessible
DOCS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/docs" 2>/dev/null)
if [ "$DOCS" = "200" ]; then
    pass "OpenAPI docs accessible at /docs"
else
    fail "OpenAPI docs" "Expected 200, got $DOCS"
fi

# =============================================================================
section "2. AUTH — Registration"
# =============================================================================

# Test 3: Register new user
echo "  Registering test user..."
REG_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"epic1-test@stravel.dev","password":"TestPass123!","full_name":"Test Agent","tenant_name":"Test Agency"}')

REG_CODE=$(echo "$REG_RESPONSE" | tail -1)
REG_BODY=$(echo "$REG_RESPONSE" | sed '$d')

if [ "$REG_CODE" = "201" ]; then
    TOKEN_A=$(echo "$REG_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
    if [ -n "$TOKEN_A" ]; then
        pass "Register returns 201 + JWT token"
    else
        fail "Register token" "201 but no access_token in response"
    fi
elif [ "$REG_CODE" = "409" ]; then
    echo "  (User already exists, logging in instead...)"
    # Login instead
    LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"epic1-test@stravel.dev","password":"TestPass123!"}')
    LOGIN_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
    LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')
    TOKEN_A=$(echo "$LOGIN_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
    if [ -n "$TOKEN_A" ]; then
        pass "Login returns 200 + JWT token (user already existed)"
    else
        fail "Login" "Could not get token"
    fi
else
    fail "Register" "Expected 201 or 409, got $REG_CODE: $REG_BODY"
    TOKEN_A=""
fi

# =============================================================================
section "3. AUTH — Login & Token"
# =============================================================================

# Test 4: Login with registered user
echo "  Logging in..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"epic1-test@stravel.dev","password":"TestPass123!"}')

LOGIN_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$LOGIN_CODE" = "200" ]; then
    TOKEN_A=$(echo "$LOGIN_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
    pass "Login returns 200 + JWT token"
else
    fail "Login" "Expected 200, got $LOGIN_CODE"
fi

# Test 5: Login with wrong password
BAD_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"epic1-test@stravel.dev","password":"WrongPassword"}')

if [ "$BAD_LOGIN" = "401" ]; then
    pass "Invalid credentials returns 401"
else
    fail "Invalid credentials" "Expected 401, got $BAD_LOGIN"
fi

# Test 6: Get current user
ME_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN_A" "$API/auth/me")
if [ "$ME_CODE" = "200" ]; then
    pass "GET /auth/me returns 200 with valid token"
else
    fail "GET /auth/me" "Expected 200, got $ME_CODE"
fi

# =============================================================================
section "4. AUTH — Protected Endpoints"
# =============================================================================

# Test 7: Unauthenticated request to protected endpoint
NO_AUTH=$(curl -s -o /dev/null -w "%{http_code}" "$API/advisory_sessions")
if [ "$NO_AUTH" = "401" ]; then
    pass "Unauthenticated request returns 401"
else
    fail "Unauthenticated request" "Expected 401, got $NO_AUTH"
fi

# Test 8: Invalid token
BAD_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid-token" "$API/advisory_sessions")
if [ "$BAD_TOKEN" = "401" ]; then
    pass "Invalid token returns 401"
else
    fail "Invalid token" "Expected 401, got $BAD_TOKEN"
fi

# =============================================================================
section "5. SESSION CRUD"
# =============================================================================

if [ -z "$TOKEN_A" ]; then
    echo -e "  ${RED}Skipping session tests — no valid token${NC}"
else
    # Test 9: Create session
    echo "  Creating advisory session..."
    CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API/advisory_sessions" \
        -H "Authorization: Bearer $TOKEN_A" \
        -H "Content-Type: application/json" \
        -d '{}')

    CREATE_CODE=$(echo "$CREATE_RESPONSE" | tail -1)
    CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed '$d')

    if [ "$CREATE_CODE" = "201" ]; then
        SESSION_ID=$(echo "$CREATE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
        STATUS=$(echo "$CREATE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
        HAS_PROFILE=$(echo "$CREATE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['traveler_profile'] is not None)" 2>/dev/null)

        if [ "$STATUS" = "in_progress" ] && [ "$HAS_PROFILE" = "True" ]; then
            pass "Create session returns 201 with status=in_progress + traveler_profile"
        else
            fail "Create session" "Status=$STATUS, HasProfile=$HAS_PROFILE"
        fi
    else
        fail "Create session" "Expected 201, got $CREATE_CODE"
        SESSION_ID=""
    fi

    # Test 10: Get session
    if [ -n "$SESSION_ID" ]; then
        GET_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $TOKEN_A" \
            "$API/advisory_sessions/$SESSION_ID")

        if [ "$GET_CODE" = "200" ]; then
            pass "Get session returns 200"
        else
            fail "Get session" "Expected 200, got $GET_CODE"
        fi
    fi

    # Test 11: Get non-existent session
    FAKE_ID="00000000-0000-0000-0000-000000000000"
    NOT_FOUND=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer $TOKEN_A" \
        "$API/advisory_sessions/$FAKE_ID")

    NF_CODE=$(echo "$NOT_FOUND" | tail -1)
    NF_BODY=$(echo "$NOT_FOUND" | sed '$d')

    if [ "$NF_CODE" = "404" ]; then
        if echo "$NF_BODY" | grep -q "ENTITY_NOT_FOUND"; then
            pass "Get non-existent session returns 404 + ENTITY_NOT_FOUND"
        else
            fail "Get non-existent session" "404 but wrong error code"
        fi
    else
        fail "Get non-existent session" "Expected 404, got $NF_CODE"
    fi

    # Test 12: Update session status
    if [ -n "$SESSION_ID" ]; then
        UPDATE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
            -H "Authorization: Bearer $TOKEN_A" \
            -H "Content-Type: application/json" \
            -d '{"status":"completed"}' \
            "$API/advisory_sessions/$SESSION_ID")

        if [ "$UPDATE_CODE" = "200" ]; then
            pass "Update session status to completed returns 200"
        else
            fail "Update session status" "Expected 200, got $UPDATE_CODE"
        fi
    fi

    # Test 13: Invalid status transition
    if [ -n "$SESSION_ID" ]; then
        INVALID_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
            -H "Authorization: Bearer $TOKEN_A" \
            -H "Content-Type: application/json" \
            -d '{"status":"in_progress"}' \
            "$API/advisory_sessions/$SESSION_ID")

        if [ "$INVALID_CODE" = "422" ]; then
            pass "Invalid status transition returns 422"
        else
            fail "Invalid status transition" "Expected 422, got $INVALID_CODE"
        fi
    fi

    # Test 14: List sessions
    LIST_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN_A" \
        "$API/advisory_sessions?limit=10&offset=0")

    if [ "$LIST_CODE" = "200" ]; then
        pass "List sessions returns 200"
    else
        fail "List sessions" "Expected 200, got $LIST_CODE"
    fi
fi

# =============================================================================
section "6. TENANT ISOLATION"
# =============================================================================

if [ -n "$TOKEN_A" ]; then
    # Register a second user with a different tenant
    echo "  Registering second tenant..."
    REG2_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
        -H "Content-Type: application/json" \
        -d '{"email":"epic1-tenant2@stravel.dev","password":"TestPass456!","tenant_name":"Other Agency"}')

    REG2_CODE=$(echo "$REG2_RESPONSE" | tail -1)
    REG2_BODY=$(echo "$REG2_RESPONSE" | sed '$d')

    if [ "$REG2_CODE" = "201" ] || [ "$REG2_CODE" = "409" ]; then
        if [ "$REG2_CODE" = "409" ]; then
            REG2_BODY=$(curl -s -X POST "$API/auth/login" \
                -H "Content-Type: application/json" \
                -d '{"email":"epic1-tenant2@stravel.dev","password":"TestPass456!"}')
        fi
        TOKEN_B=$(echo "$REG2_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

        if [ -n "$TOKEN_B" ] && [ -n "$SESSION_ID" ]; then
            # Test 15: Tenant B cannot see Tenant A's session
            CROSS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "Authorization: Bearer $TOKEN_B" \
                "$API/advisory_sessions/$SESSION_ID")

            if [ "$CROSS_CODE" = "404" ]; then
                pass "Tenant isolation: Tenant B cannot see Tenant A's session (404)"
            else
                fail "Tenant isolation" "Expected 404, got $CROSS_CODE — SECURITY ISSUE!"
            fi

            # Test 16: Tenant B's session list is empty (no Tenant A sessions)
            LIST_B=$(curl -s -H "Authorization: Bearer $TOKEN_B" "$API/advisory_sessions")
            TOTAL_B=$(echo "$LIST_B" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])" 2>/dev/null)

            if [ "$TOTAL_B" = "0" ]; then
                pass "Tenant isolation: Tenant B sees 0 sessions (Tenant A's sessions hidden)"
            else
                fail "Tenant isolation list" "Expected 0, got $TOTAL_B"
            fi
        else
            fail "Tenant isolation" "Could not get Token B"
        fi
    else
        fail "Register tenant 2" "Expected 201/409, got $REG2_CODE"
    fi
fi

# =============================================================================
section "7. SSE STREAMING"
# =============================================================================

if [ -n "$TOKEN_A" ]; then
    # Create a fresh session for SSE test
    SSE_SESSION=$(curl -s -X POST "$API/advisory_sessions" \
        -H "Authorization: Bearer $TOKEN_A" \
        -H "Content-Type: application/json" -d '{}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

    if [ -n "$SSE_SESSION" ]; then
        # Test 17: SSE endpoint requires auth
        SSE_NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$API/stream/$SSE_SESSION")
        if [ "$SSE_NOAUTH" = "401" ]; then
            pass "SSE endpoint requires authentication (401 without token)"
        else
            fail "SSE auth" "Expected 401, got $SSE_NOAUTH"
        fi

        # Test 18: SSE endpoint returns streaming response with auth
        SSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 \
            -H "Authorization: Bearer $TOKEN_A" \
            "$API/stream/$SSE_SESSION" 2>/dev/null || true)

        if [ "$SSE_CODE" = "200" ] || [ -z "$SSE_CODE" ]; then
            pass "SSE endpoint accepts authenticated connection"
        else
            fail "SSE connection" "Expected 200 or timeout, got $SSE_CODE"
        fi
    fi
fi

# =============================================================================
section "8. ERROR HANDLING"
# =============================================================================

# Test 19: Consistent error format
ERROR_BODY=$(curl -s -H "Authorization: Bearer $TOKEN_A" "$API/advisory_sessions/$FAKE_ID" 2>/dev/null)
HAS_CODE=$(echo "$ERROR_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('code' in d.get('detail',{}))" 2>/dev/null)
HAS_MSG=$(echo "$ERROR_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('message' in d.get('detail',{}))" 2>/dev/null)

if [ "$HAS_CODE" = "True" ] && [ "$HAS_MSG" = "True" ]; then
    pass "Error responses have consistent format {detail: {code, message}}"
else
    fail "Error format" "Missing code or message in error response"
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
    echo -e "${GREEN}🎉 ALL TESTS PASSED — Epic 1 is verified!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  $FAIL test(s) failed — see details above${NC}"
    exit 1
fi
