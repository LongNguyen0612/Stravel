# Addendum — STravel Chat-First UI PRD

## Technical Mechanism Notes (for Architecture)

### SSE Streaming for Card Deck
The existing SSE infrastructure emits typed events (`stage.change`, `proposal.ready`, `agent.calculation.result`). The card deck UI maps directly to these event types — no new event types required for Phase 1. Cards are rendered as each event arrives, giving natural progressive appearance.

### Passport OCR Options Considered
- **Google Cloud Vision API** — highest accuracy, ~$1.50/1000 requests, requires GCP dependency
- **AWS Textract** — similar accuracy, better at structured documents, requires AWS dependency
- **Ollama vision model (LLaVA)** — zero additional cost, already in stack, lower accuracy on passport MRZ zone
- Decision deferred to OQ-2; architecture team to evaluate before FR-B6 story

### Propose-First LLM Call Strategy
The Propose-First flow (FR-A3) triggers an LLM call with partial data. Two approaches:
- **Option A:** Use the existing `run_advisory_workflow` with defaults for missing fields — no new code path, higher hallucination risk on missing data
- **Option B:** New lightweight "draft proposal" endpoint with explicit default labelling — cleaner UX, extra endpoint
- [ASSUMPTION] Option A used for MVP; Option B evaluated if proposal quality degrades

### Agent Mode (Split Panel) Implementation
The current split-panel layout (`CopilotLayout.tsx`) is preserved as-is behind a localStorage toggle. The new unified canvas is the default. This avoids a breaking change for any existing B2B sessions while the feature ships.

## Research Digest — Conversational Travel UX

Key findings from market research (2026-05-25):
- **Slot-filling with context awareness** is the proven pattern: one concept per message, natural progression
- **Hybrid card + chat** prevents the "archaeology problem" — critical data stays visible as cards, not buried in scrollback
- **Graceful fallback** is essential in travel UX — high-stakes decisions require escape hatches (the agent mode toggle serves this purpose)
- **Biggest failure modes:** capability ambiguity, looping/brittleness, over-humanization
- STravel mitigates ambiguity via the stage narrator (FR-D2) and progress bar (FR-D3)
- STravel mitigates looping via card-constrained options (bot always provides structured choices, not open-ended prompts)

## Personas (Full Detail)

### Self-Serve Traveler
- Age 25–45, mobile-first
- Planning leisure travel, 3–10 days, 1–4 people
- Familiar with chat interfaces (WhatsApp, iMessage)
- Likely to abandon a 12-field form, unlikely to abandon a 3-tap card flow
- Values: speed, confidence, not having to think too hard about logistics

### Travel Agent Copilot
- Professional travel agent, desktop-first during client calls
- Manages 5–20 client sessions per day
- Values: structured intake, speed, confidence in compliance checks
- Current pain: switching between STravel and other tools during a call
- The split-panel (agent mode) remains relevant for this persona
