# Security Policy

## Supported code

Security fixes are applied to the `main` branch while PaySync is pre-release.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Contact the repository owner privately through GitHub and include the affected component, reproduction steps, impact, and any suggested mitigation. Do not include real credentials, recipient data, or transaction identifiers.

## Sensitive areas

Authentication, authorization, RLS policies, payment state transitions, provider callbacks, idempotency, reconciliation, secrets, audit integrity, and database backups are payment-critical. Changes to these areas require explicit tests and review.

## Current limitation

The project is not approved for real-money operation. Current payment adapters are sandbox-only and structurally reject payment submission.

