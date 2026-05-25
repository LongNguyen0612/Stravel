---
title: "Product Brief — STravel: AI Travel Advisory Platform"
status: draft
created: 2026-05-24
updated: 2026-05-24
---

# Product Brief: STravel

## Executive Summary

STravel is an AI-powered travel advisory platform that turns unstructured trip planning into a structured, agent-guided workflow. Instead of a chatbot that generates generic itineraries, STravel orchestrates specialized AI agents through four stages: traveler profiling, plan calculation, proposal generation, and compliance validation.

The platform serves travel agents as a real-time copilot. While the agent talks to a client, STravel surfaces relevant suggestions, runs calculations in the background, drafts proposals, and flags compliance issues before they reach the client. The MVP focuses on Vietnam travel, built on a fully open-source stack (Python, LangChain/LangGraph, open-source LLMs and vector DB).

This is a learning project designed as a commercially plausible product. Every architectural decision serves a dual mandate: would a real SaaS need this, AND does it teach a core AI/ML engineering concept?

## The Problem

Trip planning is broken at the professional level. Travel agents spend hours per client researching destinations, cross-referencing prices, checking visa rules, and assembling proposals manually. The process is:

- **Unstructured** — agents rely on memory rather than systematic workflows. Critical questions get missed. Dietary needs surface after booking. Visa issues appear at the airport.
- **Unverified** — existing AI tools (Mindtrip, Kayak AI, MonkeyTravel) generate plausible-sounding itineraries but do not verify that recommended hotels exist, prices are current, or activities are open on the suggested date. [ASSUMPTION: No current tool runs structured compliance checks against visa/health rules as part of the planning workflow.]
- **Disconnected** — calculations happen in spreadsheets, compliance checks happen in the agent's head, proposals are generated separately. No stage feeds the next.

Vietnam illustrates this well: visa rules vary by nationality (e-visa for all countries up to 90 days, 45-day exemption for ~25 countries, 30-day for ASEAN, special Phu Quoc rules), monsoon patterns differ north vs south, and travel infrastructure varies sharply between Hanoi, Da Nang, Ho Chi Minh City, Sapa, and Phu Quoc.

## Who This Serves

**Primary: Travel agents specializing in Vietnam inbound tourism.**
Professionals handling multiple client inquiries per week, each requiring hours of manual research, calculation, and proposal writing. They know Vietnam well but lose time on repetitive research and compliance verification. They want faster proposals, fewer compliance misses, and happier clients.

**Secondary (demo mode): Direct consumers planning Vietnam trips.**
A self-serve interface for travelers who want structured planning rather than a chatbot. Primarily a demonstration and testing vehicle.

## The Solution

STravel replaces the agent's scattered workflow with four AI-orchestrated stages:

**1. Fact-Finding** — A Profiling Agent runs a dynamic conversation with the traveler (or assists the agent during a live client session). It adapts follow-up questions based on context: family with kids triggers questions about ages and school holidays; adventure interest triggers fitness and risk tolerance. The agent tracks what it already knows and asks only what it needs.

**2. Calculation** — Specialized agents compute budget allocation, flight and accommodation comparisons from live pricing data, multi-city routing optimization, seasonal price analysis, and travel insurance estimation. All calculations are sourced from live data, not generated.

**3. Summarization** — A Proposal Agent generates a structured trip proposal backed by retrieved data: day-by-day itinerary with verified venues, accommodation comparison tables with sourced ratings and prices, budget breakdowns, and prioritized booking action items. Every recommendation traces to an entity in the vector database.

**4. Compliance** — Before any proposal reaches the client, a Compliance Agent validates visa requirements by nationality, vaccination advisories, travel warnings, age restrictions on activities, budget feasibility, seasonal suitability, accessibility requirements, and passport validity. The Compliance Agent blocks non-compliant items and flags alternatives.

**Copilot UX** — In B2B mode, these agents run as a real-time sidebar alongside the agent-client conversation. The agent sees suggestions, calculations, and compliance flags as they emerge.

## What Makes This Different

- **Structured advisory, not a chatbot.** Existing AI travel tools generate itineraries from a single prompt. STravel runs a multi-stage workflow where each stage feeds the next and compliance gates the output.
- **Verified data, not hallucinations.** Every entity in a STravel proposal must exist in the vector database with a verifiable source. The system cannot recommend a hotel that doesn't exist or invent a price. [ASSUMPTION: This is the aspirational standard; initial implementation will cover indexed entities but may not catch all edge cases.]
- **Compliance as a first-class workflow.** No competing tool validates visa rules, health requirements, seasonal feasibility, and accessibility against the traveler's profile before presenting recommendations. [ASSUMPTION: Based on 2026 competitive landscape review.]
- **Open-source full stack.** Built on open-source components throughout — no vendor lock-in, full transparency into every layer.

The moat is execution and data quality, not proprietary technology. The architectural patterns are replicable. The advantage is assembling them into a coherent, domain-specific advisory product for Vietnam travel.

## Success Criteria

**Learning objectives (primary):**
- All 13 AI/ML engineering concepts implemented with production-grade patterns
- Each concept earns its place in the architecture
- The system is deployable, observable, and maintainable — not a notebook prototype

**Product quality signals:**
- Fact-finding captures enough context to generate a relevant proposal in a single session
- No hallucinated entities in proposals (hotels, restaurants, attractions must exist in the vector DB)
- Compliance agent catches visa/health issues that a manual check would catch
- Proposals are specific enough that a traveler could follow the itinerary

## Scope

**In (MVP):**
- Vietnam destinations only (Hanoi, Ha Long Bay, Sapa, Da Nang/Hoi An, Hue, Nha Trang, Da Lat, Ho Chi Minh City, Mekong Delta, Phu Quoc)
- Four core workflows: fact-finding, calculation, summarization, compliance
- B2B copilot interface + B2C demo mode
- Multi-agent orchestration via LangChain/LangGraph
- Open-source LLM (Qwen recommended — Apache 2.0, strong Vietnamese support)
- Open-source vector DB, hybrid RAG (keyword + semantic)
- Docker/Kubernetes, CI/CD, observability

**Out (MVP):**
- Destinations outside Vietnam
- Booking or payment integration
- Group consensus engine, predictive pricing, trip memory system
- Mobile app (web-first)
- Multi-language UI (English-first)

## Vision

The Vietnam MVP proves a reusable pattern: **structured AI advisory workflows that apply to any domain** — the same pipeline works for insurance, real estate, education, or healthcare. Post-MVP expansion follows two axes: geographic (Southeast Asia, then global) and feature depth (group planning, predictive pricing, trip memory, cultural intelligence).
