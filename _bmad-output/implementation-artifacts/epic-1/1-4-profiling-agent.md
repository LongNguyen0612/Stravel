# Story 1.4: Profiling Agent — Dynamic Fact-Finding

Status: done

## Story

As a travel agent,
I want an AI agent to guide structured fact-finding by asking dynamic follow-up questions based on my client's responses,
so that I build a complete traveler profile without missing critical details.

**Depends on:** Story 1.3 (LangGraph Orchestrator Skeleton — provides `AdvisoryState`, `LLMServiceProtocol`, orchestrator graph with profiling node stub)

**FRs implemented:** FR-2 (Dynamic Follow-Up Questions), FR-4 (Profile Context Memory)
**FRs partially advanced:** FR-1 (Start Advisory Session — profiling agent invocation), FR-3 (Profile Completion — readiness signal, not full confirmation UI)

## Acceptance Criteria

### AC-1: Agent Module Structure
**Given** the profiling agent module exists at `agents/profiling/`
**When** the module is inspected
**Then** it contains:
- `agents/profiling/__init__.py`
- `agents/profiling/agent.py` — LangGraph node definition
- `agents/profiling/prompts.py` — system prompts and follow-up templates
- `agents/profiling/schemas.py` — `ProfileQuestion`, `ContextTrigger`, and related Pydantic models
- `agents/profiling/tests/test_profiling_agent.py` — unit tests

### AC-2: Round 1 Questions
**Given** an advisory session is started and the Profiling Agent is invoked
**When** no prior traveler information exists in `AdvisoryState.traveler_profile`
**Then** the agent asks Round 1 questions covering:
- Who is traveling (count, composition)
- When (dates or flexibility)
- Budget (range or comfort level)
- Destination preferences (specific places or "open to suggestions")

### AC-3: Context Trigger — Family with Kids
**Given** a traveler response contains "family with kids" or equivalent signal (e.g., "traveling with children", "our kids", "2 adults 2 children")
**When** the Profiling Agent processes the response
**Then** the agent asks follow-up questions about:
- Child ages
- School holiday constraints
- Kid-friendly activity priorities (water parks, nature, cultural sites with child engagement)

### AC-4: Context Trigger — Dietary Needs
**Given** a traveler response mentions dietary requirements (e.g., "vegan", "halal", "gluten-free", "food allergies", "kosher")
**When** the Profiling Agent processes the response
**Then** the agent asks follow-up questions about:
- Specific dietary type
- Strictness level (strict avoidance vs. preference)
- Any life-threatening allergies requiring venue verification

### AC-5: Context Trigger — Mobility Issues
**Given** a traveler response mentions mobility concerns (e.g., "wheelchair", "walking difficulty", "elderly parent", "bad knee", "disability")
**When** the Profiling Agent processes the response
**Then** the agent asks follow-up questions about:
- Wheelchair accessibility requirements
- Maximum comfortable walking distance/duration
- Elevator/lift requirements at accommodations
- Ground-floor room preference

### AC-6: Context Trigger — Adventure Interest
**Given** a traveler response mentions adventure activities (e.g., "adventure", "hiking", "diving", "motorbike", "trekking", "kayaking")
**When** the Profiling Agent processes the response
**Then** the agent asks follow-up questions about:
- Fitness level (beginner/intermediate/advanced)
- Risk tolerance (mild thrills vs. extreme)
- Specific activities of interest
- Prior experience with mentioned activities

### AC-7: Context Trigger — Flexible Dates
**Given** a traveler response indicates date flexibility (e.g., "flexible on dates", "anytime in winter", "no fixed dates", "whenever is cheapest")
**When** the Profiling Agent processes the response
**Then** the agent asks follow-up questions about:
- Willingness to trade dates for lower prices
- Shoulder season acceptance
- Hard constraints (e.g., must return before a specific date)
- Preferred trip duration range

### AC-8: Context Trigger — Budget Traveler
**Given** a traveler response signals budget consciousness (e.g., "backpacker", "budget", "cheapest", "hostel", "$30/day", "saving money")
**When** the Profiling Agent processes the response
**Then** the agent asks follow-up questions about:
- Hostel/dorm tolerance vs. private room minimum
- Willingness to take overnight transport to save on accommodation
- Self-catering vs. eating out preference
- Comfort trade-offs (air conditioning vs. fan, shared vs. private bathroom)

