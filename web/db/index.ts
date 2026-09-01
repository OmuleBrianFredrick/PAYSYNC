import { env } from "cloudflare:workers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type PaySyncRuntimeEnv = {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAYSYNC_ORGANIZATION_ID?: string;
  PAYSYNC_OPERATOR_USER_ID?: string;
};

export class DatabaseConfigurationError extends Error {}

let cachedClient: SupabaseClient | undefined;

function runtimeValue(name: keyof PaySyncRuntimeEnv): string | undefined {
  const workerEnv = env as unknown as PaySyncRuntimeEnv;
  const value = workerEnv[name] ?? (typeof process === "undefined" ? undefined : process.env[name]);
  return value?.trim() || undefined;
}

function required(name: keyof PaySyncRuntimeEnv): string {
  const value = runtimeValue(name);
  if (!value) throw new DatabaseConfigurationError(`Missing server configuration: ${name}`);
  return value;
}

export function getServiceDatabase(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = runtimeValue("SUPABASE_URL") ?? required("NEXT_PUBLIC_SUPABASE_URL");
  cachedClient = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return cachedClient;
}

export function getServiceIdentity() {
  return {
    organizationId: required("PAYSYNC_ORGANIZATION_ID"),
    operatorUserId: required("PAYSYNC_OPERATOR_USER_ID"),
  };
}

export function databaseErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof DatabaseConfigurationError ? 503 : 500;
  return Response.json({ error: status === 503 ? "PaySync database is not configured for this environment." : message }, { status });
}
