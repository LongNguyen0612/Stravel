# Story 6.2: Full Observability Stack

Status: draft

## Story

As a system operator,
I want dashboards showing system health, agent performance, and data freshness,
so that I can monitor the system and detect issues before users are affected.

## Acceptance Criteria

1. **Prometheus deployed and scraping** -- Prometheus is deployed in the Kubernetes cluster via `infra/k8s/monitoring/` manifests and scrapes metrics from the backend, including: request latency (histogram), agent execution time per agent type (histogram), cache hit rate (counter), token usage per session (counter), and Entity freshness distribution (gauge).
2. **Backend exposes /metrics endpoint** -- The FastAPI backend exposes a Prometheus-compatible `/metrics` endpoint via `prometheus-client` library, registering all custom metrics with proper labels (`agent_name`, `tenant_id`, `endpoint`, `status_code`).
3. **Grafana dashboards deployed** -- Grafana is deployed with pre-provisioned dashboard JSON files in `infra/k8s/monitoring/grafana/dashboards/` covering four views:
   - **System Health Overview** -- request rate, error rate, p50/p95/p99 latency, pod CPU/memory, active SSE connections
   - **Agent Performance** -- per-agent execution time (profiling, calculation, proposal, compliance), success/failure rate per agent, LLM call count and latency
   - **Data Freshness** -- entity freshness distribution by type (hotel, attraction, restaurant), stale entity count, last ETL run timestamp, cache hit/miss ratio
   - **Error Rates** -- error rate by endpoint, error rate by agent, 5xx vs 4xx breakdown, compliance gate block/warn/pass counts
4. **OpenTelemetry traces queryable** -- The OpenTelemetry Collector is deployed and configured to receive traces from the backend. Traces show the full lifecycle of an advisory session across all agents (profiling -> calculation -> proposal -> compliance), including RAG retrieval spans and LLM call spans. Traces are exported to a compatible backend (Jaeger or Tempo).
5. **Alert rules configured** -- Prometheus alerting rules fire when:
   - Error rate exceeds 5% of total requests over a 5-minute window
   - Any agent's p95 latency exceeds 10 seconds over a 5-minute window
   - Stale entity count (entities past `expires_at`) exceeds 20% of total entities
6. **AlertManager routes configured** -- AlertManager is deployed with routing rules that deliver alerts (initially to a webhook/log sink; production Slack/PagerDuty integration is deferred).
7. **Infrastructure as config** -- All Prometheus config, Grafana dashboard JSON, alert rules, and OTel Collector config are version-controlled in `infra/k8s/monitoring/`.
8. **Service discovery** -- Prometheus uses Kubernetes service discovery (`kubernetes_sd_configs`) to auto-discover scrape targets rather than hard-coded static targets.

## Dependencies

- **Story 6.1 (Kubernetes Deployment)** -- K8S manifests must exist and deploy the backend. This story layers monitoring on top.
- **Story 1.1 (Project Setup)** -- OpenTelemetry middleware is already baked into the backend from Day 1 (`core/middleware.py`).
- **Story 1.2 (Database Models)** -- structlog JSON logging is already in place.
- **Story 2.4 (Freshness Tracking)** -- Entity freshness fields (`ingested_at`, `expires_at`) must exist on the Entity model for staleness metrics.
- **Story 2.7 (vLLM Setup)** -- Token usage logging per request must be in place for the token usage metric.

## Tasks / Subtasks

