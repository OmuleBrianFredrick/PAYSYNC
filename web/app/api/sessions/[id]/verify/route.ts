import { databaseErrorResponse, getServiceDatabase, getServiceIdentity } from "../../../../../db";
import { resolveNames, type VerificationCandidate } from "../../../../../services/name-resolution";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await context.params;
    if (!UUID.test(sessionId)) return Response.json({ error: "Invalid session" }, { status: 400 });
    const database = getServiceDatabase();
    const { organizationId, operatorUserId } = getServiceIdentity();
    const { data: contacts, error: readError } = await database
      .from("contacts").select("id,phone_e164,network,name_on_file")
      .eq("session_id", sessionId).eq("organization_id", organizationId)
      .eq("verification_status", "pending").order("created_at").limit(5000);
    if (readError) throw readError;

    const candidates: VerificationCandidate[] = (contacts ?? []).map((contact) => ({
      id: contact.id, phone: contact.phone_e164, network: contact.network, nameOnFile: contact.name_on_file,
    }));
    if (!candidates.length) return Response.json({ verified: 0, matched: 0, mismatched: 0, mode: "sandbox" });
    const results = await resolveNames(candidates, 5);

    for (let offset = 0; offset < results.length; offset += 10) {
      const updates = await Promise.all(results.slice(offset, offset + 10).map((result) => database
        .from("contacts").update({
          registered_name: result.registeredName,
          verification_status: result.namesMatch ? "verified" : "mismatch",
          verified_at: new Date().toISOString(),
        }).eq("id", result.id).eq("session_id", sessionId).eq("organization_id", organizationId).eq("verification_status", "pending")));
      const failed = updates.find((update) => update.error);
      if (failed?.error) throw failed.error;
    }

    const matched = results.filter((result) => result.namesMatch).length;
    const { error: auditError } = await database.from("audit_records").insert({
      organization_id: organizationId, actor_user_id: operatorUserId,
      action: "verification.completed", entity_type: "payment_session", entity_id: sessionId,
      details: { mode: "sandbox", verified: results.length, matched, mismatched: results.length - matched },
    });
    if (auditError) throw auditError;
    const { error: sessionError } = await database.from("payment_sessions")
      .update({ status: "ready" }).eq("id", sessionId).eq("organization_id", organizationId);
    if (sessionError) throw sessionError;
    return Response.json({ verified: results.length, matched, mismatched: results.length - matched, mode: "sandbox" });
  } catch (error) {
    return databaseErrorResponse(error, "Verification failed");
  }
}
