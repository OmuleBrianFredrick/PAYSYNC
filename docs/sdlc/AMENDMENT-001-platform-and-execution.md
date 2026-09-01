# SDLC Amendment 001 — Platform and execution baseline

- Date: 1 September 2026
- Status: Approved
- Applies to: PaySync SDLC Phases 2, 4, 6, 8, 9, and 10

## Amendment

The SDLC remains the governing living specification. The execution order and acceptance gates are defined by `OPERATIONAL_BLUEPRINT.md`.

Firebase Authentication is replaced by Supabase Auth. The planned PostgreSQL database will be supplied by Supabase. The initial web/API deployment target is Cloudflare Workers-compatible infrastructure using a provider-supplied hostname until a custom domain is acquired. GitHub and GitHub Actions are the source-control and CI/CD authority.

New registrations begin in a `pending` state and receive no payment permission until approved by an administrator. The role model is expanded to `cashier`, `auditor`, and `admin`. Organization-level tenant isolation, PostgreSQL RLS, idempotency, immutable payment attempts, maker-checker controls, kill switches, independent backup/export procedures, and a controlled pilot are mandatory gates.

## Reason

The amendment consolidates authentication and PostgreSQL on a low-cost development platform, preserves the SDLC concurrency design, and introduces controls required before genuine mobile-money testing.

## Impact

The architecture described in the original SDLC remains conceptually valid, but Firebase-specific implementation work is superseded. D1 is transitional and must not remain the authoritative payment database after Stage 1.