- [ ] Task 1: Add Prometheus metrics instrumentation to backend (AC: #1, #2)
  - [ ] Add `prometheus-client` to `pyproject.toml` dependencies
  - [ ] Create `backend/app/core/metrics.py` defining all custom metrics:
    - `REQUEST_LATENCY` -- Histogram with labels `method`, `endpoint`, `status_code`
    - `AGENT_EXECUTION_TIME` -- Histogram with labels `agent_name`, `tenant_id`
    - `AGENT_INVOCATIONS` -- Counter with labels `agent_name`, `result` (success/failure)
    - `CACHE_HITS` -- Counter with labels `cache_type` (redis/in_memory), `result` (hit/miss)
    - `TOKEN_USAGE` -- Counter with labels `agent_name`, `model`, `token_type` (input/output)
    - `ENTITY_FRESHNESS` -- Gauge with labels `entity_type` (hotel/attraction/restaurant)
    - `STALE_ENTITY_COUNT` -- Gauge with labels `entity_type`
    - `SSE_ACTIVE_CONNECTIONS` -- Gauge (no labels)
    - `COMPLIANCE_GATE_RESULTS` -- Counter with labels `result` (pass/warn/block)
  - [ ] Create `backend/app/api/v1/metrics.py` exposing `GET /metrics` endpoint using `prometheus_client.generate_latest()`
  - [ ] Register metrics router in `api/v1/router.py` (no auth required on `/metrics`)
  - [ ] Add Prometheus middleware to `core/middleware.py` that records `REQUEST_LATENCY` on every request
  - [ ] Instrument `agents/orchestrator.py` to record `AGENT_EXECUTION_TIME` and `AGENT_INVOCATIONS` around each agent node
  - [ ] Instrument `services/llm.py` to record `TOKEN_USAGE` after each LLM call
  - [ ] Instrument `services/cache.py` to record `CACHE_HITS` on every get/set
  - [ ] Instrument `api/v1/streaming.py` to increment/decrement `SSE_ACTIVE_CONNECTIONS`
  - [ ] Instrument `agents/compliance/agent.py` to record `COMPLIANCE_GATE_RESULTS`
  - [ ] Create a periodic task (or middleware hook) that queries Entity table and updates `ENTITY_FRESHNESS` and `STALE_ENTITY_COUNT` gauges every 60 seconds
  - [ ] Add unit tests in `backend/app/core/tests/test_metrics.py` verifying metric registration and label correctness

- [ ] Task 2: Deploy Prometheus to Kubernetes (AC: #1, #5, #7, #8)
  - [ ] Create `infra/k8s/monitoring/namespace.yaml` -- `monitoring` namespace
  - [ ] Create `infra/k8s/monitoring/prometheus/configmap.yaml` -- Prometheus configuration:
    - Global scrape interval: 15s
    - Evaluation interval: 15s
    - Kubernetes SD config for pod auto-discovery
    - Scrape job for backend pods (matching label `app: stravel-backend`, port 8000, path `/metrics`)
    - Scrape job for vLLM pods (if vLLM exposes metrics)
    - Relabeling rules to extract pod name, namespace, and node
  - [ ] Create `infra/k8s/monitoring/prometheus/deployment.yaml` -- Prometheus server Deployment
    - Image: `prom/prometheus:v2.53.0`
    - Mount ConfigMap for `prometheus.yml`
    - Mount alert rules ConfigMap
    - Persistent volume for data retention (15 days default)
    - Resource limits: 512Mi memory, 500m CPU
    - Liveness/readiness probes on `/-/healthy` and `/-/ready`
  - [ ] Create `infra/k8s/monitoring/prometheus/service.yaml` -- ClusterIP Service on port 9090
  - [ ] Create `infra/k8s/monitoring/prometheus/rbac.yaml` -- ServiceAccount, ClusterRole, ClusterRoleBinding for Prometheus to read Kubernetes API (required for service discovery)
  - [ ] Verify Prometheus starts, discovers backend pods, and scrapes `/metrics`

- [ ] Task 3: Configure Prometheus alert rules (AC: #5, #7)
  - [ ] Create `infra/k8s/monitoring/prometheus/alert-rules.yaml` as a ConfigMap containing:
    ```yaml
    groups:
      - name: stravel-system
        rules:
          - alert: HighErrorRate
            expr: >
              sum(rate(stravel_request_latency_seconds_count{status_code=~"5.."}[5m]))
              /
              sum(rate(stravel_request_latency_seconds_count[5m]))
              > 0.05
            for: 2m
            labels:
              severity: critical
            annotations:
              summary: "Error rate exceeds 5%"
              description: "{{ $value | humanizePercentage }} of requests are failing"

          - alert: AgentHighLatency
            expr: >
              histogram_quantile(0.95,
                sum(rate(stravel_agent_execution_time_seconds_bucket[5m])) by (le, agent_name)
              ) > 10
            for: 2m
            labels:
              severity: warning
            annotations:
              summary: "Agent {{ $labels.agent_name }} p95 latency > 10s"
              description: "p95 latency is {{ $value }}s"

          - alert: StaleEntityThreshold
            expr: >
              sum(stravel_stale_entity_count)
              /
              sum(stravel_entity_freshness)
              > 0.20
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: "Stale entities exceed 20%"
              description: "{{ $value | humanizePercentage }} of entities are stale"
    ```
  - [ ] Mount alert rules ConfigMap into Prometheus pod at `/etc/prometheus/rules/`
  - [ ] Update `prometheus.yml` to include `rule_files: ["/etc/prometheus/rules/*.yaml"]`
  - [ ] Verify rules load: `curl http://prometheus:9090/api/v1/rules` returns all three rules

- [ ] Task 4: Deploy AlertManager (AC: #6, #7)
  - [ ] Create `infra/k8s/monitoring/alertmanager/configmap.yaml` -- AlertManager config:
    - Route: group by `severity`, group wait 30s, group interval 5m
    - Receiver: `webhook-sink` pointing to a log receiver (or Slack webhook URL placeholder)
    - Inhibition rules: critical inhibits warning for same `alertname`
  - [ ] Create `infra/k8s/monitoring/alertmanager/deployment.yaml`
    - Image: `prom/alertmanager:v0.27.0`
    - Mount config ConfigMap
    - Resource limits: 128Mi memory, 100m CPU
  - [ ] Create `infra/k8s/monitoring/alertmanager/service.yaml` -- ClusterIP Service on port 9093
  - [ ] Update Prometheus config to add `alerting.alertmanagers` section pointing to AlertManager service
  - [ ] Verify AlertManager is reachable from Prometheus

- [ ] Task 5: Deploy OpenTelemetry Collector (AC: #4, #7)
  - [ ] Create `infra/k8s/monitoring/otel-collector/configmap.yaml` -- OTel Collector config:
    - Receivers: `otlp` (gRPC on 4317, HTTP on 4318)
    - Processors: `batch` (timeout 5s, send_batch_size 512), `memory_limiter` (limit 512MiB)
    - Exporters: `otlp/jaeger` (pointing to Jaeger/Tempo endpoint), `prometheus` (for metrics bridge if needed)
    - Service pipeline: traces -> [batch, memory_limiter] -> otlp/jaeger
  - [ ] Create `infra/k8s/monitoring/otel-collector/deployment.yaml`
    - Image: `otel/opentelemetry-collector-contrib:0.100.0`
    - Mount config ConfigMap
    - Expose ports 4317 (gRPC) and 4318 (HTTP)
    - Resource limits: 256Mi memory, 250m CPU
  - [ ] Create `infra/k8s/monitoring/otel-collector/service.yaml` -- ClusterIP Service exposing 4317 and 4318
  - [ ] Deploy Jaeger (all-in-one for dev) or Grafana Tempo for trace storage:
    - Create `infra/k8s/monitoring/jaeger/deployment.yaml` -- `jaegertracing/all-in-one:1.57`
    - Create `infra/k8s/monitoring/jaeger/service.yaml` -- ports 16686 (UI), 4317 (OTLP)
  - [ ] Update backend environment in K8S deployment to set `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.monitoring:4317`
  - [ ] Verify traces appear in Jaeger UI for a sample advisory session flow

- [ ] Task 6: Instrument backend trace spans for advisory session lifecycle (AC: #4)
  - [ ] Ensure `core/middleware.py` creates a root span for each HTTP request (already exists from Story 1.1, verify labels)
  - [ ] Add child spans in `agents/orchestrator.py` for each agent node transition:
    - Span name: `agent.{agent_name}.execute`
    - Attributes: `session_id`, `tenant_id`, `agent_name`, `stage`
  - [ ] Add child spans in `rag/hybrid_search.py` for each search call:
    - Span name: `rag.search`
    - Attributes: `query`, `result_count`, `search_type` (keyword/semantic/hybrid)
  - [ ] Add child spans in `services/llm.py` for each LLM call:
    - Span name: `llm.generate`
    - Attributes: `model`, `input_tokens`, `output_tokens`, `duration_ms`
  - [ ] Add child spans in `agents/compliance/agent.py` for each compliance check:
    - Span name: `compliance.check.{check_type}`
    - Attributes: `check_type`, `result` (pass/warn/block)
  - [ ] Verify a full advisory session produces a connected trace tree visible in Jaeger

- [ ] Task 7: Deploy Grafana with provisioned dashboards (AC: #3, #7)
  - [ ] Create `infra/k8s/monitoring/grafana/deployment.yaml`
    - Image: `grafana/grafana:11.0.0`
    - Environment: `GF_SECURITY_ADMIN_PASSWORD` from Secret, `GF_AUTH_ANONYMOUS_ENABLED=true` (dev), `GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH`
    - Mount dashboard provisioning ConfigMaps
    - Mount datasource provisioning ConfigMap
    - Persistent volume for Grafana data
    - Resource limits: 256Mi memory, 250m CPU
  - [ ] Create `infra/k8s/monitoring/grafana/service.yaml` -- ClusterIP on port 3000
  - [ ] Create `infra/k8s/monitoring/grafana/datasources.yaml` -- ConfigMap provisioning:
    - Prometheus datasource pointing to `http://prometheus.monitoring:9090`
    - Jaeger/Tempo datasource pointing to `http://jaeger.monitoring:16686`
  - [ ] Create `infra/k8s/monitoring/grafana/dashboard-provisioner.yaml` -- ConfigMap telling Grafana where to find dashboard JSON files
  - [ ] Verify Grafana starts, datasources connect, and dashboards are visible

- [ ] Task 8: Create Grafana dashboard -- System Health Overview (AC: #3)
  - [ ] Create `infra/k8s/monitoring/grafana/dashboards/system-health.json`
  - [ ] Panels:
    - **Request Rate** -- `sum(rate(stravel_request_latency_seconds_count[5m]))` -- timeseries
    - **Error Rate** -- `sum(rate(stravel_request_latency_seconds_count{status_code=~"5.."}[5m])) / sum(rate(stravel_request_latency_seconds_count[5m]))` -- gauge with red threshold at 5%
    - **Request Latency (p50/p95/p99)** -- `histogram_quantile(0.5|0.95|0.99, ...)` -- timeseries with legend per quantile
    - **Active SSE Connections** -- `stravel_sse_active_connections` -- stat panel
    - **Pod CPU Usage** -- from kube-state-metrics or cAdvisor -- timeseries
    - **Pod Memory Usage** -- from kube-state-metrics or cAdvisor -- timeseries
  - [ ] Dashboard variables: `namespace` (default: `stravel`), `pod` (multi-select)
  - [ ] Time range default: last 1 hour, refresh every 30s
  - [ ] Mount JSON as ConfigMap in Grafana pod

- [ ] Task 9: Create Grafana dashboard -- Agent Performance (AC: #3)
  - [ ] Create `infra/k8s/monitoring/grafana/dashboards/agent-performance.json`
  - [ ] Panels:
    - **Agent Execution Time (p50/p95)** -- `histogram_quantile(0.5|0.95, sum(rate(stravel_agent_execution_time_seconds_bucket[5m])) by (le, agent_name))` -- timeseries, series per agent
    - **Agent Success/Failure Rate** -- `sum(rate(stravel_agent_invocations_total[5m])) by (agent_name, result)` -- stacked bar
    - **LLM Call Latency** -- from OTel span duration `llm.generate` -- timeseries
    - **LLM Token Usage** -- `sum(rate(stravel_token_usage_total[5m])) by (agent_name, token_type)` -- timeseries, input vs output
    - **Agent Invocation Count** -- `sum(increase(stravel_agent_invocations_total[1h])) by (agent_name)` -- bar gauge
    - **Compliance Gate Results** -- `sum(increase(stravel_compliance_gate_results_total[1h])) by (result)` -- pie chart (pass/warn/block)
  - [ ] Dashboard variable: `agent_name` (values: profiling, calculation, proposal, compliance)
  - [ ] Mount JSON as ConfigMap in Grafana pod

- [ ] Task 10: Create Grafana dashboard -- Data Freshness (AC: #3)
  - [ ] Create `infra/k8s/monitoring/grafana/dashboards/data-freshness.json`
  - [ ] Panels:
    - **Entity Freshness Distribution** -- `stravel_entity_freshness` by `entity_type` -- bar gauge showing fresh vs stale per type
    - **Stale Entity Count** -- `sum(stravel_stale_entity_count) by (entity_type)` -- stat panels with red threshold at count > 20% of total
    - **Cache Hit/Miss Ratio** -- `sum(rate(stravel_cache_hits_total{result="hit"}[5m])) / sum(rate(stravel_cache_hits_total[5m]))` -- gauge with green >80%
    - **Cache Operations Rate** -- `sum(rate(stravel_cache_hits_total[5m])) by (result)` -- timeseries, hit vs miss
    - **ETL Last Run** -- annotation query or custom metric `stravel_etl_last_run_timestamp` -- stat panel showing time since last run
  - [ ] Mount JSON as ConfigMap in Grafana pod

- [ ] Task 11: Create Grafana dashboard -- Error Rates (AC: #3)
  - [ ] Create `infra/k8s/monitoring/grafana/dashboards/error-rates.json`
  - [ ] Panels:
    - **Error Rate by Endpoint** -- `sum(rate(stravel_request_latency_seconds_count{status_code=~"5.."}[5m])) by (endpoint)` -- table sorted by error rate
    - **Error Rate by Agent** -- `sum(rate(stravel_agent_invocations_total{result="failure"}[5m])) by (agent_name)` -- timeseries
    - **5xx vs 4xx Breakdown** -- `sum(rate(stravel_request_latency_seconds_count{status_code=~"5.."}[5m]))` vs `sum(rate(...{status_code=~"4.."}[5m]))` -- stacked timeseries
    - **Compliance Gate Blocks** -- `sum(increase(stravel_compliance_gate_results_total{result="block"}[1h]))` -- stat with red highlight
    - **Recent Errors Log** -- Loki/log query panel (if Loki is configured) or link to Jaeger traces filtered by error
  - [ ] Alert annotation: overlay `HighErrorRate` alert threshold (5%) as horizontal line
  - [ ] Mount JSON as ConfigMap in Grafana pod

- [ ] Task 12: Add Ingress for monitoring UIs (AC: #3, #4)
  - [ ] Update Ingress or create `infra/k8s/monitoring/ingress.yaml` for:
    - `/grafana` -> Grafana service port 3000
    - `/jaeger` -> Jaeger UI service port 16686
    - `/prometheus` -> Prometheus service port 9090 (optional, may restrict to internal)
  - [ ] Verify all three UIs are accessible through the Ingress

- [ ] Task 13: End-to-end verification (all ACs)
  - [ ] Deploy full monitoring stack to the cluster
  - [ ] Start an advisory session and verify:
    - Prometheus scrapes backend `/metrics` and shows custom metrics
    - Jaeger shows connected trace spans for the full session lifecycle
    - All four Grafana dashboards render with live data
    - Trigger error condition and verify `HighErrorRate` alert fires within 2 minutes
    - Verify stale entity metric updates when entities pass their `expires_at`
  - [ ] Document access URLs in `infra/k8s/monitoring/README.md`

## Dev Notes

### Critical Architecture Constraints

- **OpenTelemetry is already baked in** -- `core/middleware.py` creates root trace spans from Story 1.1. This story adds child spans for agent nodes, RAG calls, and LLM calls, plus deploys the collector infrastructure.
- **structlog JSON logging** is already configured -- this story does not change the logging layer, only adds metrics and trace infrastructure alongside it.
- **Metrics naming convention** -- all custom Prometheus metrics MUST be prefixed with `stravel_` to avoid collisions with system metrics.
- **No secrets in ConfigMaps** -- Grafana admin password goes in a K8S Secret, not a ConfigMap.
- **Phase 4 infrastructure** -- this is a Kubernetes-only story. All manifests go in `infra/k8s/monitoring/`. Docker Compose equivalents are NOT required.

### Prometheus Metric Naming

Follow Prometheus naming best practices:

```python
# backend/app/core/metrics.py
from prometheus_client import Histogram, Counter, Gauge

# Request latency — histogram with seconds as unit
REQUEST_LATENCY = Histogram(
    "stravel_request_latency_seconds",
    "HTTP request latency in seconds",
    labelnames=["method", "endpoint", "status_code"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# Agent execution time — histogram with seconds as unit
AGENT_EXECUTION_TIME = Histogram(
    "stravel_agent_execution_time_seconds",
    "Agent execution time in seconds",
    labelnames=["agent_name", "tenant_id"],
    buckets=[0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0],
)

# Agent invocations — counter with _total suffix (auto-added by client)
AGENT_INVOCATIONS = Counter(
    "stravel_agent_invocations",
    "Total agent invocations",
    labelnames=["agent_name", "result"],
)

# Cache operations — counter
CACHE_HITS = Counter(
    "stravel_cache_hits",
    "Cache hit/miss count",
    labelnames=["cache_type", "result"],
)

# Token usage — counter
TOKEN_USAGE = Counter(
    "stravel_token_usage",
    "LLM token usage",
    labelnames=["agent_name", "model", "token_type"],
)

# Entity freshness — gauge (total entity count by type, updated periodically)
ENTITY_FRESHNESS = Gauge(
    "stravel_entity_freshness",
    "Total entity count by type",
    labelnames=["entity_type"],
)

# Stale entity count — gauge
STALE_ENTITY_COUNT = Gauge(
    "stravel_stale_entity_count",
    "Count of entities past their expires_at",
    labelnames=["entity_type"],
)

# SSE connections — gauge
SSE_ACTIVE_CONNECTIONS = Gauge(
    "stravel_sse_active_connections",
    "Number of active SSE connections",
)

# Compliance gate results — counter
COMPLIANCE_GATE_RESULTS = Counter(
    "stravel_compliance_gate_results",
    "Compliance gate pass/warn/block counts",
    labelnames=["result"],
)
```

### Prometheus Middleware Integration

```python
# Add to core/middleware.py — wrap existing OpenTelemetry middleware
import time
from app.core.metrics import REQUEST_LATENCY

async def prometheus_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=request.url.path,
        status_code=response.status_code,
    ).observe(duration)
    return response
```

### Agent Instrumentation Pattern

```python
# In agents/orchestrator.py — wrap each node execution
import time
from opentelemetry import trace
from app.core.metrics import AGENT_EXECUTION_TIME, AGENT_INVOCATIONS

tracer = trace.get_tracer("stravel.agents")

async def run_agent_node(agent_name: str, state: AdvisoryState, agent_func):
    with tracer.start_as_current_span(
        f"agent.{agent_name}.execute",
        attributes={
            "session_id": state.session_id,
            "tenant_id": state.tenant_id,
            "agent_name": agent_name,
            "stage": state.stage,
        },
    ):
        start = time.perf_counter()
        try:
            result = await agent_func(state)
            AGENT_INVOCATIONS.labels(agent_name=agent_name, result="success").inc()
            return result
        except Exception as e:
            AGENT_INVOCATIONS.labels(agent_name=agent_name, result="failure").inc()
            raise
        finally:
            duration = time.perf_counter() - start
            AGENT_EXECUTION_TIME.labels(
                agent_name=agent_name,
                tenant_id=state.tenant_id,
            ).observe(duration)
```

### File Structure -- Monitoring Infrastructure

```
infra/k8s/monitoring/
├── namespace.yaml
├── ingress.yaml
├── prometheus/
│   ├── configmap.yaml           # prometheus.yml with K8S SD
│   ├── alert-rules.yaml         # AlertManager rules ConfigMap
│   ├── deployment.yaml          # Prometheus server
│   ├── service.yaml             # ClusterIP :9090
│   └── rbac.yaml                # ServiceAccount + ClusterRole
├── alertmanager/
│   ├── configmap.yaml           # alertmanager.yml
│   ├── deployment.yaml
│   └── service.yaml             # ClusterIP :9093
├── otel-collector/
│   ├── configmap.yaml           # OTel Collector config
│   ├── deployment.yaml
│   └── service.yaml             # ClusterIP :4317, :4318
├── jaeger/
│   ├── deployment.yaml          # all-in-one for dev
│   └── service.yaml             # ClusterIP :16686, :4317
└── grafana/
    ├── deployment.yaml
    ├── service.yaml             # ClusterIP :3000
    ├── datasources.yaml         # Provisioned datasource ConfigMap
    ├── dashboard-provisioner.yaml
    └── dashboards/
        ├── system-health.json
        ├── agent-performance.json
        ├── data-freshness.json
        └── error-rates.json
```

### Prometheus Configuration Reference

```yaml
# infra/k8s/monitoring/prometheus/configmap.yaml (data section)
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "/etc/prometheus/rules/*.yaml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager.monitoring:9093"]

scrape_configs:
  - job_name: "stravel-backend"
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ["stravel"]
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: stravel-backend
        action: keep
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
    metrics_path: /metrics
    scheme: http

  - job_name: "vllm"
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ["stravel"]
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: stravel-vllm
        action: keep
```

### OTel Collector Configuration Reference

```yaml
# infra/k8s/monitoring/otel-collector/configmap.yaml (data section)
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 512
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128

exporters:
  otlp/jaeger:
    endpoint: jaeger.monitoring:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, memory_limiter]
      exporters: [otlp/jaeger]
```

### Backend Environment Variables (new for this story)

```bash
# Add to K8S ConfigMap for backend pods
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.monitoring:4317
OTEL_SERVICE_NAME=stravel-backend
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0   # 100% sampling for dev, reduce in prod
```

### Testing Requirements

- **Unit tests for metrics registration** -- verify all custom metrics are registered with correct names, labels, and types
- **Unit tests for middleware** -- verify `REQUEST_LATENCY` histogram is observed on each request
- **Unit tests for agent instrumentation** -- verify `AGENT_EXECUTION_TIME` and `AGENT_INVOCATIONS` are recorded (use `prometheus_client.REGISTRY` to inspect)
- **Integration tests** -- after full stack deploy, verify `/metrics` endpoint returns Prometheus text format with all expected metric families
- **Alert rule tests** -- use `promtool test rules` to validate alert rule expressions against sample data

### Anti-Patterns -- DO NOT

- **DO NOT** use Prometheus Pushgateway for long-running services -- use pull-based scraping
- **DO NOT** create high-cardinality labels (e.g., `session_id` as a metric label) -- this causes Prometheus OOM. Use labels like `agent_name`, `endpoint`, `status_code` only. Session-level detail belongs in traces, not metrics
- **DO NOT** put Grafana admin passwords in ConfigMaps -- use K8S Secrets
- **DO NOT** hard-code scrape targets -- use Kubernetes service discovery
- **DO NOT** store trace data in Prometheus -- traces go to Jaeger/Tempo via OTel Collector
- **DO NOT** create Docker Compose monitoring configs -- this is Phase 4 K8S only
- **DO NOT** modify the existing structlog configuration -- metrics and traces are orthogonal to logs

### NFR Traceability

| NFR | How This Story Satisfies It |
|---|---|
| NFR-2 (Observability) | Full implementation: metrics (Prometheus), traces (OTel + Jaeger), dashboards (Grafana), alerts (AlertManager) |
| NFR-5 (Scalability) | HPA can use custom Prometheus metrics for scaling decisions (deferred but enabled) |
| NFR-6 (Data Freshness) | Staleness metrics and alerts ensure operators are notified when entities go stale |
| NFR-7 (Cost Management) | Token usage metrics enable cost tracking per agent and per session |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- Infrastructure & Deployment decisions]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Observability: Prometheus / Grafana / OpenTelemetry]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Progressive Infrastructure Plan, Phase 4]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 6, Story 6.2]
- [Source: _bmad-output/project-context.md -- OpenTelemetry middleware, structlog conventions]
