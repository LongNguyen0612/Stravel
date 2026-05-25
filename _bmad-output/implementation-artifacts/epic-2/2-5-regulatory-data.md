# Story 2.5: Regulatory Data Ingestion

Status: done

## Story

As a system,
I want visa rules, health advisories, and travel warnings stored in structured, searchable format,
so that the Compliance Agent can validate proposals against current regulations.

**Depends on:** Story 2.1 (Qdrant Vector Store Setup & Entity Model), Story 2.2 (Entity Ingestion Pipeline -- provides `etl/pipeline.py` base class, `etl/deduplication.py`)

**FRs implemented:** FR-32 (Regulatory Data Ingestion)
**FRs partially advanced:** FR-15 (Visa Requirement Validation -- data layer), FR-16 (Health & Vaccination Advisory -- data layer), FR-17 (Travel Advisory Check -- data layer)

## Acceptance Criteria

### AC-1: Regulatory ETL Pipeline
**Given** `etl/regulatory.py` exists with ingestion logic for regulatory data
**When** the pipeline is run against source files in `data/seed/`
**Then** three regulatory data categories are ingested: visa rules, health advisories, and travel warnings
**And** the pipeline extends the base `etl/pipeline.py` class with `extract()`, `transform()`, `load()` methods
**And** ingestion logs record success/failure counts per category via `structlog`

### AC-2: Visa Rules Data Structure
**Given** visa rules are ingested from `data/seed/visa_rules.json`
**When** the rules are loaded into the system
**Then** each nationality entry contains:
- `country_code` (ISO 3166-1 alpha-2)
- `country_name`
- `visa_type` (one of: `visa_free_45`, `visa_free_30`, `e_visa`, `embassy_visa`, `visa_free_90`)
- `max_duration_days` (integer)
- `cost_usd` (float, 0 for visa-free)
- `processing_time_days` (integer range: min/max)
- `entry_points` (list of allowed entry ports, or `"all"`)
- `requirements` (list of strings: passport validity, photos, etc.)
- `application_url` (string or null)
- `notes` (free-text for special conditions)
- `last_verified_date` (ISO 8601 date)
- `source_url` (government or official source)

### AC-3: Phu Quoc Special Case
**Given** a nationality that normally requires an e-visa for Vietnam (e.g., India, Russia)
**When** the traveler plans to stay exclusively on Phu Quoc island
**Then** the visa rules data correctly represents the 30-day visa-free exception for Phu Quoc
**And** the data includes a `phu_quoc_exception` object with:
- `eligible`: true
- `max_duration_days`: 30
- `restriction`: `"island_only"` -- traveler must not visit mainland Vietnam
- `entry_points`: `["Phu Quoc International Airport (PQC)"]`
- `warning`: `"If combining Phu Quoc with mainland destinations, standard visa requirements apply"`
**And** nationalities that are visa-free for mainland Vietnam (e.g., Germany 45 days) have `phu_quoc_exception.eligible: false` with `note: "Already covered by standard visa-free entry"`

### AC-4: Nationality Coverage
**Given** the visa rules seed data
**When** the file is inspected
**Then** at least 20 nationalities are represented including:
- **Visa-free 45 days:** Germany, UK, France, Italy, Spain, Japan, South Korea
- **Visa-free 30 days (ASEAN):** Thailand, Singapore, Malaysia, Indonesia, Philippines
- **Visa-free 90 days:** Chile (for testing longer stays)
- **E-visa required:** USA, Canada, Australia, India, China, Russia
- **Embassy visa required:** At least 2 nationalities for edge-case testing
**And** each entry has realistic cost, processing time, and requirement data

### AC-5: Health Advisory Data Structure
**Given** health advisories are ingested from `data/seed/health_advisories.json`
**When** the advisories are loaded
**Then** each entry contains:
- `advisory_id` (unique identifier)
- `category` (one of: `vaccination`, `disease_risk`, `general_health`)
- `name` (e.g., "Hepatitis A", "Japanese Encephalitis", "Malaria")
- `status` (one of: `required`, `recommended`, `situational`)
- `description` (concise advisory text)
- `affected_regions` (list of Vietnam region codes, or `"all"`)
- `risk_level` (one of: `low`, `medium`, `high`)
- `precautions` (list of recommended actions)
- `source_url` (WHO, CDC, or national health authority)
- `last_verified_date` (ISO 8601 date)

### AC-6: Travel Warning Data Structure
**Given** travel warnings are ingested from `data/seed/travel_warnings.json`
**When** the warnings are loaded
**Then** each entry contains:
- `warning_id` (unique identifier)
- `issuing_country` (country code of the government issuing the warning)
- `severity` (one of: `do_not_travel`, `reconsider_travel`, `exercise_caution`, `normal_precautions`)
- `affected_regions` (list of Vietnam region codes, or `"all"`)
- `summary` (short description)
- `details` (full advisory text)
- `effective_date` (ISO 8601 date)
- `expiry_date` (ISO 8601 date or null for ongoing)
- `source_url` (government advisory page)
- `last_verified_date` (ISO 8601 date)

### AC-7: Compliance Rules JSON Files
**Given** the `agents/compliance/rules/` directory
**When** the regulatory ETL pipeline completes
**Then** the following JSON files are populated with Vietnam-specific data:
- `agents/compliance/rules/visa_rules.json` -- structured visa rules per nationality
- `agents/compliance/rules/health_advisories.json` -- vaccination and health data
- `agents/compliance/rules/travel_warnings.json` -- government travel advisories
- `agents/compliance/rules/age_restrictions.json` -- activity age minimums (populated with Vietnam-specific data for downstream Story 4.2)
- `agents/compliance/rules/seasonal_patterns.json` -- monsoon data by region (populated for downstream Story 4.3)
**And** each file is valid JSON parseable by the Compliance Agent

