import { env } from "cloudflare:workers";
export async function POST(request: Request, context: { params: Promise<{ id: string; contactId: string }> }) {
  const { id, contactId } = await context.params; const sessionId = Number(id), recipientId = Number(contactId); const payload = await request.json() as { action?: "approve" | "skip" };
  if (!Number.isInteger(sessionId) || !Number.isInteger(recipientId) || !["approve", "skip"].includes(payload.action ?? "")) return Response.json({ error: "Invalid review action" }, { status: 400 });
  const contact = await env.DB.prepare("SELECT id, registered_name AS registeredName, names_match AS namesMatch, payment_status AS paymentStatus FROM contacts WHERE id = ? AND session_id = ?").bind(recipientId, sessionId).first<{ id: number; registeredName: string | null; namesMatch: number | null; paymentStatus: string }>();
  if (!contact) return Response.json({ error: "Recipient not found" }, { status: 404 });
  if (!contact.registeredName || contact.namesMatch !== 0 || contact.paymentStatus !== "pending") return Response.json({ error: "Only unresolved name mismatches can be reviewed" }, { status: 409 });
  if (payload.action === "approve") await env.DB.prepare("UPDATE contacts SET names_match = 1 WHERE id = ? AND session_id = ? AND names_match = 0").bind(recipientId, sessionId).run(); else await env.DB.prepare("UPDATE contacts SET payment_status = 'skipped' WHERE id = ? AND session_id = ? AND names_match = 0").bind(recipientId, sessionId).run();
  await env.DB.prepare("INSERT INTO audit_log (session_id, action, details) VALUES (?, ?, ?)").bind(sessionId, payload.action === "approve" ? "contact.mismatch_approved" : "contact.skipped", JSON.stringify({ contactId: recipientId, registeredName: contact.registeredName })).run();
  return Response.json({ ok: true, action: payload.action });
}
