# PaySync

PaySync is a verified bulk mobile-money disbursement platform for Uganda. It is designed to verify the registered identity behind each MTN Mobile Money or Airtel Money number before funds move, require human confirmation for every batch, and preserve a complete audit trail.

> Development status: Stage 0 of the [operational blueprint](OPERATIONAL_BLUEPRINT.md) is in progress. The current payment adapters are explicit sandbox simulators and cannot move real funds.

## Repository structure

- `web/` — Cloudflare-compatible React/Vinext application and API
- `PaySync_SDLC_Document.docx` — governing living product specification
- `PaySync_SDLC_Document.pdf` — readable reference export
- `OPERATIONAL_BLUEPRINT.md` — binding execution order and stage gates
- `docs/architecture/decisions/` — architecture decision records
- `.github/` — CI, security automation, and contribution templates

## Local development

Requirements: Node.js 22.13 or newer and npm.

```bash
cd web
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
cd web
npm test
npm run lint
```

`npm test` performs the production build before running the current automated checks.

## Security

Never commit credentials or real recipient data. Copy `web/.env.example` to `web/.env.local` only when a stage requires local configuration. Report vulnerabilities according to [SECURITY.md](SECURITY.md).

Real-money execution is prohibited until Stage 12 of the operational blueprint and explicit authorization.

