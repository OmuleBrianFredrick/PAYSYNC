import { env } from "cloudflare:workers";
import { validateContacts, type ContactInput } from "../../../lib/contacts";

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS payment_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL UNIQUE, name TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('manual','csv')), status TEXT NOT NULL DEFAULT 'active', batch_size INTEGER NOT NULL DEFAULT 10, total_contacts INTEGER NOT NULL, total_amount REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES payment_sessions(id) ON DELETE CASCADE, name_on_file TEXT NOT NULL, phone TEXT NOT NULL, network TEXT NOT NULL CHECK(network IN ('MTN','Airtel')), amount REAL NOT NULL, registered_name TEXT, names_match INTEGER, payment_status TEXT NOT NULL DEFAULT 'pending', retry_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(session_id, phone))"),
    db.prepare("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER REFERENCES payment_sessions(id) ON DELETE SET NULL, action TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_payment_sessions_status_created ON payment_sessions(status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_contacts_payable ON contacts(session_id, payment_status, names_match)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_audit_session_created ON audit_log(session_id, created_at)"),
  ]);
}

export async function GET() {
  try {
    await ensureSchema(env.DB);
    const result = await env.DB.prepare("SELECT id, reference, name, source, status, batch_size AS batchSize, total_contacts AS totalContacts, total_amount AS totalAmount, created_at AS createdAt FROM payment_sessions ORDER BY id DESC LIMIT 25").all();
    return Response.json({ sessions: result.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load payment runs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { name?: string; source?: "manual" | "csv"; batchSize?: number; contacts?: ContactInput[] };
    const name = payload.name?.trim() ?? "";
    if (name.length < 3) return Response.json({ error: "Give this payment run a descriptive name." }, { status: 400 });
    const batchSize = Math.min(50, Math.max(1, Math.floor(Number(payload.batchSize) || 10)));
    const report = validateContacts(payload.contacts ?? []);
    if (!report.accepted.length) return Response.json({ error: "No valid recipients were found.", report }, { status: 400 });
    await ensureSchema(env.DB);
    const reference = `PS-${String(Date.now()).slice(-6)}`;
    const totalAmount = report.accepted.reduce((sum, contact) => sum + contact.amount, 0);
    const sessionResult = await env.DB.prepare("INSERT INTO payment_sessions (reference, name, source, batch_size, total_contacts, total_amount) VALUES (?, ?, ?, ?, ?, ?) RETURNING id").bind(reference, name, payload.source === "csv" ? "csv" : "manual", batchSize, report.accepted.length, totalAmount).first<{ id: number }>();
    if (!sessionResult) throw new Error("The payment run could not be created.");
    const statements = report.accepted.map((contact) => env.DB.prepare("INSERT INTO contacts (session_id, name_on_file, phone, network, amount) VALUES (?, ?, ?, ?, ?)").bind(sessionResult.id, contact.name, contact.phone, contact.network, contact.amount));
    for (let i = 0; i < statements.length; i += 100) await env.DB.batch(statements.slice(i, i + 100));
    await env.DB.prepare("INSERT INTO audit_log (session_id, action, details) VALUES (?, 'session.created', ?)").bind(sessionResult.id, JSON.stringify({ reference, accepted: report.accepted.length, rejected: report.rejected.length, source: payload.source ?? "manual" })).run();
    return Response.json({ session: { id: sessionResult.id, reference, name, totalContacts: report.accepted.length, totalAmount, status: "active" }, report }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment run";
    return Response.json({ error: message }, { status: message.includes("5,000") ? 413 : 400 });
  }
}
