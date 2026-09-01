# PaySync web application

Cloudflare-compatible React/Vinext application and API for PaySync.

## Commands

```bash
npm ci
npm run dev
npm test
npm run lint
```

Supabase PostgreSQL is the authoritative data store. The sandbox name adapters remain transitional until Stage 4 connects the genuine MTN and Airtel sandbox APIs. See the repository-root operational blueprint and ADR 0001 for the approved architecture.

For local application access, copy `.env.example` to `.env.local` and supply the Supabase URL, server-only service-role key, development organization ID, and development operator user ID. Never commit that file. Authentication will replace the temporary configured operator identity in Stage 2.

`npm test` includes application tests plus isolated PostgreSQL, RLS, idempotency, simultaneous-claim, and PostgREST integration tests. Docker must be running; disposable test containers are removed automatically.

Never commit `.env.local`, provider credentials, database passwords, real recipient files, or production transaction data.
