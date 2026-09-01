# PaySync web application

Cloudflare-compatible React/Vinext application and API for PaySync.

## Commands

```bash
npm ci
npm run dev
npm test
npm run lint
```

The current D1 database and sandbox name adapters are transitional. See the repository-root operational blueprint and ADR 0001 for the approved Supabase PostgreSQL/Auth migration.

Never commit `.env.local`, provider credentials, database passwords, real recipient files, or production transaction data.

