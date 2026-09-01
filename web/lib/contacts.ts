export type ContactInput = { name?: unknown; phone?: unknown; amount?: unknown };
export type ValidContact = { name: string; phone: string; network: "MTN" | "Airtel"; amount: number };
export type InvalidContact = { row: number; name: string; phone: string; reason: string };

const MTN_PREFIXES = new Set(["76", "77", "78", "79"]);
const AIRTEL_PREFIXES = new Set(["70", "74", "75"]);

export function normalizeUgandanPhone(value: unknown): string | null {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00256")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = `256${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("7")) digits = `256${digits}`;
  return /^2567\d{8}$/.test(digits) ? `+${digits}` : null;
}

export function detectNetwork(phone: string): "MTN" | "Airtel" | null {
  const prefix = phone.slice(4, 6);
  if (MTN_PREFIXES.has(prefix)) return "MTN";
  if (AIRTEL_PREFIXES.has(prefix)) return "Airtel";
  return null;
}

export function validateContacts(rows: ContactInput[]) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Add at least one recipient.");
  if (rows.length > 5000) throw new Error("A payment run cannot exceed 5,000 recipients.");
  const seen = new Set<string>();
  const accepted: ValidContact[] = [];
  const rejected: InvalidContact[] = [];
  rows.forEach((row, index) => {
    const name = String(row.name ?? "").trim().replace(/\s+/g, " ");
    const rawPhone = String(row.phone ?? "").trim();
    const phone = normalizeUgandanPhone(rawPhone);
    const amount = Number(String(row.amount ?? "").replace(/[,\s]/g, ""));
    let reason = "";
    if (!name) reason = "Recipient name is required";
    else if (!phone) reason = "Enter a valid Ugandan mobile number";
    else if (!detectNetwork(phone)) reason = "The number is not on a supported MTN or Airtel prefix";
    else if (!Number.isSafeInteger(amount) || amount <= 0) reason = "Amount must be a whole number greater than zero";
    else if (seen.has(phone)) reason = "Duplicate phone number in this submission";
    if (reason) rejected.push({ row: index + 1, name, phone: rawPhone, reason });
    else { seen.add(phone!); accepted.push({ name, phone: phone!, network: detectNetwork(phone!)!, amount }); }
  });
  return { accepted, rejected };
}
