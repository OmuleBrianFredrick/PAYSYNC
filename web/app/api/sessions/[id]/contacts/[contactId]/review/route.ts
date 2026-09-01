import { databaseErrorResponse, getServiceDatabase, getServiceIdentity } from "../../../../../../../db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string; contactId: string }> }) {
  try {
    const { id: sessionId, contactId } = await context.params;
    const payload = await request.json() as { action?: "approve" | "skip"; reason?: string };
    if (!UUID.test(sessionId) || !UUID.test(contactId) || !["approve", "skip"].includes(payload.action ?? "")) {
      return Response.json({ error: "Invalid review action" }, { status: 400 });
    }
    const database = getServiceDatabase();
    const { organizationId, operatorUserId } = getServiceIdentity();
    const { data: contact, error: readError } = await database.from("contacts")
      .select("id,registered_name,verification_status")
      .eq("id", contactId).eq("session_id", sessionId).eq("organization_id", organizationId).maybeSingle();
    if (readError) throw readError;
    if (!contact) return Response.json({ error: "Recipient not found" }, { status: 404 });
    if (!contact.registered_name || contact.verification_status !== "mismatch") {
      return Response.json({ error: "Only unresolved name mismatches can be reviewed" }, { status: 409 });
    }

    const update = payload.action === "approve"
      ? { verification_status: "overridden", override_reason: payload.reason?.trim() || "Approved after manual name review", overridden_by: operatorUserId }
      : { verification_status: "failed" };
    const { error: updateError } = await database.from("contacts").update(update)
      .eq("id", contactId).eq("session_id", sessionId).eq("organization_id", organizationId).eq("verification_status", "mismatch");
    if (updateError) throw updateError;
    const { error: auditError } = await database.from("audit_records").insert({
      organization_id: organizationId, actor_user_id: operatorUserId,
      action: payload.action === "approve" ? "contact.mismatch_approved" : "contact.skipped",
      entity_type: "contact", entity_id: contactId,
      details: { sessionId, registeredName: contact.registered_name, reason: payload.reason?.trim() || null },
    });
    if (auditError) throw auditError;
    return Response.json({ ok: true, action: payload.action });
  } catch (error) {
    return databaseErrorResponse(error, "Review failed");
  }
}
