import { databaseErrorResponse, getServiceDatabase, getServiceIdentity } from "../../../db";
import { validateContacts, type ContactInput } from "../../../lib/contacts";

function sessionResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    source: row.source,
    status: row.status,
    batchSize: row.batch_size,
    totalContacts: row.total_contacts,
    totalAmount: Number(row.total_amount_minor),
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const database = getServiceDatabase();
    const { organizationId } = getServiceIdentity();
    const { data, error } = await database
      .from("payment_sessions")
      .select("id,reference,name,source,status,batch_size,total_contacts,total_amount_minor,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return Response.json({ sessions: (data ?? []).map((row) => sessionResponse(row)) });
  } catch (error) {
    return databaseErrorResponse(error, "Unable to load payment runs");
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { name?: string; source?: "manual" | "csv"; batchSize?: number; contacts?: ContactInput[] };
    const name = payload.name?.trim() ?? "";
    if (name.length < 3) return Response.json({ error: "Give this payment run a descriptive name." }, { status: 400 });
    const batchSize = Math.min(500, Math.max(1, Math.floor(Number(payload.batchSize) || 10)));
    const report = validateContacts(payload.contacts ?? []);
    if (!report.accepted.length) return Response.json({ error: "No valid recipients were found.", report }, { status: 400 });

    const database = getServiceDatabase();
    const { organizationId, operatorUserId } = getServiceIdentity();
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || crypto.randomUUID();
    const contactRows = report.accepted.map((contact) => ({
      name: contact.name,
      phone_e164: contact.phone,
      network: contact.network,
      amount_minor: contact.amount,
    }));
    const { data: sessionId, error: createError } = await database.rpc("create_payment_session_as_service", {
      target_organization_id: organizationId,
      actor_user_id: operatorUserId,
      request_idempotency_key: idempotencyKey,
      session_name: name,
      session_source: payload.source === "csv" ? "csv" : "manual",
      requested_batch_size: batchSize,
      contact_rows: contactRows,
    });
    if (createError) throw createError;

    const { data: created, error: readError } = await database
      .from("payment_sessions")
      .select("id,reference,name,source,status,batch_size,total_contacts,total_amount_minor,created_at")
      .eq("id", sessionId)
      .eq("organization_id", organizationId)
      .single();
    if (readError) throw readError;
    return Response.json({ session: sessionResponse(created), report }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("5,000")) {
      return Response.json({ error: error.message }, { status: 413 });
    }
    return databaseErrorResponse(error, "Unable to create payment run");
  }
}
