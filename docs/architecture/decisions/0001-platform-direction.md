# ADR 0001: Platform direction for the PaySync sandbox

- Status: Accepted
- Date: 1 September 2026
- Decision owners: PaySync project owner and engineering agent

## Context

PaySync requires authenticated multi-tenant access, PostgreSQL transaction semantics, provider API connectivity, scheduled reconciliation, and a low-cost deployment path that does not require a purchased domain.

The current prototype uses Cloudflare-compatible Vinext and local D1. D1 is useful for prototyping but does not satisfy the SDLC requirement for PostgreSQL row locking and `FOR UPDATE SKIP LOCKED` batch selection.

## Decision

- GitHub is the source-control and CI/CD authority.
- Cloudflare Workers-compatible infrastructure is the web/API deployment target.
- Supabase PostgreSQL will become the authoritative database in Stage 1.
- Supabase Auth will provide identity in Stage 2.
- Supabase Storage will be used only where durable files or exports are required.
- The web application will become an installable PWA before a separate Expo/React Native client is developed.
- MTN and Airtel sandbox integrations must pass before production credentials are introduced.

## Consequences

- The Stage 1 PostgreSQL migration replaces the former D1 routes and migrations after local SQL, RLS, concurrency, and PostgREST parity verification.
- Payment-critical batch claiming will be performed inside PostgreSQL transactions or narrowly scoped database functions.
- Authorization will be enforced by both RLS and server-side checks.
- The free tiers are suitable for development and sandbox validation, not an assurance of production availability, backups, or service levels.
- A paid operational plan must be reviewed before material real-money volume.
