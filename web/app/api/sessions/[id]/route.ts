import { env } from "cloudflare:workers";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) return Response.json({ error: "Invalid session" }, { status: 400 });
  const session = await env.DB.prepare("SELECT id, reference, name, source, status, batch_size AS batchSize, total_contacts AS totalContacts, total_amount AS totalAmount, created_at AS createdAt FROM payment_sessions WHERE id = ?").bind(sessionId).first();
  if (!session) return Response.json({ error: "Payment run not found" }, { status: 404 });
  const contacts = await env.DB.prepare("SELECT id, name_on_file AS nameOnFile, phone, network, amount, registered_name AS registeredName, names_match AS namesMatch, payment_status AS paymentStatus, retry_count AS retryCount FROM contacts WHERE session_id = ? ORDER BY id").bind(sessionId).all();
  const audit = await env.DB.prepare("SELECT id, action, details, created_at AS createdAt FROM audit_log WHERE session_id = ? ORDER BY id DESC LIMIT 30").bind(sessionId).all();
  return Response.json({ session, contacts: contacts.results, audit: audit.results, verificationMode: "sandbox" });
}