### AC-9: Context Trigger — Luxury
**Given** a traveler response signals luxury preference (e.g., "luxury", "5-star", "boutique hotel", "premium", "spa", "fine dining", "high-end")
**When** the Profiling Agent processes the response
**Then** the agent asks follow-up questions about:
- Private transfer preference vs. shared/public transport
- Fine dining priority
- Premium accommodation features (pool, spa, sea view, butler service)
- Private tour/guide preference

### AC-10: Context Trigger — Couple / Anniversary
**Given** a traveler response signals a romantic trip (e.g., "honeymoon", "anniversary", "couple", "romantic getaway", "partner", "just the two of us")
**When** the Profiling Agent processes the response
**Then** the agent asks follow-up questions about:
- Special occasion details (anniversary, honeymoon, birthday)
- Surprise arrangements desired
- Romantic experience priorities (beach sunset, private dinner, spa couples treatment)
- Photography/videography interest

### AC-11: No Re-Asking (FR-4)
**Given** a traveler has already answered a question (information exists in `AdvisoryState.traveler_profile`)
**When** the Profiling Agent generates the next set of questions
**Then** the agent never re-asks a question whose answer is already in the profile
**And** if a traveler volunteers unsolicited information mid-conversation (e.g., mentions an allergy while discussing activities), the agent incorporates it without re-asking

### AC-12: No Unstated Assumptions
**Given** the Profiling Agent is generating follow-up questions or building the profile
**When** a preference has not been explicitly stated by the traveler
**Then** the agent does not assume or infer that preference
**And** the agent does not fill in default values for unstated fields
**And** the profile only contains information the traveler has actually provided

### AC-13: LLM Integration via Protocol
**Given** the Profiling Agent needs to generate dynamic questions or parse responses
**When** it calls the LLM
**Then** it uses `LLMServiceProtocol` via dependency injection (never imports Ollama/vLLM directly)
**And** the agent is testable with a mock LLM that returns predetermined responses

### AC-14: Unit Test Coverage
**Given** the test suite at `agents/profiling/tests/test_profiling_agent.py`
**When** tests are run with `pytest`
**Then** each of the 8+ context triggers has at least one test verifying it produces the expected follow-up branch
**And** a test verifies Round 1 questions are asked on empty profile
**And** a test verifies no re-asking behavior (FR-4)
**And** a test verifies no assumption behavior
**And** all tests pass with a mock LLM (no Ollama required)

## Tasks

