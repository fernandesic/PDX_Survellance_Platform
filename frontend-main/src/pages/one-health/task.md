# One Health — Live Data Migration Task

Convert all hardcoded/mock data in the One Health page to live data from the backend so the dashboard is production-ready.

**Branch:** `feature/oneHealth`
**Owner:** —
**Status:** Not started

---

## Scope

The One Health page (`/one-health`) has 7 areas with hardcoded data. This task replaces each with a live DB-backed source. Out of scope: redesign, new features.

---

## Task 1 — AI Agent Status panel

**Why hardcoded today:** `frontend-main/src/pages/one-health/components/AgentStatus.tsx` has a top-level `AGENTS` array with 5 fake entries (Risk Sentinel, Policy Compiler, Ask TRIAD, Digital Twins, Partner Orchestrator).

### Backend
1. Add table `oh_agents` (or reuse if exists in `sentinel/` app — check `sentinel/views_agent.py` first):
   ```sql
   CREATE TABLE oh_agents (
       agent_id      VARCHAR(40)  PRIMARY KEY,
       name          VARCHAR(80)  NOT NULL,
       icon          VARCHAR(8),
       status        VARCHAR(20)  NOT NULL,  -- running | alert | idle | pending
       status_label  VARCHAR(20)  NOT NULL,  -- RUNNING | AWAITING | ACTIVE | IDLE | QUEUED
       description   TEXT,
       last_activity TIMESTAMPTZ,
       phase         VARCHAR(20)             -- e.g. "Phase III"
   );
   ```
2. Migration: seed the 5 current agents with their current values so visual parity is preserved.
3. Add `AgentsView` in `backend-main/onehealth/views.py`:
   ```
   GET /api/v1/onehealth/agents → list of agents (live status)
   ```
4. Wire URL in `backend-main/onehealth/urls.py`.
5. Optionally extend `LiveStreamView` to push agent updates in the SSE frame (`snap["agents"] = ...`).

### Frontend
1. Add `getAgents()` to `services/oneHealth.ts`.
2. Lift agents state into `OneHealthPage.tsx` (mirror what we did for `alerts`):
   - Fetch once on mount
   - Update from `live.agents` when SSE frames arrive
3. Refactor `AgentStatus.tsx` to accept `agents` + `source` as props (no internal fetch).
4. Pass `agents`/`agentsSource` through `OneHealthView.tsx`.
5. Update the `Phase III` badge to come from the highest agent's `phase` field (or move to a backend KPI).

### Acceptance
- [ ] Editing an agent row in DB updates the UI within 5 seconds (via SSE)
- [ ] Page load shows real agents, not the 5 hardcoded ones
- [ ] No flicker between Operations ↔ Early Warning toggle

---

## Task 2 — Human-in-the-Loop panel

**Why hardcoded today:** `frontend-main/src/pages/one-health/components/HITLPanel.tsx` has a local `items` array with 2 fake actions ("Approve PHEIC Notification", "Inform Kano HPAI T4").

### Backend
1. Add table `oh_hitl_actions`:
   ```sql
   CREATE TABLE oh_hitl_actions (
       action_id     VARCHAR(40)  PRIMARY KEY,
       kind          VARCHAR(20)  NOT NULL,        -- 'approve' | 'inform' | 'review'
       title         VARCHAR(200) NOT NULL,
       description   TEXT,
       severity      VARCHAR(20),                  -- 'amber' | 'cobalt' | 'crimson'
       requested_by  VARCHAR(40),                  -- agent_id FK to oh_agents
       related_alert VARCHAR(20),                  -- alert_id FK to oh_alerts (nullable)
       status        VARCHAR(20)  DEFAULT 'pending', -- pending | approved | dismissed | informed
       created_at    TIMESTAMPTZ  DEFAULT NOW(),
       resolved_at   TIMESTAMPTZ,
       resolved_by   INTEGER                       -- user_id FK
   );
   ```