### AC-8: Keyword Lookup by Country Code
**Given** regulatory data is loaded in the system
**When** a keyword lookup is performed with a country code (e.g., `"DE"` for Germany)
**Then** the system returns all visa rules for that nationality
**And** lookup time is under 100ms for the seed dataset
**And** the lookup is case-insensitive

### AC-9: Semantic Search for Regulation Interpretation
**Given** regulatory data is indexed in the Vector Store with embeddings
**When** a semantic search is performed (e.g., `"Can I visit Phu Quoc without a visa if I'm Russian?"`)
**Then** the system returns relevant regulatory entries ranked by semantic similarity
**And** the Phu Quoc special case entry is included in the top results
**And** results include the source document metadata for traceability

### AC-10: Unit Tests
**Given** the test suite at `etl/tests/test_regulatory.py`
**When** tests are run with `pytest`
**Then** the following tests pass:
- `test_visa_rules_ingestion` -- JSON source loads and transforms correctly
- `test_phu_quoc_exception_structure` -- special case data is well-formed for e-visa nationalities
- `test_phu_quoc_not_applicable_for_visa_free` -- visa-free nationalities have `phu_quoc_exception.eligible: false`
- `test_health_advisory_ingestion` -- all health entries have required fields
- `test_travel_warning_ingestion` -- all warning entries have required fields
- `test_keyword_lookup_by_country_code` -- exact match by ISO country code
- `test_keyword_lookup_case_insensitive` -- `"de"`, `"DE"`, `"De"` all return Germany
- `test_nationality_not_found` -- unknown country code returns empty result (not an error)
- `test_compliance_rules_json_valid` -- each file in `agents/compliance/rules/` is valid JSON
- `test_idempotent_ingestion` -- running ingestion twice does not create duplicate entries
**And** all tests pass with mock Vector Store (no Qdrant required)

## Tasks

