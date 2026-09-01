# Contributing to PaySync

## Workflow

1. Select work from the current stage in `OPERATIONAL_BLUEPRINT.md`.
2. Create a focused branch from `main`: `feat/<topic>`, `fix/<topic>`, or `docs/<topic>`.
3. Keep payment-critical changes small and reviewable.
4. Add or update tests for every changed invariant.
5. Run `npm test` and `npm run lint` from `web/`.
6. Open a pull request using the repository template.

## Commit conventions

Use concise imperative commits, for example:

- `feat(auth): add pending account approval`
- `fix(payments): enforce idempotency key uniqueness`
- `docs(sdlc): record architecture amendment`

## Payment-safety requirements

- Never weaken verification, idempotency, authorization, audit, or human-confirmation gates to make a test pass.
- Never use floating-point values for authoritative money storage.
- Never retry an unknown payment automatically.
- Never place secrets or production personal data in code, fixtures, logs, screenshots, commits, or pull requests.
- Schema changes require a migration and rollback or recovery note.
- Material architectural changes require a dated amendment or architecture decision record.

## Review

At least one human review is required before merging payment, authentication, authorization, database, provider, or deployment changes once additional collaborators are available.