2. Migration: seed the 2 current items.
3. Add views in `backend-main/onehealth/views.py`:
   ```
   GET  /api/v1/onehealth/hitl/pending         → list of pending actions
   POST /api/v1/onehealth/hitl/<action_id>/approve   → user approves
   POST /api/v1/onehealth/hitl/<action_id>/dismiss   → user dismisses
   POST /api/v1/onehealth/hitl/<action_id>/acknowledge → for 'inform' kind
   ```
4. Wire URLs.
5. Approve/dismiss should write `resolved_at` and `resolved_by` and emit a record in the existing `AuditMiddleware` audit log.

### Frontend
1. Add `getHITLPending()`, `approveHITL(id)`, `dismissHITL(id)`, `acknowledgeHITL(id)` to `services/oneHealth.ts`.
2. Lift HITL state to `OneHealthPage.tsx`.
3. Refactor `HITLPanel.tsx` to accept items as prop and call the action endpoints on click.
4. Update the `2 PENDING` badge to show actual pending count.
5. After approval/dismiss, optimistic-update the list, then re-fetch to sync.

### Acceptance
- [ ] "Approve" button actually persists status change in DB
- [ ] After approval, the item disappears from the list (or moves to "resolved" tab)
- [ ] Pending count badge reflects actual `count(*) WHERE status='pending'`
- [ ] Audit log records the action (visible in `AuditMiddleware` output)

---

## Task 3 — Status Bar (ingestion sources)

**Why hardcoded today:** `frontend-main/src/pages/one-health/components/StatusBar.tsx` has a hardcoded `sources` array (DHIS2, WAHIS, NASA POWER, WHO EWARN, GISAID with fixed timestamps and colors).

### Backend
1. Add view that aggregates last-success timestamps from existing ingestion log tables:
   - DHIS2: from `hdis/` last fetch table
   - WAHIS: from `oh_animal_events.last_synced_at` or similar
   - NASA POWER: from `oh_env_observations` max(updated_at)
   - WHO EWARN: from `sentinel/` ingestion log
   - GISAID: from genomic surveillance table (if exists; else mark "not configured")
2. New endpoint:
   ```
   GET /api/v1/onehealth/ingestion-status → [{name, status, last_seen_iso, color}]
   ```
   `status` ∈ {fresh, stale, disconnected, not_configured}; `color` derived in frontend.
3. Caching: cache 30s in memory — no need to hit DB per page load.

### Frontend
1. Add `getIngestionStatus()` to `services/oneHealth.ts`.
2. Refactor `StatusBar.tsx`:
   - Accept `sources` as prop OR fetch on mount with 30s polling
   - Compute "Xm ago" / "Xh ago" labels client-side from `last_seen_iso`
   - Color: green if <10min, amber if <6h, red if older
3. The "46 Member States · WHO AFRO" can stay static (constant).

### Acceptance
- [ ] Stopping the DHIS2 ingestion job → DHIS2 dot turns red within 30s
- [ ] Restarting it → dot turns green next refresh
- [ ] Each source shows a real "Xm ago" / "Xh ago" timestamp

---

## Task 4 — Spillover Simulation disease list

**Why hardcoded today:** `frontend-main/src/pages/one-health/components/ohData.ts` line 77-83 has `DISEASES` array with 5 entries (HPAI, Ebola, Mpox, RVF, Cholera) with fixed `r0`, `cfr`, `riskLabel`, `riskScore`.

### Backend
1. Existing endpoint `/api/v1/onehealth/pathogens` already returns `oh_pathogen_profiles`. Use this directly.
2. Add a derived field to the response:
   ```python
   risk_score   = spillover_score (0-100, already exists)
   risk_label   = "Critical" if score>=80 else "High" if score>=60 else "Moderate" if score>=40 else "Low"
   r0_range_str = f"{r0_min}–{r0_max}"
   ```
   Either compute in the existing `PathogensView` or in a new `/onehealth/simulation/diseases` view that returns just the fields the simulation needs.

