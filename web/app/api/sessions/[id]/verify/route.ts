import { env } from "cloudflare:workers";
import { resolveNames, type VerificationCandidate } from "../../../../../services/name-resolution";
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) return Response.json({ error: "Invalid session" }, { status: 400 });
  const rows = await env.DB.prepare("SELECT id, phone, network, name_on_file AS nameOnFile FROM contacts WHERE session_id = ? AND payment_status = 'pending' AND registered_name IS NULL ORDER BY id LIMIT 5000").bind(sessionId).all<VerificationCandidate>();
  if (!rows.results.length) return Response.json({ verified: 0, matched: 0, mismatched: 0, mode: "sandbox" });
  const results = await resolveNames(rows.results, 5);
  for (let i = 0; i < results.length; i += 100) await env.DB.batch(results.slice(i, i + 100).map((result) => env.DB.prepare("UPDATE contacts SET registered_name = ?, names_match = ? WHERE id = ? AND session_id = ? AND registered_name IS NULL").bind(result.registeredName, result.namesMatch ? 1 : 0, result.id, sessionId)));
  const matched = results.filter((result) => result.namesMatch).length;
  await env.DB.prepare("INSERT INTO audit_log (session_id, action, details) VALUES (?, 'verification.completed', ?)").bind(sessionId, JSON.stringify({ mode: "sandbox", verified: results.length, matched, mismatched: results.length - matched })).run();
  return Response.json({ verified: results.length, matched, mismatched: results.length - matched, mode: "sandbox" });
}
