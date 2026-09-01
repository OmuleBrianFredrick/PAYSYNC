# PaySync Operational Blueprint

Status: Active and binding

Adopted: 1 September 2026
Authority: PaySync SDLC Document plus approved amendments recorded here

## Operating Rules

1. Execute stages strictly in the numbered order below.
2. Do not mark a stage complete until all of its exit criteria are met and verified.
3. At each completion, explicitly state:
   - `Stage N — <name>: COMPLETE`
   - what was delivered and verified;
   - `Next stage: Stage N+1 — <name>`.
4. When user testing or participation is required, explicitly state: `Now this is the time for us to test.` Then provide the exact test procedure and wait for the result when it is a blocking gate.
5. Do not silently change the order, architecture, security model, or acceptance criteria.
6. If new evidence requires a change, propose a dated amendment containing the reason, effect, risks, and affected stages. Do not adopt a material amendment without user agreement.
7. The SDLC remains the governing living product specification. This blueprint controls execution order and incorporates approved architectural and security improvements.
8. Never place real credentials, API keys, secrets, database passwords, or production recipient data in Git, documentation, logs, screenshots, or chat output.
9. Real-money execution is prohibited until the controlled pilot gate in Stage 12 and explicit user authorization.
10. Preserve completed-stage evidence in source control: migrations, tests, reports, runbooks, or release notes as appropriate.

## Stage Register

| Stage | Name | Current status |
|---:|---|---|
| 0 | Governance and project baseline | IN PROGRESS |
| 1 | Supabase PostgreSQL migration | NOT STARTED |
| 2 | Authentication, roles and tenant isolation | NOT STARTED |
| 3 | Complete ingestion pipeline | NOT STARTED |
| 4 | Real name-verification integration | NOT STARTED |
| 5 | Atomic batch and payment engine | NOT STARTED |
| 6 | Webhooks, reconciliation and safe retries | NOT STARTED |
| 7 | Complete web product and PWA | NOT STARTED |
| 8 | Security and financial hardening | NOT STARTED |
| 9 | Comprehensive QA and UAT | NOT STARTED |
| 10 | GitHub deployment and sandbox release | NOT STARTED |
| 11 | Monitoring and operational readiness | NOT STARTED |
| 12 | Controlled real-world pilot | NOT STARTED |

## Approved Technical Direction

- Source control and CI/CD: GitHub and GitHub Actions.
- Web application and API: Cloudflare Workers-compatible deployment.
- Authoritative database: Supabase PostgreSQL.
- Authentication: Supabase Auth.
- File storage and exports: Supabase Storage where required.
- Monitoring: Sentry-compatible error monitoring, health checks, and reconciliation heartbeat.
- Client strategy: responsive web application and installable PWA first; Expo/React Native after the API and pilot are stable.
- Payment providers: MTN MoMo and Airtel Money sandbox integrations before production credentials.

## Ordered Stage Scope and Gates

### Stage 0 — Governance and project baseline

Clean and upload the repository; establish branches, CI baseline, issue/PR conventions, architecture decisions, environment examples, secret scanning, SDLC amendment process, and reproducible build/test instructions. Complete only when a clean checkout builds and tests without committed secrets.

### Stage 1 — Supabase PostgreSQL migration

Replace D1 as the authoritative store; introduce migration-managed organizations, profiles, sessions, contacts, batches, payments, provider events, and audit records; enforce integer money, state constraints, idempotency, indexes, and atomic `FOR UPDATE SKIP LOCKED` claiming. Complete only after migration, integration, and concurrency tests pass.

### Stage 2 — Authentication, roles and tenant isolation

Implement Supabase sign-in, registration, recovery, logout, protected routes, inactivity logout, pending/active/suspended accounts, cashier/auditor/admin roles, admin approval, MFA for administrators, RLS, organization isolation, and server-side authorization. Complete only after anonymous, role, and cross-organization denial tests pass.

