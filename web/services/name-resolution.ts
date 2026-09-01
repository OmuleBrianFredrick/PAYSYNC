import { getPaymentAdapter, type Network } from "./payment-adapters";
export type VerificationCandidate = { id: string; phone: string; network: Network; nameOnFile: string };
export type VerificationResult = VerificationCandidate & { registeredName: string; namesMatch: boolean; adapterMode: "sandbox" | "live" };
export function normalizeName(name: string) { return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
export async function resolveNames(candidates: VerificationCandidate[], concurrency = 5) {
  const results: VerificationResult[] = new Array(candidates.length); let cursor = 0;
  async function worker() { while (cursor < candidates.length) { const index = cursor++; const candidate = candidates[index]; const adapter = getPaymentAdapter(candidate.network); const registeredName = await adapter.lookupRegisteredName(candidate.phone, candidate.nameOnFile); results[index] = { ...candidate, registeredName, namesMatch: normalizeName(candidate.nameOnFile) === normalizeName(registeredName), adapterMode: adapter.mode }; } }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), candidates.length || 1) }, worker)); return results;
}
