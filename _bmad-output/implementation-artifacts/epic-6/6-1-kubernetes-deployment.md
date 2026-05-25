# Story 6.1: Kubernetes Deployment

Status: pending

## Story

As a system operator,
I want the STravel system deployed on Kubernetes with auto-scaling, persistent storage, and proper secret management,
so that the platform handles concurrent users, scales with demand, and runs production-grade infrastructure.

## Acceptance Criteria

1. K8S manifests exist in `infra/k8s/` organized by service subdirectory, and can be applied to a cluster with `kubectl apply -k infra/k8s/`
2. All six services deploy successfully: backend, frontend, PostgreSQL, Qdrant, Redis, vLLM
3. Backend pods have a Horizontal Pod Autoscaler (HPA) scaling on CPU (target 70%) and memory (target 80%), with min 2 / max 10 replicas
4. vLLM pods use a GPU `nodeSelector` (`nvidia.com/gpu: "true"`) and `resources.limits` with `nvidia.com/gpu: 1`, scaling independently from backend pods
5. PostgreSQL uses a StatefulSet with a PersistentVolumeClaim (10Gi, `ReadWriteOnce`) mounted at `/var/lib/postgresql/data`
6. Qdrant uses a StatefulSet with a PersistentVolumeClaim (20Gi, `ReadWriteOnce`) mounted at `/qdrant/storage`
7. Redis uses a Deployment (non-persistent cache) with resource limits
8. ConfigMaps store all non-sensitive configuration: `DATABASE_HOST`, `QDRANT_HOST`, `REDIS_HOST`, `OLLAMA_BASE_URL`, `ENVIRONMENT`, `LOG_LEVEL`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `API_V1_PREFIX`
9. Secrets store all sensitive values: `POSTGRES_PASSWORD`, `SECRET_KEY`, `JWT_SECRET` (base64-encoded, placeholder values with comments to replace in production)
10. An Ingress resource routes `/api/v1/*` to the backend service and `/*` to the frontend service, with TLS termination annotations for cert-manager
11. Liveness probes are configured on all services: backend (`/api/v1/health`, HTTP, period 30s), frontend (TCP port 80, period 30s), PostgreSQL (`pg_isready`, exec, period 10s), Qdrant (`/readyz`, HTTP, period 15s), Redis (`redis-cli ping`, exec, period 10s), vLLM (`/health`, HTTP, period 30s)
12. Readiness probes are configured on all services with appropriate initial delays: backend (`/api/v1/health`, HTTP, initialDelay 10s), PostgreSQL (`pg_isready`, exec, initialDelay 5s), Qdrant (`/readyz`, HTTP, initialDelay 10s), Redis (`redis-cli ping`, exec, initialDelay 5s), vLLM (`/health`, HTTP, initialDelay 60s)
13. A `stravel` namespace is defined and all resources are deployed into it
14. A Kustomize `kustomization.yaml` at `infra/k8s/` aggregates all resources for single-command deployment

## Tasks

