import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build contains the PaySync dashboard and payment-run flow", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const [dashboard, capture] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/new-run/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /Current payment run/);
  assert.match(dashboard, /Every recipient verified before funds move/);
  assert.match(capture, /Create a payment run/);
  assert.match(capture, /Maximum 5,000 rows/);
});

test("ingestion safety rules and PostgreSQL integration are present", async () => {
  const [pipeline, migration, route] = await Promise.all([
    readFile(new URL("../lib/contacts.ts", import.meta.url), "utf8"),
    readFile(new URL("../../supabase/migrations/20260901134010_stage_1_core_schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sessions/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(pipeline, /rows\.length > 5000/);
  assert.match(pipeline, /Duplicate phone number/);
  assert.match(pipeline, /\^2567/);
  assert.match(pipeline, /Number\.isSafeInteger/);
  assert.match(migration, /total_amount_minor bigint/);
  assert.match(migration, /for update of contact skip locked/i);
  assert.match(migration, /enable row level security/i);
  assert.match(route, /create_payment_session_as_service/);
});

test("verification adapters enforce exact matching and human review", async () => {
  const [adapter, resolver, review, screen] = await Promise.all([
    readFile(new URL("../services/payment-adapters.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/name-resolution.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sessions/[id]/contacts/[contactId]/review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sessions/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(adapter, /Sandbox verification adapters cannot move funds/);
  assert.match(resolver, /normalizeName\(candidate\.nameOnFile\) === normalizeName\(registeredName\)/);
  assert.match(resolver, /concurrency = 5/);
  assert.match(review, /contact\.mismatch_approved/);
  assert.match(review, /contact\.skipped/);
  assert.match(screen, /SANDBOX NAME LOOKUP/);
});
