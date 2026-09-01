import { spawn, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(testsDirectory, "..", "..");
const containerName = "paysync-stage1-postgres";
const postgrestContainerName = "paysync-stage1-postgrest";
const image = "postgres:17-alpine";
const jwtSecret = "paysync-local-stage1-jwt-secret-for-tests";

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: projectDirectory,
    encoding: "utf8",
    stdio: options.input ? ["pipe", "pipe", "pipe"] : "pipe",
    input: options.input,
  });
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function sqlFile(relativePath) {
  const sql = readFileSync(resolve(projectDirectory, relativePath), "utf8");
  return docker(
    ["exec", "-i", containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    { input: sql },
  );
}

function concurrentClaim(idempotencyKey) {
  const sql = [
    "set role authenticated",
    "select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', false)",
    `select public.claim_payment_batch('c0000000-0000-0000-0000-000000000003', 5, '${idempotencyKey}')`,
  ].join("; ");
  return new Promise((resolvePromise, reject) => {
    const child = spawn("docker", [
      "exec", containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql,
    ], { cwd: projectDirectory, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise() : reject(new Error(stderr || `claim exited ${code}`)));
  });
}

function concurrentSessionCreate() {
  const sql = [
    "set role service_role",
    "select public.create_payment_session_as_service('a0000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'concurrent-create-0001', 'Concurrent idempotent creation', 'manual', 10, '[{\"name\":\"Concurrent Recipient\",\"phone_e164\":\"+256771888001\",\"network\":\"MTN\",\"amount_minor\":9000}]'::jsonb)",
  ].join("; ");
  return new Promise((resolvePromise, reject) => {
    const child = spawn("docker", [
      "exec", containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql,
    ], { cwd: projectDirectory, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise() : reject(new Error(stderr || `session creation exited ${code}`)));
  });
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function serviceRoleToken() {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({ role: "service_role", exp: Math.floor(Date.now() / 1000) + 300 });
  const signature = createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function verifyPostgrestIntegration() {
  docker([
    "run", "--rm", "-d", "--name", postgrestContainerName,
    "-p", "127.0.0.1:55433:3000",
    "-e", "PGRST_DB_URI=postgres://authenticator@host.docker.internal:55432/postgres",
    "-e", "PGRST_DB_SCHEMAS=public",
    "-e", "PGRST_DB_ANON_ROLE=anon",
    "-e", `PGRST_JWT_SECRET=${jwtSecret}`,
    "public.ecr.aws/supabase/postgrest:v16.1",
  ]);

  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:55433/");
      if (response.ok) { ready = true; break; }
    } catch { /* Service is still starting. */ }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  if (!ready) throw new Error(`PostgREST did not become ready:\n${docker(["logs", postgrestContainerName])}`);

  const token = serviceRoleToken();
  const headers = { apikey: token, authorization: `Bearer ${token}`, "content-type": "application/json" };
  const listResponse = await fetch("http://127.0.0.1:55433/payment_sessions?select=id,reference&limit=1", { headers });
  if (!listResponse.ok) throw new Error(`PostgREST SELECT failed: ${listResponse.status} ${await listResponse.text()}`);
  const sessions = await listResponse.json();
  if (!Array.isArray(sessions) || sessions.length !== 1) throw new Error("PostgREST SELECT returned an unexpected payload");

  const createResponse = await fetch("http://127.0.0.1:55433/rpc/create_payment_session_as_service", {
    method: "POST",
    headers,
    body: JSON.stringify({
      target_organization_id: "a0000000-0000-0000-0000-000000000003",
      actor_user_id: "30000000-0000-0000-0000-000000000003",
      request_idempotency_key: "postgrest-create-0001",
      session_name: "PostgREST integration run",
      session_source: "manual",
      requested_batch_size: 10,
      contact_rows: [{ name: "HTTP Recipient", phone_e164: "+256771888002", network: "MTN", amount_minor: 11000 }],
    }),
  });
  if (!createResponse.ok) throw new Error(`PostgREST RPC failed: ${createResponse.status} ${await createResponse.text()}`);
  process.stdout.write("Stage 1 PostgREST integration test passed.\n");
}

try {
  const existing = docker(["ps", "-a", "--filter", `name=^/${containerName}$`, "--format", "{{.Names}}"]); 
  if (existing.trim()) docker(["stop", containerName]);

  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-p", "127.0.0.1:55432:5432", image]);

  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const probe = spawnSync("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", "postgres"]);
    if (probe.status === 0) { ready = true; break; }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  if (!ready) throw new Error("isolated PostgreSQL did not become ready");

  sqlFile("supabase/tests/local_auth_prelude.sql");
  sqlFile("supabase/migrations/20260901134010_stage_1_core_schema.sql");
  sqlFile("supabase/tests/stage_1_core_schema.sql");
  sqlFile("supabase/tests/stage_1_concurrency_setup.sql");
  await Promise.all([concurrentClaim("concurrent-claim-0001"), concurrentClaim("concurrent-claim-0002")]);
  await Promise.all([concurrentSessionCreate(), concurrentSessionCreate()]);
  process.stdout.write(sqlFile("supabase/tests/stage_1_concurrency_assert.sql"));
  await verifyPostgrestIntegration();
} finally {
  try { docker(["stop", postgrestContainerName]); } catch { /* Best-effort cleanup of the disposable API. */ }
  try { docker(["stop", containerName]); } catch { /* Best-effort cleanup of the disposable test database. */ }
}
