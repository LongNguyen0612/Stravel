"""Prometheus metrics for STravel backend."""

from prometheus_client import Counter, Gauge, Histogram

# Request metrics
REQUEST_COUNT = Counter(
    "stravel_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
)

REQUEST_LATENCY = Histogram(
    "stravel_http_request_duration_seconds",
    "HTTP request duration",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# Agent metrics
AGENT_EXECUTION_TIME = Histogram(
    "stravel_agent_execution_seconds",
    "Agent node execution time",
    ["agent_name"],
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0],
)

AGENT_ERRORS = Counter(
    "stravel_agent_errors_total",
    "Total agent errors",
    ["agent_name"],
)

# LLM metrics
LLM_TOKEN_USAGE = Counter(
    "stravel_llm_tokens_total",
    "Total LLM tokens used",
    ["backend", "direction"],  # direction: prompt, completion
)

LLM_LATENCY = Histogram(
    "stravel_llm_request_seconds",
    "LLM request duration",
    ["backend"],
    buckets=[0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0],
)

# Cache metrics
CACHE_HIT_RATE = Counter(
    "stravel_cache_requests_total",
    "Cache requests",
    ["result"],  # hit, miss
)

# Data freshness
ENTITY_FRESHNESS = Gauge(
    "stravel_entity_freshness_ratio",
    "Ratio of fresh entities (0-1)",
    ["entity_type"],
)

STALE_ENTITY_COUNT = Gauge(
    "stravel_stale_entities_total",
    "Number of stale entities",
    ["entity_type"],
)
