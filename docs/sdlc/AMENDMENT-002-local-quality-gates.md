# Amendment 002 — Local Quality Gates During GitHub Actions Account Lock

Date: 1 September 2026
Status: Approved by the product owner

## Reason

GitHub accepts and stores the PaySync repository, but GitHub Actions currently refuses to start jobs because the account is locked by a billing issue. This external account condition must not halt product development.

## Decision

Development will continue locally in the approved stage order. Before any development commit is pushed to GitHub, the change must pass the locally available equivalents of the repository quality gates:

1. reproducible dependency installation;
2. lint and static checks;
3. automated tests relevant to the change;
4. a production build;
5. production dependency audit;
6. secret and credential checks; and
7. migration or database verification when the change affects persistence.

Only a locally verified, working revision may be committed and pushed. GitHub remains the authoritative remote source repository. GitHub Actions repair and full remote CI/CD validation are deferred to Stage 10, or earlier if the account lock is removed.

## Effect on the Blueprint

- Stage 0 is complete because its clean-checkout, governance, security, and reproducibility requirements have been demonstrated locally and pushed remotely.
- Stage 1 may begin immediately.
- This amendment changes the location of the interim quality gate, not its rigor.
- Stage 10 still requires functioning GitHub Actions and successful remote deployment checks before it can be completed.

## Risks and Controls

- **Risk:** local and hosted CI environments may differ.
  **Control:** use clean installs, pinned dependencies, committed scripts, and repeat all checks in GitHub Actions when the account is restored.
- **Risk:** a developer machine may conceal untracked configuration.
  **Control:** verify tracked files, environment examples, clean builds, and absence of committed secrets before every push.
- **Risk:** database changes may appear valid without a real PostgreSQL runtime.
  **Control:** Stage 1 cannot complete until migrations and concurrency behavior pass against PostgreSQL/Supabase.
