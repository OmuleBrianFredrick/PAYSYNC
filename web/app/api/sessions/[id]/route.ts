import { databaseErrorResponse, getServiceDatabase, getServiceIdentity } from "../../../../db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) return Response.json({ error: "Invalid session" }, { status: 400 });
    const database = getServiceDatabase();
    const { organizationId } = getServiceIdentity();
    const { data: session, error: sessionError } = await database
      .from("payment_sessions")
      .select("id,reference,name,source,status,batch_size,total_contacts,total_amount_minor,created_at")
      .eq("id", id).eq("organization_id", organizationId).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return Response.json({ error: "Payment run not found" }, { status: 404 });

    const [contactsResult, auditResult] = await Promise.all([
      database.from("contacts")
        .select("id,name_on_file,phone_e164,network,amount_minor,registered_name,verification_status")
        .eq("session_id", id).eq("organization_id", organizationId).order("created_at"),
      database.from("audit_records")
        .select("id,action,details,created_at")
        .eq("entity_id", id).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(30),
    ]);
    if (contactsResult.error) throw contactsResult.error;
    if (auditResult.error) throw auditResult.error;

    return Response.json({
      session: {
        id: session.id, reference: session.reference, name: session.name, source: session.source, status: session.status,
        batchSize: session.batch_size, totalContacts: session.total_contacts,
        totalAmount: Number(session.total_amount_minor), createdAt: session.created_at,
      },
      contacts: (contactsResult.data ?? []).map((contact) => ({
        id: contact.id, nameOnFile: contact.name_on_file, phone: contact.phone_e164,
        network: contact.network, amount: Number(contact.amount_minor), registeredName: contact.registered_name,
        namesMatch: ["verified", "overridden"].includes(contact.verification_status) ? 1 : contact.verification_status === "mismatch" ? 0 : null,
        paymentStatus: contact.verification_status === "failed" ? "skipped" : "pending",
      })),
      audit: (auditResult.data ?? []).map((record) => ({ id: record.id, action: record.action, details: record.details, createdAt: record.created_at })),
      verificationMode: "sandbox",
    });
  } catch (error) {
    return databaseErrorResponse(error, "Unable to load payment run");
  }
}