### Frontend
1. `SimulationPanel.tsx` currently imports `DISEASES` from `ohData.ts`. Replace with a fetch:
   - Add `getSimulationDiseases()` to `services/oneHealth.ts`
   - Lift to `OneHealthPage.tsx` (or use a hook with cache since it's slow-changing data)
2. Keep `DISEASES` in `ohData.ts` as a fallback only (when API fails).
3. The five fields used by the panel: `name`, `r0` (mid of min/max), `cfr` (=cfr_pct), `r0Range` (formatted string), `riskLabel`, `riskScore`.

### Acceptance
- [ ] Adding a new pathogen row in `oh_pathogen_profiles` → appears in the simulation disease list after page reload
- [ ] R₀ and CFR shown match the DB values, not the hardcoded 1.85 / 55%
- [ ] Selecting a new disease re-runs the SEIR explain with that disease's r0/cfr

---

## Task 5 — Map Legend tier counts

**Why hardcoded today:** `frontend-main/src/pages/one-health/components/MapLegend.tsx` shows static tier labels. Counts (e.g., "3 Tier 4 active") not displayed today but desirable.

### Frontend (no backend change)
1. Compute tier counts from already-loaded `countries` + `alerts` arrays.
2. Display as `Tier 4 Alert — N Active` etc.
3. Pass `countries` and `alerts` as props to `MapLegend`.

### Acceptance
- [ ] Legend shows live count next to each tier
- [ ] Counts update when alerts change

---

## Task 6 — Epi-Links

**Why hardcoded today:** `frontend-main/src/pages/one-health/components/ohData.ts` has `EPI_LINKS` constant array. Backend endpoint `/onehealth/epilinks` already exists but is unused.

### Frontend (no backend change)
1. In `OneHealthPage.tsx`, add `epiLinks` state.
2. Bootstrap fetch via `oneHealthApi.getEpiLinks()` (already in service).
3. Pass to `OneHealthMap` (currently uses static `EPI_LINKS`).
4. Update `OneHealthMap.tsx` to take `epiLinks` as prop instead of importing constant.
5. Keep static `EPI_LINKS` in `ohData.ts` as fallback only.

### Acceptance
- [ ] When `Epi-Links` toggle is on, lines drawn match `oh_epi_links` table
- [ ] Adding a row in `oh_epi_links` → new line appears after page reload

---

## Task 7 — Country tooltip data

**Why hardcoded today:** Tooltip shows static `risk`, `spar`, `tier`, `alert.disease`, `alert.note` from `COUNTRIES` constant. Currently overlaid with API data via `apiToStatic` mapper, but `tier` is hardcoded to 0 and `alert` is `undefined`.

### Backend
1. Either:
   - Extend `/onehealth/countries` response to include the highest active alert per country (`max_tier`, `top_alert_disease`, `top_alert_note`), OR
   - Frontend joins `countries` + `alerts` arrays already loaded in parent.

### Frontend
1. In `apiToStatic`, after both fetches complete, lookup matching alert per country and populate `tier` + `alert`.
2. This means deriving the "static" shape after both API calls, not just on countries load.

### Acceptance
- [ ] Hovering a country with a Tier 4 alert shows tier 4 in tooltip (not 0)
- [ ] Tooltip disease name matches the alert feed

---

## Cross-cutting

- [ ] All new endpoints inherit `OHBaseView` (DRF auth via JWT cookie)
- [ ] All new tables get `tenant_id` FK if multi-tenancy is required (check `utils/tenant_middleware.py`)
- [ ] Migrations include data seed for visual parity on first deploy
- [ ] Add API responses to `LiveStreamView` SSE frames where useful (agents, hitl, alerts already there)
- [ ] Frontend types extended in `services/oneHealth.ts`

## Out of scope (separate tasks)
- Search index — backend already exists; client-side migration is a separate perf task
- Real authentication for agents (e.g., Risk Sentinel actually scanning feeds) — that's Phase IV
- Layer toggle persistence per user

---

## Suggested execution order

1. **Task 4** (Pathogens) — smallest, fully decoupled, gives confidence
2. **Task 6** (Epi-Links) — frontend-only, easy
3. **Task 7** (Country tooltip) — frontend-only
4. **Task 1** (Agents) — backend-heavy, foundation for HITL
5. **Task 2** (HITL) — depends on Task 1
6. **Task 3** (Ingestion status) — needs introspection of other apps' tables
7. **Task 5** (Legend counts) — quick win after Task 1 lands

Each task should be its own PR — no big bang merge.
