# Story 3.7: Proposal Export -- PDF & Shareable Link

Status: draft

## Story

As a travel agent,
I want to export the proposal as a PDF or generate a shareable link,
so that I can send a professional document to my client.

## Acceptance Criteria

1. **PDF export endpoint** -- `POST /api/v1/proposals/{proposal_id}/export` generates a PDF preserving formatting, tables, and budget charts from the proposal
2. **Shareable link endpoint** -- `POST /api/v1/proposals/{proposal_id}/share` generates a read-only shareable link with a unique token
3. **No auth on shared link** -- The shareable link does not require authentication to view (`GET /api/v1/shared/{share_token}`)
4. **Export agent module** -- `agents/proposal/export.py` handles PDF generation logic
5. **Proposal persistence** -- Proposals are stored in the database linked to their advisory session via `proposal_id` foreign key
6. **PDF content fidelity** -- The generated PDF includes: day-by-day itinerary, accommodation comparison table (min 3 options per destination), categorized budget breakdown with totals, booking action items, compliance status summary
7. **PDF metadata** -- The PDF includes a cover page with session metadata (client name, destinations, dates, generated timestamp) and page numbers
8. **Share token security** -- Share tokens are cryptographically random (URL-safe, 32+ bytes), have configurable expiry (default 30 days), and can be revoked
9. **Share link response** -- The share endpoint returns the full URL and expiry date
10. **PDF binary response** -- The export endpoint returns the PDF as `application/pdf` with a `Content-Disposition` header for download
11. **Proposal not found** -- Returns 404 if `proposal_id` does not exist or belongs to a different tenant
12. **Proposal not ready** -- Returns 409 Conflict if the proposal has not completed generation (status is not `completed`)
13. **Tenant isolation** -- Both export and share endpoints enforce tenant isolation via `tenant_id` filtering
14. **Shared view read-only** -- The shared link returns proposal data as read-only JSON (frontend renders it); does not expose tenant or agent information
15. **Expired share link** -- Accessing an expired or revoked share token returns 410 Gone

## Tasks