- [x] Task 1: Define Pydantic schemas (AC: #1)
  - [x] Create `agents/profiling/schemas.py` with:
    - `ContextTrigger` enum: `FAMILY_WITH_KIDS`, `DIETARY_NEEDS`, `MOBILITY_ISSUES`, `ADVENTURE`, `FLEXIBLE_DATES`, `BUDGET_TRAVELER`, `LUXURY`, `COUPLE_ANNIVERSARY`
    - `ProfileQuestion` model: `question: str`, `context_trigger: ContextTrigger | None`, `field_target: str` (which profile field this populates), `priority: int`
    - `DetectedContext` model: `trigger: ContextTrigger`, `confidence: float`, `source_text: str` (the response fragment that triggered it)
    - `ProfilingRound` model: `round_number: int`, `questions: list[ProfileQuestion]`, `detected_contexts: list[DetectedContext]`
    - `AnsweredField` model: `field_name: str`, `value: Any`, `answered_at_round: int`, `source: str` (direct answer vs. inferred from context)

- [x] Task 2: Create prompt templates (AC: #1, #2, #3-#10)
  - [x] Create `agents/profiling/prompts.py` with:
    - `PROFILING_SYSTEM_PROMPT` — the core system prompt defining agent persona and rules
    - `ROUND_1_PROMPT` — initial fact-finding prompt template
    - `CONTEXT_TRIGGER_PROMPTS` — dict mapping each `ContextTrigger` to its follow-up prompt template
    - `ANTI_REDUNDANCY_INSTRUCTION` — injected instruction listing already-answered fields
    - `NO_ASSUMPTION_INSTRUCTION` — injected instruction prohibiting inference
    - `RESPONSE_PARSING_PROMPT` — prompt for extracting structured data from free-text responses
  - [x] See Dev Notes for exact prompt content

- [x] Task 3: Implement context trigger detection (AC: #3-#10)
  - [x] Implement `detect_context_triggers(response: str, current_profile: dict) -> list[DetectedContext]` in `agent.py`
  - [x] Use keyword matching + LLM classification for ambiguous cases
  - [x] Each trigger maps to a set of follow-up questions defined in `prompts.py`
  - [x] Multiple triggers can fire from a single response (e.g., "family with kids who love adventure")
  - [x] Already-triggered contexts with fully answered follow-ups are not re-triggered

- [x] Task 4: Implement the profiling agent node (AC: #1, #2, #11, #12, #13)
  - [x] Implement `profiling_node(state: AdvisoryState, llm: LLMServiceProtocol) -> AdvisoryState` in `agent.py`
  - [x] Accept `LLMServiceProtocol` via dependency injection (function parameter or constructor)
  - [x] On first invocation (empty profile): generate Round 1 questions
  - [x] On subsequent invocations: parse previous response, detect triggers, generate follow-ups
  - [x] Build and maintain `answered_fields` set in state to prevent re-asking
  - [x] Never populate profile fields that the traveler did not explicitly provide
  - [x] Signal profile readiness when minimum fields are present (hand off to Story 1.5)
  - [x] Append errors to `AdvisoryState.errors`, never raise exceptions

- [x] Task 5: Integrate with orchestrator (AC: #2)
  - [x] Wire `profiling_node` into the LangGraph `StateGraph` in `agents/orchestrator.py` (replacing the stub from Story 1.3)
  - [x] Ensure the orchestrator passes `LLMServiceProtocol` to the profiling node
  - [x] Verify the graph transitions from profiling to calculation stub when profile is ready

- [x] Task 6: Write unit tests (AC: #14)
  - [x] Create `agents/profiling/tests/__init__.py`
  - [x] Create `agents/profiling/tests/test_profiling_agent.py` with:
    - `test_round_1_questions_on_empty_profile` — verifies initial questions cover who/when/budget/destination
    - `test_trigger_family_with_kids` — response "family of 4 with 2 young children" triggers child age questions
    - `test_trigger_dietary_needs` — response "my wife is vegan" triggers dietary follow-ups
    - `test_trigger_mobility_issues` — response "my father uses a wheelchair" triggers accessibility questions
    - `test_trigger_adventure` — response "we love hiking and diving" triggers fitness/risk follow-ups
    - `test_trigger_flexible_dates` — response "anytime in November or December" triggers date flexibility questions
    - `test_trigger_budget_traveler` — response "backpacking on a tight budget" triggers budget trade-off questions
    - `test_trigger_luxury` — response "we want a luxury beach resort" triggers premium preference questions
    - `test_trigger_couple_anniversary` — response "celebrating our anniversary" triggers romantic experience questions
    - `test_multiple_triggers_single_response` — response "family with kids who love adventure" triggers both FAMILY and ADVENTURE
    - `test_no_reask_answered_questions` — pre-populated profile field is not re-asked
    - `test_no_assumption_on_unstated` — unmentioned preferences remain None in profile
    - `test_unsolicited_info_incorporated` — mid-conversation allergy mention is captured without re-asking
  - [x] All tests use a mock `LLMServiceProtocol` — no Ollama dependency
  - [x] Create mock LLM fixture that returns configurable responses

- [x] Task 7: Manual integration verification
  - [x] Start the orchestrator with a real Ollama backend
  - [x] Run through a complete profiling conversation verifying natural feel
  - [x] Verify at least 3 different context triggers fire correctly
  - [x] Verify the conversation does not feel like a rigid form

## Dev Notes

### Critical Architecture Constraints

- **LangGraph node signature**: The profiling agent is a node in the LangGraph `StateGraph`. It receives `AdvisoryState` and returns an updated `AdvisoryState`. It does NOT own the event loop or conversation flow — the orchestrator controls re-invocation.
- **LLMServiceProtocol only**: Never `from ollama import ...` or `import openai`. The agent receives an `LLMServiceProtocol` instance. This is how Ollama (dev) and vLLM (prod) swap transparently.
- **Pydantic BaseModel for state**: All state must be Pydantic, not TypedDict (architecture decision AR-5).
- **Errors in state, not exceptions**: If the LLM fails or returns unparseable output, append to `AdvisoryState.errors` and degrade gracefully. Never raise inside an agent node.
- **Co-located tests**: Tests live at `agents/profiling/tests/`, not in a top-level `tests/` directory (architecture pattern).
- **No cross-agent imports**: The profiling agent reads from `AdvisoryState.traveler_profile` only. It never imports from `agents/calculation/` or `agents/proposal/`.

### Prompt Engineering — System Prompt

The system prompt is the most critical artifact in this story. The conversation must feel like a skilled travel consultant, not a form-filling bot.

```python
PROFILING_SYSTEM_PROMPT = """You are an experienced Vietnam travel consultant conducting an initial fact-finding \
conversation with a travel agent about their client. Your goal is to build a complete traveler profile through \
natural, conversational questions.

RULES — FOLLOW STRICTLY:
1. Ask questions conversationally, not as a numbered list. Group related questions naturally (2-3 per turn max).
2. NEVER re-ask a question if the answer is already in the Known Profile below.
3. NEVER assume preferences the traveler has not stated. If they haven't mentioned dietary needs, do not ask \
about dietary needs unless their response hints at it.
4. ONLY ask follow-up questions that are relevant to what the traveler has already shared. Do not ask about \
wheelchair access unless mobility has been mentioned.
5. Acknowledge what the traveler has shared before asking the next question. Show you are listening.
6. Keep your tone warm, professional, and efficient. You are helping, not interrogating.
7. When you have enough information (travelers, dates, budget, destination preference), signal readiness \
with the marker [PROFILE_READY] at the end of your response.

KNOWN PROFILE (do not re-ask these):
{known_profile}

CONVERSATION HISTORY:
{conversation_history}

DETECTED CONTEXTS requiring follow-up:
{detected_contexts}
"""
```

### Prompt Engineering — Round 1 Template

```python
ROUND_1_PROMPT = """This is the start of a new fact-finding conversation. No information has been collected yet.

Ask the travel agent about their client, covering these areas naturally in your opening:
- Who is traveling? (number of travelers, any children, ages)
- When are they planning to travel? (specific dates or general timeframe)
- What's their approximate budget for the trip?
- Do they have specific Vietnam destinations in mind, or are they open to suggestions?

Frame this as a warm, professional opening — not a bullet-point checklist. You might say something like \
"Tell me about the travelers..." and weave the questions together naturally.

Respond with ONLY your conversational questions. Do not generate fake traveler responses."""
```

### Prompt Engineering — Context Trigger Follow-Up Templates

```python
CONTEXT_TRIGGER_PROMPTS = {
    ContextTrigger.FAMILY_WITH_KIDS: """The traveler is bringing children. You need to understand:
- How old are the children? (This affects activity planning — toddler vs. teenager is very different)
- Are they constrained by school holidays? (Affects date flexibility and pricing)
- What kind of activities do the kids enjoy? (Water activities, nature, animals, cultural sites)
- Any childcare/babysitting needs for adult-only evenings?
Weave these into your next conversational response naturally. Do not list them as bullets.""",

    ContextTrigger.DIETARY_NEEDS: """The traveler has mentioned dietary requirements. You need to clarify:
- What exactly is the dietary requirement? (vegan, vegetarian, halal, kosher, gluten-free, specific allergies)
- How strict is it? (Preference vs. medical necessity vs. religious observance)
- Are there any life-threatening allergies that require venue pre-verification?
- Does this apply to all travelers or specific members of the group?
Frame these as caring, practical follow-ups — dietary needs in Vietnam are very manageable but good to know.""",

    ContextTrigger.MOBILITY_ISSUES: """The traveler has indicated mobility concerns. You need to understand:
- What specific mobility aids are needed? (Wheelchair, walking stick, mobility scooter)
- What is the comfortable walking distance/duration? (This affects itinerary pacing)
- Are elevators/lifts required at accommodations? (Many Vietnam boutique hotels are walk-up)
- Ground-floor room requirement?
- Any specific terrain limitations? (Stairs, uneven surfaces, sand, hills)
Be sensitive and practical — frame as ensuring comfort, not cataloguing limitations.""",

    ContextTrigger.ADVENTURE: """The traveler is interested in adventure activities. You need to know:
- What fitness level should we plan for? (Light walking, moderate hiking, intense trekking)
- Risk tolerance? (Gentle kayaking vs. white-water rafting, snorkeling vs. deep-sea diving)
- Any specific activities they dream of? (Ha Giang motorbike loop, cave exploration in Phong Nha, \
kitesurfing in Mui Ne)
- Prior experience with adventure activities? (Certified diver vs. first-time snorkeler matters)
Show enthusiasm — Vietnam has incredible adventure options.""",

    ContextTrigger.FLEXIBLE_DATES: """The traveler has flexible dates. This is an opportunity to optimize:
- Would they shift dates to save significantly on pricing? (Shoulder season can be 30-40% cheaper)
- Are they open to shoulder season? (Fewer crowds, lower prices, but some weather risk)
- Any hard constraints within their flexibility? (Must be back by date X, can't travel before date Y)
- What trip duration range works? (7 days vs. 14 days vs. 21 days)
Frame as an opportunity — flexible dates often mean better deals and fewer crowds.""",

    ContextTrigger.BUDGET_TRAVELER: """The traveler is budget-conscious. You need to understand trade-offs:
- Hostel dorms or private rooms? (Price difference is significant in Vietnam)
- Would they take overnight trains/buses to save on accommodation? (Popular on the north-south route)
- Comfortable with street food and local restaurants vs. tourist restaurants?
- Which comforts are non-negotiable? (AC might be essential in summer, private bathroom, etc.)
Normalize budget travel — Vietnam is one of the best budget destinations in Asia.""",

    ContextTrigger.LUXURY: """The traveler wants a premium experience. Clarify the specifics:
- Private car/driver between cities or domestic flights? (Both excellent options in Vietnam)
- Fine dining important or more interested in authentic local food at high-quality venues?
- Accommodation priorities? (Infinity pool, spa, beach access, heritage property, design hotel)
- Private tours/guides or small group? (Private is standard for luxury Vietnam travel)
- Any specific luxury brands or hotel chains preferred?
Show knowledge of Vietnam's excellent luxury offerings — it punches well above its weight.""",

    ContextTrigger.COUPLE_ANNIVERSARY: """The trip has a romantic occasion. You should explore:
- What is the occasion? (Honeymoon, anniversary — which year?, birthday, proposal?)
- Any surprise arrangements they want? (Sunset dinner, spa treatment, room decoration)
- Romantic experience priorities? (Beach sunset, private cruise, cooking class together, couples spa)
- Photography or videography interest? (Many couples want professional photos at key locations)
- Balance of couple time vs. cultural exploration?
Be genuinely warm — this is a special trip and your enthusiasm matters.""",
}
```

### Context Trigger Detection Logic

The agent uses a two-stage approach for context detection:

**Stage 1 — Keyword Pre-Filter (fast, no LLM cost):**
```python
TRIGGER_KEYWORDS = {
    ContextTrigger.FAMILY_WITH_KIDS: [
        "family", "kids", "children", "child", "son", "daughter", "toddler",
        "teenager", "baby", "infant", "school"
    ],
    ContextTrigger.DIETARY_NEEDS: [
        "vegan", "vegetarian", "halal", "kosher", "gluten", "allergy", "allergic",
        "dietary", "lactose", "celiac", "food restriction", "can't eat", "don't eat"
    ],
    ContextTrigger.MOBILITY_ISSUES: [
        "wheelchair", "mobility", "disabled", "disability", "walking difficulty",
        "cane", "walker", "accessible", "accessibility", "elderly", "bad knee",
        "bad back", "limited mobility", "can't walk far"
    ],
    ContextTrigger.ADVENTURE: [
        "adventure", "hiking", "trekking", "diving", "scuba", "kayaking",
        "motorbike", "climbing", "surfing", "rafting", "zipline", "caving",
        "snorkeling", "extreme", "adrenaline", "thrill"
    ],
    ContextTrigger.FLEXIBLE_DATES: [
        "flexible", "anytime", "no fixed date", "whenever", "cheapest time",
        "best time", "open dates", "not sure when", "flexible on dates"
    ],
    ContextTrigger.BUDGET_TRAVELER: [
        "budget", "cheap", "backpack", "hostel", "saving", "tight budget",
        "low cost", "affordable", "economy", "frugal", "shoestring"
    ],
    ContextTrigger.LUXURY: [
        "luxury", "5-star", "five star", "premium", "boutique", "high-end",
        "exclusive", "first class", "vip", "suite", "spa resort", "fine dining"
    ],
    ContextTrigger.COUPLE_ANNIVERSARY: [
        "honeymoon", "anniversary", "romantic", "couple", "partner",
        "just the two of us", "proposal", "engagement", "wedding trip",
        "celebrate", "special occasion"
    ],
}
```

**Stage 2 — LLM Confirmation (for ambiguous matches):**
When keyword pre-filter finds a potential match but context is ambiguous (e.g., "my kids love this restaurant" in a non-travel context), the LLM is asked to confirm whether the trigger is genuinely relevant. This avoids false positives while keeping LLM calls minimal.

```python
CONTEXT_CONFIRMATION_PROMPT = """Given the traveler's response below, confirm which of the candidate \
context triggers are genuinely relevant to their travel planning.

Traveler response: "{response}"
Candidate triggers: {candidates}

For each candidate, respond with:
- CONFIRMED if the trigger is clearly relevant to their travel needs
- REJECTED if the mention is incidental or not relevant to planning

Respond in JSON format: {{"trigger_name": "CONFIRMED"|"REJECTED", ...}}"""
```

### Answered-Field Tracking (FR-4 Implementation)

The agent maintains a set of answered field names in the `AdvisoryState`. Before generating any question, the agent checks whether the target field is already populated.

```python
def get_answered_fields(profile: dict) -> set[str]:
    """Extract the set of non-None field names from the traveler profile."""
    return {key for key, value in profile.items() if value is not None}

def filter_questions(questions: list[ProfileQuestion], answered: set[str]) -> list[ProfileQuestion]:
    """Remove questions targeting already-answered fields."""
    return [q for q in questions if q.field_target not in answered]
```

The `ANTI_REDUNDANCY_INSTRUCTION` is injected into every LLM prompt after Round 1:

```python
ANTI_REDUNDANCY_INSTRUCTION = """ALREADY KNOWN — DO NOT ASK ABOUT THESE:
{answered_fields_summary}

If the traveler has already provided information about any of the above, acknowledge it and move on. \
Do not re-ask, re-confirm, or rephrase these questions."""
```

### Response Parsing

The agent needs to extract structured profile data from free-text LLM responses. This uses a dedicated parsing prompt:

```python
RESPONSE_PARSING_PROMPT = """Extract structured traveler profile data from the following conversation exchange.

Travel agent's input: "{agent_input}"

Extract any of the following fields if mentioned. Return ONLY fields that were explicitly stated — \
never infer or assume. Return null for any field not mentioned.

Fields:
- traveler_count: int or null
- has_children: bool or null
- child_ages: list[int] or null
- travel_dates_start: ISO date string or null
- travel_dates_end: ISO date string or null
- date_flexibility: string description or null
- budget_total: float or null
- budget_currency: string or null
- budget_per_day: float or null
- destinations: list[string] or null
- accommodation_style: string or null
- dietary_requirements: list[string] or null
- mobility_needs: string or null
- activity_interests: list[string] or null
- fitness_level: string or null
- special_occasion: string or null
- travel_style: "budget" | "mid-range" | "luxury" or null

Respond in JSON format only. No commentary."""
```

### State Management Pattern

The profiling node follows this execution pattern on each invocation:

```
1. Read AdvisoryState.traveler_profile (current knowledge)
2. Read latest user message from state
3. Parse response -> extract profile fields -> update profile
4. Detect context triggers from response
5. Build answered_fields set from updated profile
6. Filter out already-answered questions
7. Generate next questions (Round 1 or context-driven follow-ups)
8. Inject ANTI_REDUNDANCY_INSTRUCTION with answered fields
9. Call LLM to generate natural conversational response
10. Return updated AdvisoryState with new questions + updated profile
```

### Conversation State Fields Added to AdvisoryState

This story extends `AdvisoryState` (or adds a nested model) with profiling-specific state:

```python
class ProfilingState(BaseModel):
    """Profiling-specific state nested within AdvisoryState."""
    current_round: int = 0
    answered_fields: set[str] = set()
    detected_triggers: list[str] = []  # ContextTrigger values already processed
    conversation_history: list[dict] = []  # {"role": "agent"|"user", "content": str}
    pending_questions: list[dict] = []  # Questions generated but not yet asked
    profile_ready: bool = False
```

### Mock LLM for Testing

Tests must not require Ollama. Create a configurable mock:

```python
class MockLLMService:
    """Mock LLM that returns predetermined responses for testing."""

    def __init__(self, responses: list[str] | None = None):
        self._responses = responses or []
        self._call_count = 0

    async def generate(self, prompt: str, **kwargs) -> str:
        if self._call_count < len(self._responses):
            response = self._responses[self._call_count]
            self._call_count += 1
            return response
        return '{"error": "no more mock responses"}'

    async def stream(self, prompt: str, **kwargs):
        response = await self.generate(prompt, **kwargs)
        for char in response:
            yield char
```

### File Placement Summary

| File | Purpose |
|---|---|
| `backend/app/agents/profiling/__init__.py` | Module init, exports `profiling_node` |
| `backend/app/agents/profiling/agent.py` | LangGraph node: `profiling_node(state, llm) -> AdvisoryState` |
| `backend/app/agents/profiling/prompts.py` | All prompt templates and instruction fragments |
| `backend/app/agents/profiling/schemas.py` | `ContextTrigger`, `ProfileQuestion`, `DetectedContext`, `ProfilingState` |
| `backend/app/agents/profiling/tests/__init__.py` | Test module init |
| `backend/app/agents/profiling/tests/test_profiling_agent.py` | 13+ unit tests covering all triggers and behaviors |
| `backend/app/agents/orchestrator.py` | Updated: profiling stub replaced with real `profiling_node` |

### Anti-Patterns — DO NOT

- **DO NOT** hard-code a decision tree. The LLM generates natural responses; keyword detection selects which prompt templates to inject. The conversation is guided, not scripted.
- **DO NOT** ask all 8 trigger follow-ups upfront. Only ask follow-ups relevant to detected triggers.
- **DO NOT** import from `agents/calculation/` or any other agent module. Read only from `AdvisoryState`.
- **DO NOT** call Ollama or OpenAI directly. Use `LLMServiceProtocol` only.
- **DO NOT** use TypedDict anywhere. All state models are Pydantic BaseModel.
- **DO NOT** generate traveler profile data. Only record what the traveler explicitly says.
- **DO NOT** create a `utils.py` file. Name files by purpose.
- **DO NOT** implement the profile confirmation UI (that is Story 1.5).

### Testing Strategy

All tests use `MockLLMService` with predetermined responses. Each trigger test follows this pattern:

1. Create a mock LLM pre-loaded with a response containing the trigger phrase
2. Create an `AdvisoryState` with empty profile
3. Invoke `profiling_node` to parse the response
4. Assert that the detected triggers include the expected `ContextTrigger`
5. Assert that the generated follow-up questions are relevant to the trigger
6. Assert that profile fields extracted from the response are correctly populated

For the no-reask test:
1. Create an `AdvisoryState` with pre-populated profile fields
2. Invoke `profiling_node`
3. Assert that generated questions do not target already-populated fields

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- agents/profiling/ structure, Protocol interfaces, naming conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md -- LangGraph state convention, AdvisoryState]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Anti-patterns: no cross-agent imports, no direct LLM imports]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 1, Story 1.4 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/prds/prd-AIFU-2026-05-24/prd.md -- FR-2 context triggers, FR-4 profile context memory]
- [Source: _bmad-output/planning-artifacts/prds/prd-AIFU-2026-05-24/prd.md -- UJ-1 family with kids journey, UJ-2 backpacker journey]
- [Source: _bmad-output/implementation-artifacts/1-1-project-setup.md -- LLMServiceProtocol stub, AdvisoryState stub]

## Dev Agent Record

### Agent Model Used

(To be filled by implementing agent)

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled on completion)

### Change Log

- 2026-05-24: Story spec created — ready-for-dev

### File List

(To be filled by implementing agent with all files created/modified)