- [ ] Task 1: Create regulatory seed data files (AC: #2, #3, #4, #5, #6)
  - [ ] Create `data/seed/visa_rules.json` with 20+ nationality entries (see Dev Notes for schema)
  - [ ] Implement Phu Quoc exception data for all e-visa-required nationalities
  - [ ] Ensure visa-free nationalities have `phu_quoc_exception.eligible: false`
  - [ ] Create `data/seed/health_advisories.json` with Vietnam-specific health data
  - [ ] Create `data/seed/travel_warnings.json` with sample advisory data from multiple issuing countries
  - [ ] Validate all JSON files parse correctly

- [ ] Task 2: Create regulatory Pydantic schemas (AC: #2, #5, #6)
  - [ ] Create `etl/schemas/regulatory.py` with:
    - `VisaType` enum: `VISA_FREE_45`, `VISA_FREE_30`, `E_VISA`, `EMBASSY_VISA`, `VISA_FREE_90`
    - `PhuQuocException` model with `eligible`, `max_duration_days`, `restriction`, `entry_points`, `warning`
    - `VisaRule` model with all fields from AC-2 + `phu_quoc_exception: PhuQuocException`
    - `HealthAdvisoryCategory` enum: `VACCINATION`, `DISEASE_RISK`, `GENERAL_HEALTH`
    - `HealthAdvisoryStatus` enum: `REQUIRED`, `RECOMMENDED`, `SITUATIONAL`
    - `RiskLevel` enum: `LOW`, `MEDIUM`, `HIGH`
    - `HealthAdvisory` model with all fields from AC-5
    - `TravelWarningSeverity` enum: `DO_NOT_TRAVEL`, `RECONSIDER_TRAVEL`, `EXERCISE_CAUTION`, `NORMAL_PRECAUTIONS`
    - `TravelWarning` model with all fields from AC-6
    - `RegulatoryDataset` model: container for all three data types

- [ ] Task 3: Implement regulatory ETL pipeline (AC: #1, #7)
  - [ ] Create `etl/regulatory.py` extending base pipeline from `etl/pipeline.py`
  - [ ] Implement `extract()` -- load JSON files from `data/seed/` directory
  - [ ] Implement `transform()` -- validate all entries against Pydantic schemas, reject malformed
  - [ ] Implement `load()` -- write validated data to `agents/compliance/rules/` JSON files + index in Vector Store
  - [ ] Add `structlog` logging for ingestion counts per category
  - [ ] Handle partial failures -- log and skip invalid entries, continue with valid ones

- [ ] Task 4: Create compliance rules directory and JSON files (AC: #7)
  - [ ] Create `agents/compliance/rules/` directory
  - [ ] Create `agents/compliance/rules/__init__.py` with a `load_rules(rule_type: str) -> dict` helper
  - [ ] Generate `visa_rules.json` from ETL output
  - [ ] Generate `health_advisories.json` from ETL output
  - [ ] Generate `travel_warnings.json` from ETL output
  - [ ] Create `age_restrictions.json` with Vietnam activity data (scuba min 10, motorbike min 18, etc.)
  - [ ] Create `seasonal_patterns.json` with Vietnam regional monsoon data (North May-Oct, Central Sep-Jan, South May-Oct)

- [ ] Task 5: Implement keyword lookup (AC: #8)
  - [ ] Implement `lookup_visa_by_country(country_code: str) -> VisaRule | None` in `etl/regulatory.py`
  - [ ] Implement `lookup_health_advisories(region: str | None = None) -> list[HealthAdvisory]`
  - [ ] Implement `lookup_travel_warnings(issuing_country: str | None = None) -> list[TravelWarning]`
  - [ ] Ensure case-insensitive matching for country codes
  - [ ] Return `None` / empty list for unknown codes (not exceptions)

- [ ] Task 6: Implement Vector Store indexing for semantic search (AC: #9)
  - [ ] Create regulatory document embeddings via `rag/embeddings.py`
  - [ ] Index visa rules with metadata: `type=regulatory`, `subtype=visa`, `country_code=XX`
  - [ ] Index health advisories with metadata: `type=regulatory`, `subtype=health`, `region=XX`
  - [ ] Index travel warnings with metadata: `type=regulatory`, `subtype=warning`, `severity=XX`
  - [ ] Ensure deduplication via `etl/deduplication.py` on re-ingestion

- [ ] Task 7: Write unit tests (AC: #10)
  - [ ] Create `etl/tests/__init__.py` (if not exists)
  - [ ] Create `etl/tests/test_regulatory.py` with all tests from AC-10
  - [ ] Create mock Vector Store fixture for semantic search tests
  - [ ] All tests pass with `pytest -m "not integration"` (no Qdrant required)

## Dev Notes

### Architecture Constraints

- **Python 3.12+** with modern syntax
- **Pydantic v2** for all data schemas
- **structlog** for all logging -- never use stdlib `logging`
- **Protocol interfaces** -- use `VectorStoreProtocol` for indexing, never import Qdrant directly
- **Base pipeline pattern** -- extend `etl/pipeline.py` base class from Story 2.2
- **Deduplication** -- use `etl/deduplication.py` from Story 2.2 to prevent duplicate regulatory entries on re-ingestion
- **No auth context** -- regulatory data is global (not tenant-scoped). Unlike Entity data, visa rules are the same for all tenants
- **Co-located tests** -- tests live at `etl/tests/`, not in top-level `tests/`

### Visa Rules JSON Schema

```json
{
  "visa_rules": [
    {
      "country_code": "DE",
      "country_name": "Germany",
      "visa_type": "visa_free_45",
      "max_duration_days": 45,
      "cost_usd": 0,
      "processing_time_days": {"min": 0, "max": 0},
      "entry_points": "all",
      "requirements": [
        "Passport valid for at least 6 months beyond entry date",
        "Return or onward ticket",
        "Proof of accommodation"
      ],
      "application_url": null,
      "notes": "Visa exemption for single entry up to 45 days. For stays exceeding 45 days, apply for e-visa or visa at embassy.",
      "phu_quoc_exception": {
        "eligible": false,
        "max_duration_days": null,
        "restriction": null,
        "entry_points": null,
        "warning": null,
        "note": "Already covered by standard visa-free entry"
      },
      "last_verified_date": "2026-04-15",
      "source_url": "https://evisa.xuatnhapcanh.gov.vn"
    },
    {
      "country_code": "RU",
      "country_name": "Russia",
      "visa_type": "visa_free_45",
      "max_duration_days": 45,
      "cost_usd": 0,
      "processing_time_days": {"min": 0, "max": 0},
      "entry_points": "all",
      "requirements": [
        "Passport valid for at least 6 months beyond entry date",
        "Return or onward ticket"
      ],
      "application_url": null,
      "notes": "Visa exemption for single entry up to 45 days. For longer stays, e-visa required.",
      "phu_quoc_exception": {
        "eligible": false,
        "max_duration_days": null,
        "restriction": null,
        "entry_points": null,
        "warning": null,
        "note": "Already covered by standard visa-free entry"
      },
      "last_verified_date": "2026-04-15",
      "source_url": "https://evisa.xuatnhapcanh.gov.vn"
    },
    {
      "country_code": "IN",
      "country_name": "India",
      "visa_type": "e_visa",
      "max_duration_days": 90,
      "cost_usd": 25,
      "processing_time_days": {"min": 3, "max": 5},
      "entry_points": "all",
      "requirements": [
        "Passport valid for at least 6 months beyond entry date",
        "Passport-size photo (4x6cm, white background)",
        "Return or onward ticket",
        "Proof of accommodation",
        "Sufficient funds for stay"
      ],
      "application_url": "https://evisa.xuatnhapcanh.gov.vn",
      "notes": "E-visa valid for single or multiple entry, up to 90 days.",
      "phu_quoc_exception": {
        "eligible": true,
        "max_duration_days": 30,
        "restriction": "island_only",
        "entry_points": ["Phu Quoc International Airport (PQC)"],
        "warning": "If combining Phu Quoc with mainland Vietnam destinations, standard e-visa is required. Visa-free applies ONLY when staying exclusively on Phu Quoc island."
      },
      "last_verified_date": "2026-04-15",
      "source_url": "https://evisa.xuatnhapcanh.gov.vn"
    }
  ]
}
```

### Nationality List for Seed Data

Include at least these 20+ nationalities with accurate 2026 visa policy data:

| Country Code | Country Name | Visa Type | Phu Quoc Exception |
|---|---|---|---|
| DE | Germany | visa_free_45 | N/A (already visa-free) |
| GB | United Kingdom | visa_free_45 | N/A |
| FR | France | visa_free_45 | N/A |
| IT | Italy | visa_free_45 | N/A |
| ES | Spain | visa_free_45 | N/A |
| JP | Japan | visa_free_45 | N/A |
| KR | South Korea | visa_free_45 | N/A |
| RU | Russia | visa_free_45 | N/A |
| TH | Thailand | visa_free_30 | N/A (ASEAN) |
| SG | Singapore | visa_free_30 | N/A (ASEAN) |
| MY | Malaysia | visa_free_30 | N/A (ASEAN) |
| ID | Indonesia | visa_free_30 | N/A (ASEAN) |
| PH | Philippines | visa_free_30 | N/A (ASEAN) |
| CL | Chile | visa_free_90 | N/A |
| US | United States | e_visa | Eligible |
| CA | Canada | e_visa | Eligible |
| AU | Australia | e_visa | Eligible |
| IN | India | e_visa | Eligible |
| CN | China | e_visa | Eligible |
| BR | Brazil | e_visa | Eligible |
| NG | Nigeria | embassy_visa | Eligible |
| PK | Pakistan | embassy_visa | Eligible |

**Note on Phu Quoc:** As of 2025, Vietnam expanded its visa-free list significantly. The E2E test in Story 6.3 Suite 3 uses a Russian client visiting Phu Quoc + HCMC. Russia is now visa-free 45 days, so the "Phu Quoc trap" scenario in UJ-3 applies to nationalities that still require e-visa (US, AU, IN, CN, etc.). The seed data must correctly represent: for e-visa nationalities, the Phu Quoc exception allows visa-free island-only stays, but combining with mainland requires the e-visa. For already-visa-free nationalities, the exception is irrelevant.

### Health Advisory Seed Data

Include Vietnam-specific health advisories:

```json
{
  "health_advisories": [
    {
      "advisory_id": "HA-VN-001",
      "category": "vaccination",
      "name": "Hepatitis A",
      "status": "recommended",
      "description": "Hepatitis A is present in Vietnam. Vaccination recommended for all travelers.",
      "affected_regions": "all",
      "risk_level": "medium",
      "precautions": [
        "Get vaccinated at least 2 weeks before travel",
        "Avoid uncooked food and untreated water in rural areas"
      ],
      "source_url": "https://www.who.int/countries/vnm",
      "last_verified_date": "2026-03-01"
    },
    {
      "advisory_id": "HA-VN-002",
      "category": "vaccination",
      "name": "Hepatitis B",
      "status": "recommended",
      "description": "Hepatitis B is endemic in Vietnam. Vaccination recommended for travelers with potential exposure.",
      "affected_regions": "all",
      "risk_level": "medium",
      "precautions": [
        "Get vaccinated if not already immunized",
        "Avoid contact with blood or body fluids"
      ],
      "source_url": "https://www.who.int/countries/vnm",
      "last_verified_date": "2026-03-01"
    },
    {
      "advisory_id": "HA-VN-003",
      "category": "vaccination",
      "name": "Typhoid",
      "status": "recommended",
      "description": "Typhoid risk in areas with poor sanitation. Vaccination recommended for travelers visiting rural areas.",
      "affected_regions": "all",
      "risk_level": "medium",
      "precautions": [
        "Get vaccinated before travel",
        "Drink only bottled or boiled water",
        "Eat thoroughly cooked food"
      ],
      "source_url": "https://www.cdc.gov/typhoid-fever/",
      "last_verified_date": "2026-03-01"
    },
    {
      "advisory_id": "HA-VN-004",
      "category": "vaccination",
      "name": "Japanese Encephalitis",
      "status": "situational",
      "description": "Risk in rural agricultural areas, especially during rainy season. Vaccination recommended for extended stays in rural areas.",
      "affected_regions": ["north", "central", "mekong_delta"],
      "risk_level": "low",
      "precautions": [
        "Consider vaccination for stays > 1 month in rural areas",
        "Use mosquito repellent and bed nets"
      ],
      "source_url": "https://www.who.int/news-room/fact-sheets/detail/japanese-encephalitis",
      "last_verified_date": "2026-03-01"
    },
    {
      "advisory_id": "HA-VN-005",
      "category": "disease_risk",
      "name": "Dengue Fever",
      "status": "situational",
      "description": "Dengue is transmitted by mosquitoes throughout Vietnam, with higher risk during rainy season (May-November).",
      "affected_regions": "all",
      "risk_level": "medium",
      "precautions": [
        "Use insect repellent containing DEET",
        "Wear long sleeves and pants during dawn and dusk",
        "Use air-conditioned or screened accommodations"
      ],
      "source_url": "https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue",
      "last_verified_date": "2026-03-01"
    },
    {
      "advisory_id": "HA-VN-006",
      "category": "disease_risk",
      "name": "Malaria",
      "status": "situational",
      "description": "Malaria risk exists in remote forested and highland areas. Major cities and tourist areas are generally malaria-free.",
      "affected_regions": ["central_highlands", "north"],
      "risk_level": "low",
      "precautions": [
        "Consider antimalarial medication for treks in highland forests",
        "Use mosquito nets and repellent",
        "Not required for major cities and beach destinations"
      ],
      "source_url": "https://www.cdc.gov/malaria/",
      "last_verified_date": "2026-03-01"
    },
    {
      "advisory_id": "HA-VN-007",
      "category": "general_health",
      "name": "Traveler's Diarrhea",
      "status": "recommended",
      "description": "Common among visitors. Risk can be reduced with food and water precautions.",
      "affected_regions": "all",
      "risk_level": "medium",
      "precautions": [
        "Drink bottled or purified water only",
        "Avoid ice from unknown sources",
        "Eat at busy, reputable establishments",
        "Carry oral rehydration salts"
      ],
      "source_url": "https://www.cdc.gov/travelers-diarrhea/",
      "last_verified_date": "2026-03-01"
    },
    {
      "advisory_id": "HA-VN-008",
      "category": "vaccination",
      "name": "Rabies",
      "status": "situational",
      "description": "Rabies is present in Vietnam. Pre-exposure vaccination recommended for travelers with animal contact risk.",
      "affected_regions": "all",
      "risk_level": "low",
      "precautions": [
        "Consider pre-exposure vaccination for extended rural stays",
        "Avoid contact with stray dogs and cats",
        "Seek immediate medical attention for any animal bite"
      ],
      "source_url": "https://www.who.int/news-room/fact-sheets/detail/rabies",
      "last_verified_date": "2026-03-01"
    }
  ]
}
```

### Travel Warning Seed Data

Include sample warnings from major travel advisory issuing countries:

```json
{
  "travel_warnings": [
    {
      "warning_id": "TW-US-VN-001",
      "issuing_country": "US",
      "severity": "exercise_caution",
      "affected_regions": "all",
      "summary": "Exercise increased caution in Vietnam.",
      "details": "Exercise increased caution in Vietnam due to limited and inconsistent enforcement of traffic safety laws. Review local traffic laws before driving or renting motorbikes.",
      "effective_date": "2026-01-15",
      "expiry_date": null,
      "source_url": "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/vietnam-travel-advisory.html",
      "last_verified_date": "2026-04-01"
    },
    {
      "warning_id": "TW-GB-VN-001",
      "issuing_country": "GB",
      "severity": "normal_precautions",
      "affected_regions": "all",
      "summary": "See our travel advice before travelling to Vietnam.",
      "details": "Most visits to Vietnam are trouble-free. Be alert to the risk of street crime including bag snatching, particularly in major cities.",
      "effective_date": "2026-02-01",
      "expiry_date": null,
      "source_url": "https://www.gov.uk/foreign-travel-advice/vietnam",
      "last_verified_date": "2026-04-01"
    },
    {
      "warning_id": "TW-AU-VN-001",
      "issuing_country": "AU",
      "severity": "exercise_caution",
      "affected_regions": "all",
      "summary": "Exercise a high degree of caution in Vietnam.",
      "details": "Exercise a high degree of caution in Vietnam due to the risk of petty crime and traffic accidents. Avoid demonstrations and large gatherings.",
      "effective_date": "2026-01-20",
      "expiry_date": null,
      "source_url": "https://www.smartraveller.gov.au/destinations/asia/vietnam",
      "last_verified_date": "2026-04-01"
    }
  ]
}
```

### Age Restrictions Seed Data (for `agents/compliance/rules/age_restrictions.json`)

This file prepopulates activity age restrictions for downstream Story 4.2:

```json
{
  "age_restrictions": [
    {
      "activity_type": "scuba_diving",
      "display_name": "Scuba Diving (Open Water)",
      "minimum_age": 10,
      "alternative_activity": "snorkeling",
      "alternative_display_name": "Snorkeling",
      "alternative_minimum_age": 5,
      "source": "PADI Open Water Diver certification requirements"
    },
    {
      "activity_type": "motorbike_rental",
      "display_name": "Motorbike Rental / Riding",
      "minimum_age": 18,
      "alternative_activity": "bicycle_tour",
      "alternative_display_name": "Bicycle Tour",
      "alternative_minimum_age": 8,
      "source": "Vietnam traffic law - minimum motorcycle license age"
    },
    {
      "activity_type": "parasailing",
      "display_name": "Parasailing",
      "minimum_age": 12,
      "alternative_activity": "banana_boat",
      "alternative_display_name": "Banana Boat Ride",
      "alternative_minimum_age": 5,
      "source": "Standard operator insurance requirements"
    },
    {
      "activity_type": "jet_ski",
      "display_name": "Jet Ski",
      "minimum_age": 16,
      "alternative_activity": "kayaking",
      "alternative_display_name": "Kayaking (Guided)",
      "alternative_minimum_age": 6,
      "source": "Standard operator insurance requirements"
    },
    {
      "activity_type": "zipline",
      "display_name": "Zipline / Canopy Tour",
      "minimum_age": 7,
      "alternative_activity": "nature_walk",
      "alternative_display_name": "Guided Nature Walk",
      "alternative_minimum_age": 3,
      "source": "Standard operator safety guidelines"
    },
    {
      "activity_type": "cave_exploration_advanced",
      "display_name": "Advanced Cave Exploration (Son Doong, Hang En)",
      "minimum_age": 16,
      "alternative_activity": "cave_exploration_basic",
      "alternative_display_name": "Basic Cave Visit (Paradise Cave, Phong Nha Cave)",
      "alternative_minimum_age": 5,
      "source": "Tour operator requirements (Oxalis)"
    }
  ]
}
```

### Seasonal Patterns Seed Data (for `agents/compliance/rules/seasonal_patterns.json`)

This file prepopulates monsoon data for downstream Story 4.3:

```json
{
  "seasonal_patterns": {
    "north": {
      "region_name": "Northern Vietnam",
      "destinations": ["hanoi", "sapa", "ha_long_bay", "ninh_binh"],
      "monsoon_months": [5, 6, 7, 8, 9, 10],
      "monsoon_severity": "moderate",
      "best_months": [10, 11, 12, 1, 2, 3, 4],
      "cold_months": [12, 1, 2],
      "notes": "Heavy rainfall May-October. Cool and dry October-April. Sapa can be cold in December-February (5-15C)."
    },
    "central": {
      "region_name": "Central Vietnam",
      "destinations": ["da_nang", "hoi_an", "hue"],
      "monsoon_months": [9, 10, 11, 12, 1],
      "monsoon_severity": "heavy",
      "best_months": [2, 3, 4, 5, 6, 7, 8],
      "cold_months": [],
      "notes": "Heaviest rainfall and typhoon risk September-January. Hoi An floods common in October-November. Best weather February-August."
    },
    "south": {
      "region_name": "Southern Vietnam",
      "destinations": ["ho_chi_minh_city", "mekong_delta", "phu_quoc", "vung_tau"],
      "monsoon_months": [5, 6, 7, 8, 9, 10],
      "monsoon_severity": "moderate",
      "best_months": [11, 12, 1, 2, 3, 4],
      "cold_months": [],
      "notes": "Afternoon thunderstorms May-October but rarely all-day rain. Phu Quoc best November-March. Mekong Delta flooding possible August-October."
    },
    "central_highlands": {
      "region_name": "Central Highlands",
      "destinations": ["da_lat"],
      "monsoon_months": [5, 6, 7, 8, 9, 10],
      "monsoon_severity": "moderate",
      "best_months": [11, 12, 1, 2, 3, 4],
      "cold_months": [12, 1, 2],
      "notes": "Cooler than lowlands year-round (15-25C). Rainy season May-October. Da Lat pleasant year-round but wettest June-September."
    },
    "south_central_coast": {
      "region_name": "South Central Coast",
      "destinations": ["nha_trang", "mui_ne", "quy_nhon"],
      "monsoon_months": [10, 11, 12],
      "monsoon_severity": "moderate",
      "best_months": [1, 2, 3, 4, 5, 6, 7, 8, 9],
      "cold_months": [],
      "notes": "Nha Trang has shorter rainy season than central coast. Best beach weather January-September. Mui Ne windy and great for kitesurfing November-March."
    }
  }
}
```

### Regulatory ETL Pipeline Pattern

```python
# etl/regulatory.py
import json
from pathlib import Path

import structlog

from app.agents.protocols import VectorStoreProtocol
from app.etl.pipeline import BasePipeline
from app.etl.schemas.regulatory import (
    HealthAdvisory,
    RegulatoryDataset,
    TravelWarning,
    VisaRule,
)

logger = structlog.get_logger()

SEED_DATA_DIR = Path("data/seed")
RULES_OUTPUT_DIR = Path("backend/app/agents/compliance/rules")


class RegulatoryPipeline(BasePipeline):
    """ETL pipeline for regulatory data ingestion."""

    def __init__(self, vector_store: VectorStoreProtocol | None = None):
        self.vector_store = vector_store
        self._raw_data: dict = {}
        self._validated_data: RegulatoryDataset | None = None

    async def extract(self) -> None:
        """Load JSON source files from seed data directory."""
        for filename in ["visa_rules.json", "health_advisories.json", "travel_warnings.json"]:
            filepath = SEED_DATA_DIR / filename
            if filepath.exists():
                with open(filepath) as f:
                    self._raw_data[filename] = json.load(f)
                logger.info("regulatory.extracted", file=filename)
            else:
                logger.warning("regulatory.file_missing", file=filename)

    async def transform(self) -> None:
        """Validate all entries against Pydantic schemas."""
        visa_rules = []
        health_advisories = []
        travel_warnings = []

        # Parse visa rules
        for entry in self._raw_data.get("visa_rules.json", {}).get("visa_rules", []):
            try:
                visa_rules.append(VisaRule.model_validate(entry))
            except Exception as e:
                logger.warning("regulatory.transform_error",
                    category="visa", country=entry.get("country_code"), error=str(e))

        # Parse health advisories
        for entry in self._raw_data.get("health_advisories.json", {}).get("health_advisories", []):
            try:
                health_advisories.append(HealthAdvisory.model_validate(entry))
            except Exception as e:
                logger.warning("regulatory.transform_error",
                    category="health", name=entry.get("name"), error=str(e))

        # Parse travel warnings
        for entry in self._raw_data.get("travel_warnings.json", {}).get("travel_warnings", []):
            try:
                travel_warnings.append(TravelWarning.model_validate(entry))
            except Exception as e:
                logger.warning("regulatory.transform_error",
                    category="warning", id=entry.get("warning_id"), error=str(e))

        self._validated_data = RegulatoryDataset(
            visa_rules=visa_rules,
            health_advisories=health_advisories,
            travel_warnings=travel_warnings,
        )

        logger.info("regulatory.transformed",
            visa_count=len(visa_rules),
            health_count=len(health_advisories),
            warning_count=len(travel_warnings))

    async def load(self) -> None:
        """Write validated data to compliance rules files and index in Vector Store."""
        if not self._validated_data:
            logger.error("regulatory.load_error", reason="No validated data")
            return

        # Write JSON files to agents/compliance/rules/
        RULES_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        with open(RULES_OUTPUT_DIR / "visa_rules.json", "w") as f:
            json.dump(
                {"visa_rules": [r.model_dump(mode="json") for r in self._validated_data.visa_rules]},
                f, indent=2,
            )

        with open(RULES_OUTPUT_DIR / "health_advisories.json", "w") as f:
            json.dump(
                {"health_advisories": [a.model_dump(mode="json") for a in self._validated_data.health_advisories]},
                f, indent=2,
            )

        with open(RULES_OUTPUT_DIR / "travel_warnings.json", "w") as f:
            json.dump(
                {"travel_warnings": [w.model_dump(mode="json") for w in self._validated_data.travel_warnings]},
                f, indent=2,
            )

        logger.info("regulatory.rules_written", output_dir=str(RULES_OUTPUT_DIR))

        # Index in Vector Store for semantic search
        if self.vector_store:
            await self._index_in_vector_store()

    async def _index_in_vector_store(self) -> None:
        """Create embeddings and index regulatory data for semantic search."""
        # Implementation indexes each visa rule, health advisory, and warning
        # as a separate document with appropriate metadata for filtered retrieval.
        pass
```

### Keyword Lookup Pattern

```python
# In etl/regulatory.py or a dedicated service module

class RegulatoryLookup:
    """Fast keyword-based lookup for regulatory data."""

    def __init__(self, rules_dir: Path):
        self._rules_dir = rules_dir
        self._visa_index: dict[str, VisaRule] = {}
        self._health_advisories: list[HealthAdvisory] = []
        self._travel_warnings: list[TravelWarning] = []
        self._loaded = False

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        # Load and index visa rules by country code (uppercase)
        visa_path = self._rules_dir / "visa_rules.json"
        if visa_path.exists():
            with open(visa_path) as f:
                data = json.load(f)
            for entry in data.get("visa_rules", []):
                rule = VisaRule.model_validate(entry)
                self._visa_index[rule.country_code.upper()] = rule
        self._loaded = True

    def lookup_visa_by_country(self, country_code: str) -> VisaRule | None:
        """Lookup visa rules by ISO country code. Case-insensitive."""
        self._ensure_loaded()
        return self._visa_index.get(country_code.upper())

    def lookup_health_advisories(self, region: str | None = None) -> list[HealthAdvisory]:
        """Return health advisories, optionally filtered by region."""
        self._ensure_loaded()
        if region is None:
            return self._health_advisories
        return [a for a in self._health_advisories
                if a.affected_regions == "all" or region in a.affected_regions]

    def lookup_travel_warnings(self, issuing_country: str | None = None) -> list[TravelWarning]:
        """Return travel warnings, optionally filtered by issuing country."""
        self._ensure_loaded()
        if issuing_country is None:
            return self._travel_warnings
        code = issuing_country.upper()
        return [w for w in self._travel_warnings if w.issuing_country.upper() == code]
```

### Rules Loader Helper

```python
# agents/compliance/rules/__init__.py
import json
from pathlib import Path

RULES_DIR = Path(__file__).parent


def load_rules(rule_type: str) -> dict:
    """Load a compliance rules JSON file by type.

    Args:
        rule_type: One of 'visa_rules', 'health_advisories', 'travel_warnings',
                   'age_restrictions', 'seasonal_patterns'

    Returns:
        Parsed JSON dict.

    Raises:
        FileNotFoundError: If rule file does not exist.
    """
    filepath = RULES_DIR / f"{rule_type}.json"
    with open(filepath) as f:
        return json.load(f)
```

### Vector Store Indexing Strategy

Regulatory documents are indexed differently from travel entities:

| Metadata Field | Purpose | Example |
|---|---|---|
| `type` | Distinguish from travel entities | `"regulatory"` |
| `subtype` | Regulatory category | `"visa"`, `"health"`, `"warning"` |
| `country_code` | For visa rules | `"DE"`, `"US"` |
| `region` | For health/seasonal | `"north"`, `"central"` |
| `severity` | For warnings | `"exercise_caution"` |
| `last_verified_date` | Freshness tracking | `"2026-04-15"` |

The embedding text for each regulatory document is constructed by combining key fields into a natural-language description suitable for semantic search:

```python
def build_visa_embedding_text(rule: VisaRule) -> str:
    text = f"Vietnam visa requirements for {rule.country_name} ({rule.country_code}) nationals. "
    text += f"Visa type: {rule.visa_type}. Maximum stay: {rule.max_duration_days} days. "
    if rule.cost_usd > 0:
        text += f"Cost: ${rule.cost_usd} USD. "
    if rule.phu_quoc_exception and rule.phu_quoc_exception.eligible:
        text += f"Phu Quoc special case: {rule.phu_quoc_exception.warning} "
    if rule.notes:
        text += rule.notes
    return text
```

### Integration with Story 2.6 (Seed Data Loading)

Story 2.6 runs `seed_vector_store.py` which calls `RegulatoryPipeline.run()` as part of the full seed data load. This story provides the pipeline; Story 2.6 wires it into the seed script. The pipeline must be independently runnable for testing.

### Testing Strategy

All tests use mock Vector Store. The regulatory data tests validate:

1. **Schema correctness** -- JSON files parse into Pydantic models without errors
2. **Business rules** -- Phu Quoc exception logic is correct for each visa type
3. **Lookup behavior** -- case-insensitive country code matching, graceful not-found handling
4. **Idempotency** -- running the pipeline twice produces the same output
5. **Compliance rules files** -- JSON files in `agents/compliance/rules/` are valid and complete

```python
# etl/tests/test_regulatory.py
import pytest
from app.etl.regulatory import RegulatoryPipeline, RegulatoryLookup
from app.etl.schemas.regulatory import VisaRule, VisaType


class TestVisaRulesIngestion:
    async def test_visa_rules_ingestion(self, mock_vector_store):
        pipeline = RegulatoryPipeline(vector_store=mock_vector_store)
        await pipeline.run()
        assert pipeline._validated_data is not None
        assert len(pipeline._validated_data.visa_rules) >= 20

    async def test_phu_quoc_exception_structure(self, mock_vector_store):
        pipeline = RegulatoryPipeline(vector_store=mock_vector_store)
        await pipeline.run()
        # E-visa nationalities must have eligible Phu Quoc exception
        e_visa_rules = [r for r in pipeline._validated_data.visa_rules
                        if r.visa_type == VisaType.E_VISA]
        for rule in e_visa_rules:
            assert rule.phu_quoc_exception is not None
            assert rule.phu_quoc_exception.eligible is True
            assert rule.phu_quoc_exception.max_duration_days == 30
            assert rule.phu_quoc_exception.restriction == "island_only"

    async def test_phu_quoc_not_applicable_for_visa_free(self, mock_vector_store):
        pipeline = RegulatoryPipeline(vector_store=mock_vector_store)
        await pipeline.run()
        visa_free = [r for r in pipeline._validated_data.visa_rules
                     if r.visa_type in (VisaType.VISA_FREE_45, VisaType.VISA_FREE_30)]
        for rule in visa_free:
            assert rule.phu_quoc_exception.eligible is False


class TestKeywordLookup:
    def test_keyword_lookup_by_country_code(self, rules_dir):
        lookup = RegulatoryLookup(rules_dir)
        result = lookup.lookup_visa_by_country("DE")
        assert result is not None
        assert result.country_code == "DE"
        assert result.visa_type == VisaType.VISA_FREE_45

    def test_keyword_lookup_case_insensitive(self, rules_dir):
        lookup = RegulatoryLookup(rules_dir)
        assert lookup.lookup_visa_by_country("de") is not None
        assert lookup.lookup_visa_by_country("De") is not None
        assert lookup.lookup_visa_by_country("DE") is not None

    def test_nationality_not_found(self, rules_dir):
        lookup = RegulatoryLookup(rules_dir)
        result = lookup.lookup_visa_by_country("ZZ")
        assert result is None
```

### File Placement Summary

New files to create:

| File | Purpose |
|---|---|
| `data/seed/visa_rules.json` | Visa rules for 20+ nationalities |
| `data/seed/health_advisories.json` | Vietnam health advisories |
| `data/seed/travel_warnings.json` | Government travel warnings |
| `backend/app/etl/schemas/regulatory.py` | Pydantic models for regulatory data |
| `backend/app/etl/regulatory.py` | Regulatory ETL pipeline |
| `backend/app/agents/compliance/rules/__init__.py` | Rules loader helper |
| `backend/app/agents/compliance/rules/visa_rules.json` | Generated: visa rules |
| `backend/app/agents/compliance/rules/health_advisories.json` | Generated: health data |
| `backend/app/agents/compliance/rules/travel_warnings.json` | Generated: travel warnings |
| `backend/app/agents/compliance/rules/age_restrictions.json` | Static: activity age limits |
| `backend/app/agents/compliance/rules/seasonal_patterns.json` | Static: monsoon data by region |
| `backend/app/etl/tests/test_regulatory.py` | Unit tests |
| `backend/app/etl/schemas/__init__.py` | Package init |
| `backend/app/etl/tests/__init__.py` | Package init (if not exists) |

Files to modify:
- `backend/app/agents/compliance/__init__.py` -- ensure `rules/` is a package

### Anti-Patterns -- DO NOT

- **DO NOT** hard-code regulatory data inside Python source files -- always load from JSON
- **DO NOT** import Qdrant directly -- use `VectorStoreProtocol`
- **DO NOT** make regulatory data tenant-scoped -- visa rules are global
- **DO NOT** implement the Compliance Agent validation logic -- that is Epic 4 (Stories 4.1-4.4)
- **DO NOT** create live API integrations for visa/health data -- use seed data files for MVP
- **DO NOT** use stdlib `logging` -- use `structlog` only
- **DO NOT** create a generic `utils.py` file -- name modules by purpose
- **DO NOT** raise exceptions for unknown country codes -- return `None` or empty list gracefully
- **DO NOT** implement the seed script integration -- Story 2.6 handles wiring into `seed_vector_store.py`

### References

- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 2, Story 2.5 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md -- etl/ pipeline pattern, agents/compliance/rules/ structure]
- [Source: _bmad-output/planning-artifacts/architecture.md -- VectorStoreProtocol interface]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Implementation Patterns & Naming Conventions]
- [Source: _bmad-output/planning-artifacts/prds/prd-AIFU-2026-05-24/prd.md -- FR-32 Regulatory Data Ingestion]
- [Source: _bmad-output/planning-artifacts/prds/prd-AIFU-2026-05-24/prd.md -- FR-15 Visa Requirement Validation (data structure)]
- [Source: _bmad-output/planning-artifacts/prds/prd-AIFU-2026-05-24/prd.md -- UJ-3 Phu Quoc compliance edge case]
- [Source: _bmad-output/planning-artifacts/prds/prd-AIFU-2026-05-24/prd.md -- FR-16, FR-17 health and travel advisory data]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 4.1 visa checks (downstream consumer)]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 4.2 health/age checks (downstream consumer)]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 4.3 seasonal checks (downstream consumer)]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 6.3 E2E Suite 3 compliance edge case (Phu Quoc trap)]

## Dev Agent Record

### Agent Model Used

(To be filled by implementing agent)

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled on completion)

### Change Log

- 2026-05-24: Story spec created -- ready-for-dev

### File List

(To be filled by implementing agent with all files created/modified)