### Stage 3 — Complete ingestion pipeline

Complete CSV/XLS/XLSX and manual ingestion through one validation service; flexible headers; 5,000-row limit; chunking; duplicates; integer amounts; rejection reports; checksums; and source-file retention policy. Complete only after format-parity and maximum-load tests pass.

### Stage 4 — Real name-verification integration

Connect genuine MTN and Airtel sandboxes; add secrets handling, bounded concurrency, timeouts, backoff, explicit result states, provider references, override reasons, and optional four-eyes review. Complete only when both providers return genuine sandbox results and unverified/unknown recipients remain blocked.

### Stage 5 — Atomic batch and payment engine

Implement atomic batches, mandatory confirmation, idempotency, immutable attempts, provider submission, Airtel PIN encryption, limits, dual approval, kill switches, and duplicate-reference protection. Complete only after concurrency and repeated-request tests prove that duplicate payment is prevented.

### Stage 6 — Webhooks, reconciliation and safe retries

Implement authenticated callbacks, replay protection, polling fallback, scheduled reconciliation, separate unknown/failed states, bounded retry, stuck-payment handling, auto-completion, pause, and cancellation. Complete only after delayed, duplicated, and out-of-order callback tests pass without unsafe resend.

### Stage 7 — Complete web product and PWA

Replace sample data; complete cashier, auditor, and administrator experiences; reconciliation, exports, responsive layouts, installable PWA, safe offline behavior, and accessibility. Complete only when all three role journeys pass on desktop and mobile layouts using real authorized data.

### Stage 8 — Security and financial hardening

Threat modeling, dependency/secret scanning, authorization and injection testing, CSRF controls where applicable, credential rotation, log redaction, CSP, backup restoration, incident response, anomaly alerts, and administrative re-authentication. Complete only with no unresolved critical/high findings and a successful restoration rehearsal.

### Stage 9 — Comprehensive QA and UAT

Unit, PostgreSQL integration, adapter, webhook, component, browser, concurrency, idempotency, 5,000-row load, outage simulation, and structured operator UAT. This stage must explicitly trigger: `Now this is the time for us to test.` Complete only after required user/UAT evidence and resolution of release blockers.

### Stage 10 — GitHub deployment and sandbox release

Implement GitHub Actions, automated migrations, Cloudflare preview/production deployment, environment-separated secrets, health checks, rollback, and versioned releases using a free service address until a domain is acquired. Complete only after tested deployment and demonstrated rollback.

### Stage 11 — Monitoring and operational readiness

Add error tracking, uptime checks, reconciliation heartbeat, payment/authentication alerts, resource warnings, support runbooks, independent backups/exports, audit search, and operational dashboards. Complete only after a simulated critical failure produces an actionable alert and the runbook succeeds.

### Stage 12 — Controlled real-world pilot

Complete regulatory/provider readiness, production credentials, low limits, small internal cohort, four-eyes approval, per-batch manual reconciliation, pilot reporting, and controlled limit progression. This stage requires explicit user authorization and must state: `Now this is the time for us to test.` Complete only when every pilot payment reconciles and stakeholders approve progression.

## Post-Launch Backlog

After Stage 12: analytics, accounting exports, Expo/React Native mobile app, push notifications, additional networks, multi-currency/country support, configurable maker-checker workflows, customer API access, fraud/anomaly scoring, and advanced continuity/backups.

## Amendment Log

| Date | Amendment | Status |
|---|---|---|
| 1 September 2026 | Adopted the 13-stage execution blueprint, Supabase PostgreSQL/Auth architecture, Cloudflare-compatible deployment, strengthened account approval, RLS, idempotency, maker-checker controls, monitoring, and controlled-pilot gates. | APPROVED |

## Current Handoff

Stage 0 is in progress using `https://github.com/OmuleBrianFredrick/PAYSYNC` as the authorized remote repository.
