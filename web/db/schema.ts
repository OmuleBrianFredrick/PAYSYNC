import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const paymentSessions = sqliteTable("payment_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").notNull().unique(),
  name: text("name").notNull(),
  source: text("source", { enum: ["manual", "csv"] }).notNull(),
  status: text("status", { enum: ["active", "completed", "cancelled", "paused"] }).notNull().default("active"),
  batchSize: integer("batch_size").notNull().default(10),
  totalContacts: integer("total_contacts").notNull(),
  totalAmount: real("total_amount").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_payment_sessions_status_created").on(table.status, table.createdAt)]);

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => paymentSessions.id, { onDelete: "cascade" }),
  nameOnFile: text("name_on_file").notNull(),
  phone: text("phone").notNull(),
  network: text("network", { enum: ["MTN", "Airtel"] }).notNull(),
  amount: real("amount").notNull(),
  registeredName: text("registered_name"),
  namesMatch: integer("names_match", { mode: "boolean" }),
  paymentStatus: text("payment_status", { enum: ["pending", "locked", "processing", "paid", "failed", "skipped"] }).notNull().default("pending"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_contacts_session_phone").on(table.sessionId, table.phone),
  index("idx_contacts_payable").on(table.sessionId, table.paymentStatus, table.namesMatch),
]);

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").references(() => paymentSessions.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_session_created").on(table.sessionId, table.createdAt)]);