- [ ] Task 1: Create Proposal and ShareLink database models (AC: #5, #8)
  - [ ] Create `backend/app/models/proposal.py` with `Proposal` SQLModel
  - [ ] Define fields: `id` (UUID, PK), `advisory_session_id` (UUID, FK to `advisory_sessions.id`, indexed), `tenant_id` (str, indexed), `status` (enum: `generating`, `completed`, `failed`), `title` (str), `content` (JSON -- full proposal data), `pdf_binary` (LargeBinary, nullable -- cached PDF), `created_at` (datetime, UTC), `updated_at` (datetime, UTC)
  - [ ] Create `ShareLink` model with fields: `id` (UUID, PK), `proposal_id` (UUID, FK to `proposals.id`, indexed), `token` (str, unique, indexed -- URL-safe random), `expires_at` (datetime, UTC), `is_revoked` (bool, default False), `created_at` (datetime, UTC)
  - [ ] Define `ProposalStatus` enum: `GENERATING = "generating"`, `COMPLETED = "completed"`, `FAILED = "failed"`
  - [ ] Add `Relationship` from `Proposal` back to `AdvisorySession` and from `ShareLink` to `Proposal`
  - [ ] Use `Optional["ModelName"]` with `# noqa: F821` for relationships (NEVER `from __future__ import annotations`)
  - [ ] Use `datetime.utcnow()` for all timestamp defaults (NEVER `datetime.now(timezone.utc)`)
  - [ ] Export models in `models/__init__.py`

- [ ] Task 2: Create Alembic migration for proposals and share_links tables (AC: #5, #8)
  - [ ] Generate migration with `alembic revision --autogenerate -m "add_proposals_and_share_links"`
  - [ ] Verify migration creates both tables with correct columns, indexes, and foreign keys
  - [ ] Verify `alembic upgrade head` runs cleanly
  - [ ] Verify `alembic downgrade -1` reverses cleanly

- [ ] Task 3: Create Pydantic request/response schemas (AC: #1, #2, #9, #10, #14)
  - [ ] Create `backend/app/schemas/proposal.py`
  - [ ] Define `ProposalResponse` with `id`, `advisory_session_id`, `status`, `title`, `content`, `created_at`, `updated_at`
  - [ ] Define `ProposalExportResponse` -- thin metadata wrapper (PDF is returned as binary, but this is used for async/status cases)
  - [ ] Define `ShareLinkCreateRequest` with optional `expires_in_days: int = 30`
  - [ ] Define `ShareLinkResponse` with `share_url: str`, `token: str`, `expires_at: datetime`, `created_at: datetime`
  - [ ] Define `SharedProposalResponse` -- read-only view: `title`, `content`, `created_at` (excludes `tenant_id`, `advisory_session_id`, internal fields)
  - [ ] Define `ProposalContentSchema` as a typed Pydantic model for the JSON content field: itinerary (list of days), accommodation_comparison (list of options), budget_breakdown (categories with amounts), booking_actions (prioritized list), compliance_summary (pass/warn/block status)

- [ ] Task 4: Implement PDF generation in `agents/proposal/export.py` (AC: #4, #6, #7)
  - [ ] Install `weasyprint` as the PDF library (add to `pyproject.toml`)
  - [ ] Create `backend/app/agents/proposal/export.py`
  - [ ] Implement `ProposalPDFExporter` class with `generate_pdf(proposal: Proposal) -> bytes` method
  - [ ] Create an HTML template for the proposal using Jinja2 (embedded or in `prompts/templates/`)
  - [ ] Template sections: cover page (client name, destinations, dates, generated timestamp), day-by-day itinerary with time blocks, accommodation comparison table with columns (name, location, price/night, rating, amenities, source link), budget breakdown table with category totals and grand total, budget allocation chart (simple HTML/CSS bar chart -- no JS), booking action items (prioritized, with reasoning), compliance summary (pass/warn indicators), footer with page numbers and "Generated by STravel" branding
  - [ ] Use CSS `@page` rules for print-quality layout (A4 size, margins, page breaks)
  - [ ] Handle missing/partial proposal data gracefully (omit sections rather than crash)
  - [ ] Implement `render_html(proposal: Proposal) -> str` as a separate method (testable without PDF engine)
  - [ ] Add structured logging with `structlog` for PDF generation timing and errors

- [ ] Task 5: Implement share token generation utilities (AC: #8)
  - [ ] Create token generation in `backend/app/agents/proposal/export.py` or `backend/app/services/share_service.py`
  - [ ] Implement `generate_share_token() -> str` using `secrets.token_urlsafe(32)`
  - [ ] Implement `create_share_link(proposal_id: UUID, expires_in_days: int, db: AsyncSession) -> ShareLink`
  - [ ] Implement `get_proposal_by_share_token(token: str, db: AsyncSession) -> Proposal | None` that checks `is_revoked` and `expires_at`
  - [ ] Implement `revoke_share_link(share_link_id: UUID, db: AsyncSession) -> None`

- [ ] Task 6: Implement proposal API endpoints (AC: #1, #2, #3, #9, #10, #11, #12, #13, #14, #15)
  - [ ] Create `backend/app/api/v1/proposals.py`
  - [ ] Implement `POST /api/v1/proposals/{proposal_id}/export`:
    - [ ] Require auth (`Depends(require_auth)`)
    - [ ] Validate `proposal_id` exists and belongs to current tenant (return 404 if not)
    - [ ] Validate proposal status is `completed` (return 409 Conflict if not)
    - [ ] Generate PDF via `ProposalPDFExporter.generate_pdf()`
    - [ ] Cache the generated PDF binary in the `Proposal.pdf_binary` column (skip regeneration on subsequent calls if content unchanged)
    - [ ] Return PDF as `Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=proposal-{proposal_id}.pdf"})`
  - [ ] Implement `POST /api/v1/proposals/{proposal_id}/share`:
    - [ ] Require auth (`Depends(require_auth)`)
    - [ ] Validate `proposal_id` exists and belongs to current tenant (return 404 if not)
    - [ ] Validate proposal status is `completed` (return 409 Conflict if not)
    - [ ] Generate share token via `create_share_link()`
    - [ ] Return `ShareLinkResponse` with full URL constructed from `settings.base_url`
  - [ ] Implement `GET /api/v1/shared/{share_token}`:
    - [ ] NO auth required (public endpoint)
    - [ ] Look up share link by token
    - [ ] Return 404 if token not found
    - [ ] Return 410 Gone if token is expired or revoked
    - [ ] Return `SharedProposalResponse` (read-only, stripped of internal fields)
  - [ ] Implement `DELETE /api/v1/proposals/{proposal_id}/share/{share_link_id}`:
    - [ ] Require auth
    - [ ] Revoke the share link (set `is_revoked = True`)
  - [ ] Register router in `api/v1/router.py`

- [ ] Task 7: Add shared endpoint to public paths (AC: #3)
  - [ ] Update `core/tenant.py` `PUBLIC_PATHS` or `_is_public_path()` to include `/api/v1/shared/` prefix
  - [ ] Verify the shared endpoint is accessible without JWT

- [ ] Task 8: Add `base_url` setting to config (AC: #9)
  - [ ] Add `base_url: str = "http://localhost:8000"` to `core/config.py` Settings class
  - [ ] Add `BASE_URL` to `.env.example` with documentation
  - [ ] Use `settings.base_url` to construct full share URLs in the share endpoint

- [ ] Task 9: Write unit tests (AC: all)
  - [ ] **Model tests** (`backend/app/models/tests/test_proposal.py`):
    - [ ] Test `Proposal` model creation with all fields
    - [ ] Test `ShareLink` model creation with token and expiry
    - [ ] Test `ProposalStatus` enum values
  - [ ] **Schema tests** (`backend/app/schemas/tests/test_proposal.py`):
    - [ ] Test `ProposalResponse` serialization
    - [ ] Test `SharedProposalResponse` excludes internal fields (`tenant_id`, `advisory_session_id`)
    - [ ] Test `ShareLinkResponse` includes full URL
    - [ ] Test `ProposalContentSchema` validates itinerary, budget, accommodations structure
  - [ ] **Export tests** (`backend/app/agents/proposal/tests/test_export.py`):
    - [ ] Test `render_html()` produces valid HTML with all sections present
    - [ ] Test `render_html()` handles missing itinerary gracefully
    - [ ] Test `render_html()` handles missing budget data gracefully
    - [ ] Test `render_html()` renders accommodation comparison table with correct columns
    - [ ] Test `render_html()` includes cover page with metadata
    - [ ] Test `generate_pdf()` returns non-empty bytes (requires weasyprint installed)
    - [ ] Test `generate_pdf()` output starts with PDF magic bytes (`%PDF-`)
  - [ ] **Share token tests** (`backend/app/agents/proposal/tests/test_share.py` or inline):
    - [ ] Test `generate_share_token()` produces URL-safe string of expected length
    - [ ] Test `generate_share_token()` produces unique tokens on consecutive calls
    - [ ] Test share link creation sets correct expiry date
    - [ ] Test expired share link returns None on lookup
    - [ ] Test revoked share link returns None on lookup
  - [ ] **API endpoint tests** (`backend/tests/unit/test_proposals_api.py`):
    - [ ] Test `POST /proposals/{id}/export` returns PDF with correct content-type and content-disposition
    - [ ] Test `POST /proposals/{id}/export` returns 404 for non-existent proposal
    - [ ] Test `POST /proposals/{id}/export` returns 404 for proposal belonging to different tenant
    - [ ] Test `POST /proposals/{id}/export` returns 409 for proposal with status `generating`
    - [ ] Test `POST /proposals/{id}/share` returns share URL and expiry
    - [ ] Test `POST /proposals/{id}/share` returns 404 for non-existent proposal
    - [ ] Test `GET /shared/{token}` returns read-only proposal data without auth
    - [ ] Test `GET /shared/{token}` returns 404 for unknown token
    - [ ] Test `GET /shared/{token}` returns 410 for expired token
    - [ ] Test `GET /shared/{token}` returns 410 for revoked token
    - [ ] Test `DELETE /proposals/{id}/share/{share_id}` revokes the link
    - [ ] Test tenant isolation -- Tenant A cannot export Tenant B's proposal
  - [ ] All tests pass with PostgreSQL only -- no Qdrant, no Redis, no LLM required

- [ ] Task 10: Add weasyprint dependency (AC: #4)
  - [ ] Add `weasyprint>=62.0` to `pyproject.toml` dependencies
  - [ ] Add `jinja2>=3.1.0` to `pyproject.toml` (if not already present -- used for HTML templating)
  - [ ] Verify `pip install -e ".[dev]"` succeeds with new dependencies
  - [ ] Document weasyprint system dependencies in `README.md` or `docs/setup.md` (requires `pango`, `cairo`, `gdk-pixbuf` on the host -- these are handled by the Docker image but need manual install on macOS: `brew install pango`)

## Dev Notes

### Critical Architecture Constraints

- **WeasyPrint over ReportLab** -- WeasyPrint is selected for PDF generation. It renders HTML/CSS to PDF, which allows: (1) reusing the same template for both web preview and PDF, (2) leveraging CSS for layout (tables, page breaks, headers/footers), (3) easier maintenance than ReportLab's procedural API. The architecture gap analysis listed this as an open decision; this story resolves it.
- **Tenant isolation required** -- All proposal access must filter by `tenant_id`. The shared link endpoint is the one exception: it bypasses tenant context entirely (public access by token).
- **Proposals stored in DB, not filesystem** -- PDF binary is cached in the `Proposal.pdf_binary` column (PostgreSQL `LargeBinary` / `BYTEA`). No filesystem or object storage in Phase 3. If PDFs grow large, migrate to S3/MinIO in Phase 4.
- **No frontend work in this story** -- Frontend components for proposal viewing (`ProposalViewer`, `ExportButton`) are handled in Stories 1.8 (B2B) and 5.1 (B2C). This story provides the backend API only.
- **structlog for all logging** -- Use `structlog` with `session_id`, `proposal_id`, and `tenant_id` context. Never use stdlib `logging`.
- **Pydantic BaseModel for all schemas** -- All request/response payloads are Pydantic models.
- **SQLModel for all DB models** -- Follow existing model patterns from `models/advisory_session.py`.
- **AsyncSession patterns** -- Use `session.execute()` with `.scalars().first()` or `.scalars().all()`. NEVER use `session.exec()`.

### PDF Library Decision: WeasyPrint

**Why WeasyPrint:**
- HTML/CSS-to-PDF conversion -- write templates, not code
- Full CSS support including `@page`, `page-break-before`, `@media print`
- Tables, images, and styled content render correctly
- Active maintenance, good Python 3.12+ support
- Docker-friendly (system deps: `pango`, `cairo`, `gdk-pixbuf` -- available in most base images)

**Why not ReportLab:**
- Procedural API requires manually positioning every element
- Tables are more complex to build programmatically
- No CSS support -- harder to maintain visual consistency with web
- Better suited for forms/invoices with fixed layouts, not rich documents

**System dependencies (macOS dev):**
```bash
brew install pango cairo gdk-pixbuf libffi
```

**System dependencies (Docker / Ubuntu):**
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 \
    && rm -rf /var/lib/apt/lists/*
```

### Proposal Content JSON Structure

The `Proposal.content` column stores the full proposal as JSON. This is the structure that `ProposalContentSchema` validates:

```python
# schemas/proposal.py
from pydantic import BaseModel
from datetime import datetime

class ItineraryTimeBlock(BaseModel):
    time: str                  # "09:00-12:00"
    activity: str              # "Visit Hoan Kiem Lake"
    venue_name: str | None     # Entity name from Vector Store
    venue_id: str | None       # Entity ID for traceability
    transport: str | None      # "Walk (15 min)" or "Grab (20 min, ~$3)"
    notes: str | None          # "Bring umbrella -- outdoor"

class ItineraryDay(BaseModel):
    day_number: int
    date: str | None           # "2026-06-15" if dates are fixed
    destination: str           # "Hanoi"
    morning: list[ItineraryTimeBlock]
    afternoon: list[ItineraryTimeBlock]
    evening: list[ItineraryTimeBlock]
    weather_alternatives: list[str] | None

class AccommodationOption(BaseModel):
    name: str
    location: str
    price_per_night: float
    rating: float
    amenities: list[str]
    source_url: str
    freshness_timestamp: datetime
    why_it_fits: str
    entity_id: str             # Vector Store entity ID

class BudgetCategory(BaseModel):
    category: str              # "Accommodation", "Activities", "Food", etc.
    amount: float
    line_items: list[dict]     # [{"item": "Rex Hotel x 5 nights", "cost": 450.0}]

class BudgetBreakdown(BaseModel):
    categories: list[BudgetCategory]
    total: float
    budget_limit: float
    is_over_budget: bool
    over_budget_percentage: float | None

class BookingAction(BaseModel):
    priority: int              # 1 = most urgent
    action: str                # "Book flights Hanoi -> Phu Quoc"
    reasoning: str             # "Prices volatile -- book 6+ weeks ahead"
    deadline: str | None       # "2026-05-01"

class ComplianceSummary(BaseModel):
    overall_status: str        # "pass", "warning", "block"
    checks: list[dict]        # [{"check": "visa", "status": "pass", "detail": "45-day visa-free"}]

class ProposalContent(BaseModel):
    itinerary: list[ItineraryDay]
    accommodation_comparison: list[AccommodationOption]
    budget_breakdown: BudgetBreakdown
    booking_actions: list[BookingAction]
    compliance_summary: ComplianceSummary
    traveler_summary: dict     # Name, group size, dates, destinations
```

### HTML Template Structure

The PDF is generated from an HTML template rendered with Jinja2. Key template sections:

```html
<!-- agents/proposal/templates/proposal_pdf.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: A4;
      margin: 2cm;
      @bottom-center { content: "Page " counter(page) " of " counter(pages); }
    }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #333; }
    h1 { color: #1a5276; border-bottom: 2px solid #1a5276; }
    h2 { color: #2e86c1; margin-top: 1.5em; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th { background: #2e86c1; color: white; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f8f9fa; }
    .cover-page { page-break-after: always; text-align: center; padding-top: 30%; }
    .day-section { page-break-inside: avoid; }
    .budget-bar { height: 20px; background: #2e86c1; border-radius: 3px; }
    .budget-bar-container { background: #ecf0f1; border-radius: 3px; overflow: hidden; }
    .over-budget { color: #e74c3c; font-weight: bold; }
    .compliance-pass { color: #27ae60; }
    .compliance-warn { color: #f39c12; }
    .compliance-block { color: #e74c3c; }
    .action-item { margin: 0.5em 0; padding: 0.5em; border-left: 3px solid #2e86c1; }
    .action-item.priority-1 { border-left-color: #e74c3c; }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <h1>Travel Proposal</h1>
    <p>{{ traveler_summary.client_name | default("Client") }}</p>
    <p>{{ traveler_summary.destinations | join(", ") }}</p>
    <p>{{ traveler_summary.dates }}</p>
    <p><small>Generated {{ generated_at }}</small></p>
  </div>

  <!-- Itinerary Section -->
  <h1>Day-by-Day Itinerary</h1>
  {% for day in itinerary %}
  <div class="day-section">
    <h2>Day {{ day.day_number }}: {{ day.destination }}</h2>
    <!-- morning/afternoon/evening time blocks as table -->
  </div>
  {% endfor %}

  <!-- Accommodation Comparison -->
  <h1>Accommodation Options</h1>
  <table>
    <tr><th>Name</th><th>Location</th><th>Price/Night</th><th>Rating</th><th>Why It Fits</th></tr>
    {% for acc in accommodation_comparison %}
    <tr>
      <td>{{ acc.name }}</td>
      <td>{{ acc.location }}</td>
      <td>${{ acc.price_per_night }}</td>
      <td>{{ acc.rating }}/5</td>
      <td>{{ acc.why_it_fits }}</td>
    </tr>
    {% endfor %}
  </table>

  <!-- Budget Breakdown -->
  <h1>Budget Breakdown</h1>
  <!-- category table + bar chart -->

  <!-- Booking Actions -->
  <h1>Booking Action Items</h1>
  {% for action in booking_actions %}
  <div class="action-item priority-{{ action.priority }}">
    <strong>#{{ action.priority }}: {{ action.action }}</strong>
    <p>{{ action.reasoning }}</p>
  </div>
  {% endfor %}

  <!-- Compliance Summary -->
  <h1>Compliance Summary</h1>
  <!-- pass/warn/block indicators -->
</body>
</html>
```

### Share Token Implementation Pattern

```python
# agents/proposal/export.py or services/share_service.py
import secrets
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select

import structlog

from app.models.proposal import ShareLink

logger = structlog.get_logger()


def generate_share_token() -> str:
    """Generate a cryptographically random URL-safe token."""
    return secrets.token_urlsafe(32)  # 43 characters, 256 bits of entropy


async def create_share_link(
    proposal_id: UUID,
    expires_in_days: int,
    db,  # AsyncSession
) -> ShareLink:
    token = generate_share_token()
    share_link = ShareLink(
        proposal_id=proposal_id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=expires_in_days),
    )
    db.add(share_link)
    await db.commit()
    await db.refresh(share_link)
    logger.info(
        "share_link.created",
        proposal_id=str(proposal_id),
        token=token[:8] + "...",
        expires_in_days=expires_in_days,
    )
    return share_link


async def get_proposal_by_share_token(token: str, db) -> dict | None:
    """Look up a proposal via share token. Returns None if expired/revoked/missing."""
    result = await db.execute(
        select(ShareLink).where(
            ShareLink.token == token,
            ShareLink.is_revoked == False,  # noqa: E712
            ShareLink.expires_at > datetime.utcnow(),
        )
    )
    share_link = result.scalars().first()
    if not share_link:
        return None

    # Load the associated proposal
    result = await db.execute(
        select(Proposal).where(Proposal.id == share_link.proposal_id)
    )
    return result.scalars().first()
```

### API Endpoint Patterns

```python
# api/v1/proposals.py
import structlog
from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse

from app.core.dependencies import get_db, require_auth
from app.core.tenant import get_tenant_id
from app.core.exceptions import AppError

router = APIRouter()
logger = structlog.get_logger()


@router.post("/proposals/{proposal_id}/export")
async def export_proposal_pdf(
    proposal_id: str,
    db=Depends(get_db),
    _=Depends(require_auth),
):
    """Export a completed proposal as a PDF document."""
    tenant_id = get_tenant_id()
    log = logger.bind(proposal_id=proposal_id, tenant_id=tenant_id)

    # Load proposal with tenant isolation
    proposal = await get_proposal_by_id(proposal_id, tenant_id, db)
    if not proposal:
        raise AppError("PROPOSAL_NOT_FOUND", f"Proposal {proposal_id} not found", status_code=404)

    if proposal.status != ProposalStatus.COMPLETED:
        raise AppError("PROPOSAL_NOT_READY", "Proposal generation is not complete", status_code=409)

    # Generate or return cached PDF
    if not proposal.pdf_binary:
        exporter = ProposalPDFExporter()
        pdf_bytes = exporter.generate_pdf(proposal)
        proposal.pdf_binary = pdf_bytes
        db.add(proposal)
        await db.commit()
        log.info("proposal.pdf.generated", size_bytes=len(pdf_bytes))
    else:
        pdf_bytes = proposal.pdf_binary
        log.info("proposal.pdf.cached")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=proposal-{proposal_id}.pdf"},
    )


@router.post("/proposals/{proposal_id}/share")
async def create_share_link_endpoint(
    proposal_id: str,
    request: ShareLinkCreateRequest,
    db=Depends(get_db),
    _=Depends(require_auth),
):
    """Generate a shareable read-only link for a proposal."""
    tenant_id = get_tenant_id()

    proposal = await get_proposal_by_id(proposal_id, tenant_id, db)
    if not proposal:
        raise AppError("PROPOSAL_NOT_FOUND", f"Proposal {proposal_id} not found", status_code=404)

    if proposal.status != ProposalStatus.COMPLETED:
        raise AppError("PROPOSAL_NOT_READY", "Proposal generation is not complete", status_code=409)

    share_link = await create_share_link(proposal.id, request.expires_in_days, db)
    share_url = f"{settings.base_url}/api/v1/shared/{share_link.token}"

    return ShareLinkResponse(
        share_url=share_url,
        token=share_link.token,
        expires_at=share_link.expires_at,
        created_at=share_link.created_at,
    )


@router.get("/shared/{share_token}")
async def get_shared_proposal(
    share_token: str,
    db=Depends(get_db),
    # NO auth dependency -- public endpoint
):
    """View a shared proposal via token. No authentication required."""
    proposal = await get_proposal_by_share_token(share_token, db)

    if proposal is None:
        # Check if token exists but is expired/revoked
        result = await db.execute(
            select(ShareLink).where(ShareLink.token == share_token)
        )
        share_link = result.scalars().first()
        if share_link:
            raise AppError("SHARE_LINK_EXPIRED", "This share link has expired or been revoked", status_code=410)
        raise AppError("SHARE_LINK_NOT_FOUND", "Share link not found", status_code=404)

    return SharedProposalResponse(
        title=proposal.title,
        content=proposal.content,
        created_at=proposal.created_at,
    )
```

### Database Model Patterns

Follow existing patterns from `models/advisory_session.py`:

```python
# models/proposal.py
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Column, Field, Relationship, SQLModel
from sqlalchemy import LargeBinary, JSON


class ProposalStatus(str, Enum):
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class Proposal(SQLModel, table=True):
    __tablename__ = "proposals"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    advisory_session_id: uuid.UUID = Field(foreign_key="advisory_sessions.id", index=True)
    tenant_id: str = Field(index=True, max_length=64)
    status: ProposalStatus = Field(default=ProposalStatus.GENERATING)
    title: str = Field(max_length=500, default="Travel Proposal")
    content: dict = Field(default_factory=dict, sa_column=Column(JSON))
    pdf_binary: bytes | None = Field(default=None, sa_column=Column(LargeBinary, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow())

    advisory_session: Optional["AdvisorySession"] = Relationship(  # noqa: F821
        back_populates="proposals",
    )
    share_links: list["ShareLink"] = Relationship(  # noqa: F821
        back_populates="proposal",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class ShareLink(SQLModel, table=True):
    __tablename__ = "share_links"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    proposal_id: uuid.UUID = Field(foreign_key="proposals.id", index=True)
    token: str = Field(max_length=64, unique=True, index=True)
    expires_at: datetime
    is_revoked: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())

    proposal: Optional["Proposal"] = Relationship(  # noqa: F821
        back_populates="share_links",
    )
```

### Router Registration

```python
# api/v1/router.py -- add proposals router
from app.api.v1 import health, auth, sessions, streaming, proposals

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(sessions.router, tags=["sessions"])
api_router.include_router(streaming.router, prefix="/stream", tags=["streaming"])
api_router.include_router(proposals.router, tags=["proposals"])
```

Note: The shared endpoint (`/shared/{token}`) is registered in the proposals router but is public. The `/api/v1/shared/` prefix must be added to `PUBLIC_PATHS` in `core/tenant.py`.

### Dependency on Prior Stories

This story depends on the following being complete:

| Story | What It Provides | Required By |
|---|---|---|
| 1.2 | `AdvisorySession` model, DB infrastructure | `Proposal.advisory_session_id` FK |
| 1.6 | Auth, tenant middleware, `require_auth` dependency | Export/share endpoint auth |
| 3.5 | Proposal Agent -- itinerary generation | Proposal `content` data to export |
| 3.6 | Comparison table, budget breakdown, booking actions | Full proposal content |

If Stories 3.5 and 3.6 are not yet implemented, this story can still be built and tested with mock proposal data in the `content` JSON column. The PDF template and share link logic are independent of how the proposal content is generated.

### AdvisorySession Model Update

The `AdvisorySession` model needs a `proposals` relationship added. Update `models/advisory_session.py`:

```python
# Add to AdvisorySession class
proposals: list["Proposal"] = Relationship(  # noqa: F821
    back_populates="advisory_session",
    sa_relationship_kwargs={"cascade": "all, delete-orphan"},
)
```

### Configuration Additions

```python
# Add to core/config.py Settings class
base_url: str = "http://localhost:8000"  # Used to construct share URLs
share_link_default_expiry_days: int = 30
share_link_max_expiry_days: int = 365
```

### File Structure

```
backend/app/
├── api/v1/
│   ├── proposals.py              # NEW -- export, share, shared view endpoints
│   └── router.py                 # MODIFIED -- register proposals router
├── models/
│   ├── proposal.py               # NEW -- Proposal + ShareLink SQLModels
│   ├── advisory_session.py       # MODIFIED -- add proposals Relationship
│   └── __init__.py               # MODIFIED -- export Proposal, ShareLink
├── schemas/
│   └── proposal.py               # NEW -- request/response schemas
├── agents/proposal/
│   ├── export.py                 # NEW -- ProposalPDFExporter + share token utils
│   ├── templates/
│   │   └── proposal_pdf.html     # NEW -- Jinja2 HTML template for PDF
│   └── tests/
│       ├── test_export.py        # NEW -- PDF generation tests
│       └── test_share.py         # NEW -- share token tests
├── core/
│   ├── config.py                 # MODIFIED -- add base_url, share_link settings
│   └── tenant.py                 # MODIFIED -- add /api/v1/shared/ to public paths
└── tests/
    └── unit/
        └── test_proposals_api.py # NEW -- API endpoint tests
```

### Anti-Patterns -- DO NOT

- **DO NOT use ReportLab** -- WeasyPrint is the selected library for this project (HTML/CSS to PDF)
- **DO NOT store PDFs on the filesystem** -- Store in PostgreSQL `BYTEA` column for Phase 3. Object storage deferred to Phase 4
- **DO NOT generate PDF content from LLM** -- All proposal content is already in the `Proposal.content` JSON column, generated by Stories 3.5/3.6 with entity validation
- **DO NOT expose `tenant_id` in shared proposal responses** -- The `SharedProposalResponse` schema must strip internal fields
- **DO NOT expose `advisory_session_id` in shared proposal responses** -- Same as above
- **DO NOT use stdlib `logging`** -- Use `structlog` only
- **DO NOT use `session.exec()`** with AsyncSession -- Use `session.execute()` with `.scalars()`
- **DO NOT use `from __future__ import annotations`** in model files -- Breaks SQLModel Relationships
- **DO NOT use `datetime.now(timezone.utc)`** for DB timestamps -- Use `datetime.utcnow()` (naive UTC)
- **DO NOT create frontend components** -- This story is backend-only; frontend is covered by Stories 1.8 and 5.1
- **DO NOT use predictable share tokens** -- Use `secrets.token_urlsafe(32)` for cryptographic randomness
- **DO NOT allow share links without expiry** -- Always enforce an expiry date

### Testing Requirements

- **Unit tests** pass with PostgreSQL only -- no Qdrant, no Redis, no LLM required
- **PDF tests** require `weasyprint` installed (system deps: `pango`, `cairo`)
- Mock proposal content for all tests -- do not depend on Stories 3.5/3.6 output
- Use `conftest.py` fixtures for `test_tenant`, `test_user`, `auth_headers` as established in Story 1.6
- Mark any DB-dependent tests with `@pytest.mark.integration`

### References

- [Source: architecture.md -- Gap Analysis: "PDF export library (FR-14): weasyprint or reportlab"]
- [Source: architecture.md -- Data Architecture: "Business data: SQLModel + PostgreSQL -- Proposals"]
- [Source: architecture.md -- API & Communication Patterns: "REST + versioned endpoints"]
- [Source: architecture.md -- Authentication & Security: "B2C auth: None (session-based)"]
- [Source: architecture.md -- Project Structure: "agents/proposal/ -- FR-10 to FR-14"]
- [Source: architecture.md -- Data Flow: "If no blocks -> api/v1/proposals.py (export PDF/link)"]
- [Source: architecture.md -- Naming Patterns: snake_case for DB/API, PascalCase for classes]
- [Source: epics.md -- Story 3.7: Proposal Export -- PDF & Shareable Link]
- [Source: epics.md -- FR-14: Proposal Export]
- [Source: epics.md -- FR-28: No Authentication Required (for shared link)]
- [Source: project-context.md -- SQLAlchemy Async patterns, datetime rules, relationship rules]

## Dev Agent Record

### Agent Model Used

_(to be filled by implementing agent)_

### Debug Log References

_(to be filled during implementation)_

### Completion Notes List

_(to be filled on completion)_

### Change Log

- 2026-05-24: Story spec created -- ready for dev

### File List

_(to be filled on completion)_