- [ ] Task 1: Create namespace and directory structure (AC: #1, #13)
  - [ ] Create `infra/k8s/namespace.yaml` defining the `stravel` namespace
  - [ ] Create service subdirectories: `infra/k8s/backend/`, `infra/k8s/frontend/`, `infra/k8s/postgresql/`, `infra/k8s/qdrant/`, `infra/k8s/redis/`, `infra/k8s/vllm/`
  - [ ] Create `infra/k8s/kustomization.yaml` referencing all resource files
  - [ ] Verify directory structure matches File Structure section below

- [ ] Task 2: Create ConfigMaps and Secrets (AC: #8, #9)
  - [ ] Create `infra/k8s/config/configmap.yaml` with non-sensitive app configuration
    - [ ] `DATABASE_HOST: postgresql`
    - [ ] `DATABASE_PORT: "5432"`
    - [ ] `DATABASE_NAME: stravel`
    - [ ] `DATABASE_USER: stravel`
    - [ ] `QDRANT_HOST: qdrant`
    - [ ] `QDRANT_PORT: "6333"`
    - [ ] `REDIS_HOST: redis`
    - [ ] `REDIS_PORT: "6379"`
    - [ ] `VLLM_BASE_URL: http://vllm:8000`
    - [ ] `ENVIRONMENT: production`
    - [ ] `LOG_LEVEL: INFO`
    - [ ] `OTEL_SERVICE_NAME: stravel-backend`
    - [ ] `OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317`
    - [ ] `API_V1_PREFIX: /api/v1`
  - [ ] Create `infra/k8s/config/secrets.yaml` with base64-encoded placeholder secrets
    - [ ] `POSTGRES_PASSWORD` (placeholder: `change-me-in-production`)
    - [ ] `SECRET_KEY` (placeholder: `change-me-in-production`)
    - [ ] `JWT_SECRET` (placeholder: `change-me-in-production`)
    - [ ] Add comment: `# IMPORTANT: Replace all values before applying to a real cluster`

- [ ] Task 3: Create PostgreSQL StatefulSet (AC: #5, #11, #12)
  - [ ] Create `infra/k8s/postgresql/statefulset.yaml`
    - [ ] Image: `postgres:16`
    - [ ] StatefulSet with 1 replica, `serviceName: postgresql`
    - [ ] `volumeClaimTemplates` with 10Gi PVC, `ReadWriteOnce`, mounted at `/var/lib/postgresql/data`
    - [ ] Environment from ConfigMap (`DATABASE_NAME`, `DATABASE_USER`) and Secret (`POSTGRES_PASSWORD`)
    - [ ] Container port: 5432
    - [ ] Resource requests: 256Mi memory, 250m CPU; limits: 1Gi memory, 1000m CPU
    - [ ] Liveness probe: `exec pg_isready -U stravel`, period 10s, failureThreshold 3
    - [ ] Readiness probe: `exec pg_isready -U stravel`, initialDelay 5s, period 5s
  - [ ] Create `infra/k8s/postgresql/service.yaml`
    - [ ] ClusterIP Service on port 5432, selector matching StatefulSet pods

- [ ] Task 4: Create Qdrant StatefulSet (AC: #6, #11, #12)
  - [ ] Create `infra/k8s/qdrant/statefulset.yaml`
    - [ ] Image: `qdrant/qdrant:latest`
    - [ ] StatefulSet with 1 replica, `serviceName: qdrant`
    - [ ] `volumeClaimTemplates` with 20Gi PVC, `ReadWriteOnce`, mounted at `/qdrant/storage`
    - [ ] Container ports: 6333 (HTTP), 6334 (gRPC)
    - [ ] Resource requests: 512Mi memory, 250m CPU; limits: 2Gi memory, 1000m CPU
    - [ ] Liveness probe: HTTP GET `/readyz` port 6333, period 15s, failureThreshold 3
    - [ ] Readiness probe: HTTP GET `/readyz` port 6333, initialDelay 10s, period 10s
  - [ ] Create `infra/k8s/qdrant/service.yaml`
    - [ ] ClusterIP Service exposing ports 6333 and 6334

- [ ] Task 5: Create Redis Deployment (AC: #7, #11, #12)
  - [ ] Create `infra/k8s/redis/deployment.yaml`
    - [ ] Image: `redis:7-alpine`
    - [ ] Deployment with 1 replica (non-persistent -- ephemeral cache)
    - [ ] Container port: 6379
    - [ ] Resource requests: 64Mi memory, 100m CPU; limits: 256Mi memory, 250m CPU
    - [ ] Liveness probe: `exec redis-cli ping`, period 10s, failureThreshold 3
    - [ ] Readiness probe: `exec redis-cli ping`, initialDelay 5s, period 5s
    - [ ] Command override: `["redis-server", "--maxmemory", "200mb", "--maxmemory-policy", "allkeys-lru"]`
  - [ ] Create `infra/k8s/redis/service.yaml`
    - [ ] ClusterIP Service on port 6379

- [ ] Task 6: Create Backend Deployment + HPA (AC: #2, #3, #11, #12)
  - [ ] Create `infra/k8s/backend/deployment.yaml`
    - [ ] Image: `stravel-backend:latest` (placeholder -- CI/CD will set actual tag)
    - [ ] Deployment with 2 replicas (HPA minimum)
    - [ ] Container port: 8000
    - [ ] Environment variables from ConfigMap and Secret refs
    - [ ] Construct `DATABASE_URL` using ConfigMap + Secret values via init container or env composition
    - [ ] Resource requests: 256Mi memory, 250m CPU; limits: 1Gi memory, 1000m CPU
    - [ ] Liveness probe: HTTP GET `/api/v1/health` port 8000, period 30s, failureThreshold 3, initialDelay 15s
    - [ ] Readiness probe: HTTP GET `/api/v1/health` port 8000, initialDelay 10s, period 10s
    - [ ] Pod anti-affinity: prefer spreading across nodes (`topologyKey: kubernetes.io/hostname`)
  - [ ] Create `infra/k8s/backend/service.yaml`
    - [ ] ClusterIP Service on port 8000
  - [ ] Create `infra/k8s/backend/hpa.yaml`
    - [ ] HorizontalPodAutoscaler v2
    - [ ] `scaleTargetRef` pointing to backend Deployment
    - [ ] `minReplicas: 2`, `maxReplicas: 10`
    - [ ] Metrics: CPU average utilization target 70%, memory average utilization target 80%
    - [ ] `behavior.scaleDown.stabilizationWindowSeconds: 300` (5-minute cooldown to prevent flapping)

- [ ] Task 7: Create Frontend Deployment (AC: #2, #11)
  - [ ] Create `infra/k8s/frontend/deployment.yaml`
    - [ ] Image: `stravel-frontend:latest` (placeholder -- assumes nginx-based production build)
    - [ ] Deployment with 2 replicas
    - [ ] Container port: 80
    - [ ] Resource requests: 64Mi memory, 50m CPU; limits: 128Mi memory, 100m CPU
    - [ ] Liveness probe: TCP socket port 80, period 30s, failureThreshold 3
    - [ ] Readiness probe: TCP socket port 80, initialDelay 5s, period 10s
  - [ ] Create `infra/k8s/frontend/service.yaml`
    - [ ] ClusterIP Service on port 80

- [ ] Task 8: Create vLLM Deployment with GPU scheduling (AC: #4, #11, #12)
  - [ ] Create `infra/k8s/vllm/deployment.yaml`
    - [ ] Image: `vllm/vllm-openai:latest`
    - [ ] Deployment with 1 replica (GPU-bound, scaled manually or via custom metrics)
    - [ ] Container port: 8000
    - [ ] `nodeSelector: { "nvidia.com/gpu": "true" }`
    - [ ] `tolerations` for GPU taint: `nvidia.com/gpu=present:NoSchedule`
    - [ ] Resource requests: 4Gi memory, 2000m CPU, `nvidia.com/gpu: 1`; limits: 8Gi memory, 4000m CPU, `nvidia.com/gpu: 1`
    - [ ] Command args: `["--model", "Qwen/Qwen3-8B", "--host", "0.0.0.0", "--port", "8000", "--max-model-len", "8192"]`
    - [ ] Liveness probe: HTTP GET `/health` port 8000, period 30s, failureThreshold 5, initialDelay 120s
    - [ ] Readiness probe: HTTP GET `/health` port 8000, initialDelay 60s, period 15s, failureThreshold 10
    - [ ] Longer timeouts to accommodate model loading
  - [ ] Create `infra/k8s/vllm/service.yaml`
    - [ ] ClusterIP Service on port 8000, named `vllm`

- [ ] Task 9: Create Ingress (AC: #10)
  - [ ] Create `infra/k8s/ingress.yaml`
    - [ ] Ingress with `ingressClassName: nginx`
    - [ ] Annotations for cert-manager TLS: `cert-manager.io/cluster-issuer: letsencrypt-prod`
    - [ ] Annotations for nginx: `nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"` (SSE long-poll), `nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"`, `nginx.ingress.kubernetes.io/proxy-body-size: "10m"`
    - [ ] TLS section with `hosts: ["stravel.example.com"]` and `secretName: stravel-tls` (placeholder domain)
    - [ ] Rule 1: host `stravel.example.com`, path `/api/v1` -> backend service port 8000, pathType `Prefix`
    - [ ] Rule 2: host `stravel.example.com`, path `/` -> frontend service port 80, pathType `Prefix`
    - [ ] Add comment: `# Replace stravel.example.com with your actual domain`

- [ ] Task 10: Create Kustomization file (AC: #1, #14)
  - [ ] Create `infra/k8s/kustomization.yaml` with:
    - [ ] `namespace: stravel`
    - [ ] `resources:` listing namespace.yaml, all service subdirectory files, ingress.yaml
    - [ ] `commonLabels: { app.kubernetes.io/part-of: stravel }`
  - [ ] Verify `kubectl kustomize infra/k8s/` renders all resources without errors (dry-run validation)

- [ ] Task 11: Verify manifest correctness (AC: #1 through #14)
  - [ ] Run `kubectl apply -k infra/k8s/ --dry-run=client` to validate all manifests parse correctly
  - [ ] Verify all resource names follow convention: `stravel-{service}` (e.g., `stravel-backend`, `stravel-postgresql`)
  - [ ] Verify all pods reference the correct ConfigMap and Secret names
  - [ ] Verify all Services use correct selectors matching their Deployment/StatefulSet labels
  - [ ] Verify HPA targets the correct Deployment name
  - [ ] Verify Ingress backend service names and ports match the Service definitions
  - [ ] Verify all probes use correct paths, ports, and timing values
  - [ ] Verify PostgreSQL and Qdrant PVCs have correct mount paths and sizes

## Dev Notes

### File Structure

```
infra/k8s/
  kustomization.yaml              # Kustomize aggregator -- single entry point
  namespace.yaml                  # stravel namespace
  ingress.yaml                    # Ingress routing rules + TLS
  config/
    configmap.yaml                # Non-sensitive config
    secrets.yaml                  # Sensitive config (placeholder values)
  backend/
    deployment.yaml               # Backend Deployment (2+ replicas)
    service.yaml                  # ClusterIP Service
    hpa.yaml                      # HorizontalPodAutoscaler
  frontend/
    deployment.yaml               # Frontend Deployment (nginx)
    service.yaml                  # ClusterIP Service
  postgresql/
    statefulset.yaml              # StatefulSet with PVC
    service.yaml                  # ClusterIP Service (headless for StatefulSet)
  qdrant/
    statefulset.yaml              # StatefulSet with PVC
    service.yaml                  # ClusterIP Service
  redis/
    deployment.yaml               # Deployment (ephemeral cache)
    service.yaml                  # ClusterIP Service
  vllm/
    deployment.yaml               # Deployment with GPU nodeSelector
    service.yaml                  # ClusterIP Service
```

### Resource Naming Convention

All K8S resources follow the pattern `stravel-{service}`:

| Resource | Name |
|---|---|
| Namespace | `stravel` |
| Backend Deployment | `stravel-backend` |
| Backend Service | `stravel-backend` |
| Backend HPA | `stravel-backend` |
| Frontend Deployment | `stravel-frontend` |
| Frontend Service | `stravel-frontend` |
| PostgreSQL StatefulSet | `stravel-postgresql` |
| PostgreSQL Service | `stravel-postgresql` |
| Qdrant StatefulSet | `stravel-qdrant` |
| Qdrant Service | `stravel-qdrant` |
| Redis Deployment | `stravel-redis` |
| Redis Service | `stravel-redis` |
| vLLM Deployment | `stravel-vllm` |
| vLLM Service | `stravel-vllm` |
| ConfigMap | `stravel-config` |
| Secret | `stravel-secrets` |
| Ingress | `stravel-ingress` |

### Label Convention

All resources use consistent labels for selection and grouping:

```yaml
metadata:
  labels:
    app.kubernetes.io/name: {service-name}         # e.g., backend, postgresql
    app.kubernetes.io/instance: stravel
    app.kubernetes.io/part-of: stravel
    app.kubernetes.io/component: {component-type}   # api, database, cache, llm, frontend
```

### Backend Environment Variable Composition

The backend needs a composed `DATABASE_URL` from ConfigMap + Secret values. Use an init approach or direct env composition:

```yaml
env:
  - name: POSTGRES_PASSWORD
    valueFrom:
      secretKeyRef:
        name: stravel-secrets
        key: POSTGRES_PASSWORD
  - name: DATABASE_URL
    value: "postgresql://$(DATABASE_USER):$(POSTGRES_PASSWORD)@$(DATABASE_HOST):$(DATABASE_PORT)/$(DATABASE_NAME)"
  - name: SECRET_KEY
    valueFrom:
      secretKeyRef:
        name: stravel-secrets
        key: SECRET_KEY
```

Note: Kubernetes performs `$(VAR)` substitution in `value` fields using previously defined env vars. Order matters -- define `POSTGRES_PASSWORD`, `DATABASE_USER`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME` before `DATABASE_URL`.

### Ingress SSE Configuration

SSE streaming requires long-lived connections. The Ingress must be configured with extended timeouts:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-buffering: "off"        # Critical for SSE
    nginx.ingress.kubernetes.io/proxy-request-buffering: "off"
```

Without `proxy-buffering: off`, nginx will buffer SSE events and deliver them in batches instead of streaming.

### vLLM GPU Scheduling

vLLM requires GPU nodes. The deployment uses both `nodeSelector` and `tolerations`:

```yaml
spec:
  nodeSelector:
    nvidia.com/gpu: "true"
  tolerations:
    - key: nvidia.com/gpu
      operator: Exists
      effect: NoSchedule
  containers:
    - resources:
        limits:
          nvidia.com/gpu: 1
        requests:
          nvidia.com/gpu: 1
```

If no GPU nodes are available, the vLLM pod will remain in `Pending` state. This is expected -- it does not block other services. For development clusters without GPUs, the vLLM deployment can be excluded via Kustomize overlay.

### StatefulSet vs Deployment Decision Matrix

| Service | Controller | Reasoning |
|---|---|---|
| PostgreSQL | StatefulSet | Persistent storage, stable network identity, ordered startup/shutdown |
| Qdrant | StatefulSet | Persistent vector storage, stable pod identity for data consistency |
| Redis | Deployment | Ephemeral cache, no persistent state needed for MVP, LRU eviction policy |
| Backend | Deployment | Stateless API, horizontally scalable, no local state |
| Frontend | Deployment | Stateless static file server, horizontally scalable |
| vLLM | Deployment | Stateless inference server, model loaded from external storage |

### HPA Configuration Rationale

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2       # Always maintain HA
  maxReplicas: 10      # NFR-5: 10 concurrent Advisory Sessions
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70    # Scale before saturation
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80    # Memory-intensive agent workloads
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # 5-min cooldown prevents flapping
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60            # Remove 1 pod per minute max
    scaleUp:
      stabilizationWindowSeconds: 30   # Scale up quickly under load
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60            # Add up to 2 pods per minute
```

### Probe Timing Summary

| Service | Probe Type | Path/Command | Initial Delay | Period | Failure Threshold |
|---|---|---|---|---|---|
| Backend | Liveness | HTTP `/api/v1/health` :8000 | 15s | 30s | 3 |
| Backend | Readiness | HTTP `/api/v1/health` :8000 | 10s | 10s | 3 |
| Frontend | Liveness | TCP :80 | 5s | 30s | 3 |
| Frontend | Readiness | TCP :80 | 5s | 10s | 3 |
| PostgreSQL | Liveness | exec `pg_isready -U stravel` | 10s | 10s | 3 |
| PostgreSQL | Readiness | exec `pg_isready -U stravel` | 5s | 5s | 3 |
| Qdrant | Liveness | HTTP `/readyz` :6333 | 15s | 15s | 3 |
| Qdrant | Readiness | HTTP `/readyz` :6333 | 10s | 10s | 3 |
| Redis | Liveness | exec `redis-cli ping` | 5s | 10s | 3 |
| Redis | Readiness | exec `redis-cli ping` | 5s | 5s | 3 |
| vLLM | Liveness | HTTP `/health` :8000 | 120s | 30s | 5 |
| vLLM | Readiness | HTTP `/health` :8000 | 60s | 15s | 10 |

vLLM has longer initial delays and higher failure thresholds because model loading can take 60-120 seconds depending on model size and GPU speed.

### Secrets Handling -- IMPORTANT

The `secrets.yaml` file in this story contains placeholder base64-encoded values. These exist solely for structural validation and dry-run testing.

**For production deployment:**
- Replace all placeholder values with real secrets
- Consider using `SealedSecrets`, `ExternalSecrets`, or a vault integration (e.g., HashiCorp Vault) for secret management
- Never commit real secrets to version control
- The `secrets.yaml` placeholder values are intentionally obvious (`Y2hhbmdlLW1lLWluLXByb2R1Y3Rpb24=` = `change-me-in-production`)

### Kustomization Structure

```yaml
# infra/k8s/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: stravel

commonLabels:
  app.kubernetes.io/part-of: stravel
  app.kubernetes.io/managed-by: kustomize

resources:
  - namespace.yaml
  - config/configmap.yaml
  - config/secrets.yaml
  - postgresql/statefulset.yaml
  - postgresql/service.yaml
  - qdrant/statefulset.yaml
  - qdrant/service.yaml
  - redis/deployment.yaml
  - redis/service.yaml
  - backend/deployment.yaml
  - backend/service.yaml
  - backend/hpa.yaml
  - frontend/deployment.yaml
  - frontend/service.yaml
  - vllm/deployment.yaml
  - vllm/service.yaml
  - ingress.yaml
```

### Container Images

| Service | Image | Notes |
|---|---|---|
| Backend | `stravel-backend:latest` | Built from `backend/Dockerfile`. CI/CD sets real tag. |
| Frontend | `stravel-frontend:latest` | Requires a production Dockerfile (nginx serving built React). Not yet created -- use placeholder image reference. |
| PostgreSQL | `postgres:16` | Same as Docker Compose |
| Qdrant | `qdrant/qdrant:latest` | Same as Docker Compose |
| Redis | `redis:7-alpine` | Same as Docker Compose |
| vLLM | `vllm/vllm-openai:latest` | Same as `docker-compose.full.yml` (Story 2.7) |

### Frontend Dockerfile Note

The frontend currently has no Dockerfile. For K8S deployment, a multi-stage build is assumed:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

This Dockerfile is NOT created as part of this story -- it is referenced here for context. The K8S manifests assume it exists when images are built by CI/CD.

### Relationship to Docker Compose

| Docker Compose | K8S Equivalent | Migration Notes |
|---|---|---|
| `docker-compose.yml` services | Deployments/StatefulSets | Same images, ports, environment |
| `volumes:` named volumes | PersistentVolumeClaims | PVC replaces named volumes |
| `ports:` host mapping | Service ClusterIP + Ingress | No host ports in K8S |
| `environment:` inline | ConfigMap + Secret refs | Externalized configuration |
| `depends_on:` | Readiness probes + init containers | K8S handles dependency via probes |
| `healthcheck:` | Liveness + readiness probes | Split into two probe types |

### Anti-Patterns -- DO NOT

- **DO NOT** use `hostPath` volumes for databases -- use PersistentVolumeClaims only
- **DO NOT** hardcode secrets in manifests -- use Secret references with placeholder values
- **DO NOT** use `LoadBalancer` Services directly -- route all external traffic through Ingress
- **DO NOT** skip resource requests/limits on any container -- K8S scheduler needs them for placement
- **DO NOT** set HPA `minReplicas: 1` for the backend -- maintain HA with minimum 2 replicas
- **DO NOT** set identical liveness and readiness probe configurations -- readiness should be faster and more sensitive
- **DO NOT** use `latest` tag in production images without `imagePullPolicy: Always` -- pin tags in real deployments
- **DO NOT** create NetworkPolicies in this story -- that is a future hardening concern
- **DO NOT** create ServiceMonitor/PodMonitor resources -- that is Story 6.2 (Observability)

### Prerequisites

- Story 1.1 (Project Setup) -- provides `infra/k8s/` directory and backend Dockerfile
- Story 2.7 (vLLM Serving Setup) -- provides vLLM container configuration and model parameters
- All Epic 1-5 stories -- the K8S manifests deploy the complete application

### Testing Approach

- Validate manifests with `kubectl apply --dry-run=client` (no cluster required)
- Validate Kustomize rendering with `kubectl kustomize infra/k8s/`
- Optionally validate with `kubeval` or `kubeconform` for schema correctness
- For actual cluster testing, use `kind` (Kubernetes in Docker) or `minikube` locally
- vLLM deployment will remain `Pending` without GPU nodes -- this is expected and does not indicate failure

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- Progressive Infrastructure Plan (Phase 4)]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Infrastructure & Deployment decisions]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Project Structure (Target State) -- infra/k8s/]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 6, Story 6.1]
- [Source: _bmad-output/project-context.md -- Progressive Infrastructure Phase 4]
- [Source: docker-compose.yml -- Phase 1 service definitions]
- [Source: docker-compose.full.yml -- Phase 2+ service definitions (Qdrant, Redis)]
- [Source: backend/Dockerfile -- Backend container build]
- [Source: backend/app/api/v1/health.py -- Health endpoint used for probes]

## Dev Agent Record

### Agent Model Used

(To be filled by implementing agent)

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled on completion)

### Change Log

- 2026-05-24: Story spec created -- ready for dev

### File List

(To be filled on completion with all created/modified files)
