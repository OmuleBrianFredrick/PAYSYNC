"use client";

import Link from "next/link";
import { useState } from "react";

type Row = { name: string; phone: string; amount: string };
type CreateRunResponse = {
  error?: string;
  session: { id: number; reference: string };
  report: { accepted: unknown[]; rejected: unknown[] };
};
const blank = (): Row => ({ name: "", phone: "", amount: "" });

function parseCsv(text: string): Row[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (!lines.length) return [];
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cell = "",
      quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = !quoted;
      else if (c === "," && !quoted) {
        out.push(cell.trim());
        cell = "";
      } else cell += c;
    }
    out.push(cell.trim());
    return out;
  };
  const headers = parseLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z]/g, ""),
  );
  const find = (...names: string[]) =>
    headers.findIndex((h) => names.includes(h));
  const nameIndex = find("name", "recipient", "recipientname", "fullname");
  const phoneIndex = find("phone", "phonenumber", "mobile", "msisdn", "number");
  const amountIndex = find("amount", "value", "payment", "paymentamount");
  if ([nameIndex, phoneIndex, amountIndex].some((i) => i < 0))
    throw new Error("CSV headers must include name, phone and amount columns.");
  return lines
    .slice(1)
    .map(parseLine)
    .map((cells) => ({
      name: cells[nameIndex] ?? "",
      phone: cells[phoneIndex] ?? "",
      amount: cells[amountIndex] ?? "",
    }));
}

export default function NewRun() {
  const [mode, setMode] = useState<"manual" | "csv">("manual");
  const [name, setName] = useState("September field agent payouts");
  const [batchSize, setBatchSize] = useState(10);
  const [rows, setRows] = useState<Row[]>([blank(), blank(), blank()]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    id: number;
    reference: string;
    accepted: number;
    rejected: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (index: number, field: keyof Row, value: string) =>
    setRows((all) =>
      all.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length > 5000)
        throw new Error("CSV files are limited to 5,000 recipients.");
      setRows(parsed);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not read this CSV file.",
      );
    }
  };
  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, source: mode, batchSize, contacts: rows }),
      });
      const data = (await response.json()) as CreateRunResponse;
      if (!response.ok)
        throw new Error(data.error ?? "Could not create payment run");
      setResult({
        id: data.session.id,
        reference: data.session.reference,
        accepted: data.report.accepted.length,
        rejected: data.report.rejected.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create payment run");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="run-page">
      <header className="run-header">
        <Link href="/">← Back to overview</Link>
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <strong>PaySync</strong>
            <small>Verified disbursements</small>
          </div>
        </div>
      </header>
      <section className="run-builder">
        <div className="builder-title">
          <p className="eyebrow">CORE DATA PIPELINE</p>
          <h1>Create a payment run</h1>
          <p>
            Every recipient is validated, normalized and checked for duplicates
            before entering verification.
          </p>
        </div>
        {result ? (
          <div className="success-card">
            <span className="seal large">✓</span>
            <p className="eyebrow">PAYMENT RUN CREATED</p>
            <h2>{result.reference}</h2>
            <p>
              {result.accepted} recipients were accepted and {result.rejected}{" "}
              rejected rows were safely excluded.
            </p>
              <a className="primary" href={`/sessions/${result.id}`}>
                Start name verification →
            </a>
          </div>
        ) : (
          <div className="builder-grid">
            <section className="panel form-panel">
              <label>
                Payment run name
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Confirmed batch size
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                />
              </label>
              <div className="mode-tabs">
                <button
                  className={mode === "manual" ? "active" : ""}
                  onClick={() => setMode("manual")}
                >
                  Manual capture
                </button>
                <button
                  className={mode === "csv" ? "active" : ""}
                  onClick={() => setMode("csv")}
                >
                  Upload CSV
                </button>
              </div>
              {mode === "csv" && (
                <label className="dropzone">
                  Choose a CSV file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => upload(e.target.files?.[0])}
                  />
                  <small>
                    Headers: name, phone, amount · Maximum 5,000 rows
                  </small>
                </label>
              )}
              <div className="entry-head">
                <span>Recipient name</span>
                <span>Phone number</span>
                <span>Amount (UGX)</span>
              </div>
              <div className="entry-rows">
                {rows.slice(0, 100).map((row, i) => (
                  <div className="entry-row" key={i}>
                    <input
                      aria-label={`Recipient ${i + 1} name`}
                      placeholder="e.g. Amina Nansubuga"
                      value={row.name}
                      onChange={(e) => update(i, "name", e.target.value)}
                    />
                    <input
                      aria-label={`Recipient ${i + 1} phone`}
                      placeholder="0772 123 456"
                      value={row.phone}
                      onChange={(e) => update(i, "phone", e.target.value)}
                    />
                    <input
                      aria-label={`Recipient ${i + 1} amount`}
                      inputMode="numeric"
                      placeholder="250,000"
                      value={row.amount}
                      onChange={(e) => update(i, "amount", e.target.value)}
                    />
                    <button
                      aria-label={`Remove recipient ${i + 1}`}
                      onClick={() =>
                        setRows((all) => all.filter((_, x) => x !== i))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {rows.length > 100 && (
                <p className="csv-note">
                  {rows.length} CSV recipients loaded. The first 100 are
                  previewed here.
                </p>
              )}
              {mode === "manual" && (
                <button
                  className="add-row"
                  onClick={() => setRows((all) => [...all, blank()])}
                >
                  ＋ Add recipient
                </button>
              )}
              {error && <p className="form-error">{error}</p>}
              <div className="submit-bar">
                <p>
                  <strong>Safety gate:</strong> Creating this run does not send
                  money. Recipients must still pass name verification.
                </p>
                <button className="primary" disabled={saving} onClick={submit}>
                  {saving ? "Validating…" : "Validate & create run →"}
                </button>
              </div>
            </section>
            <aside className="panel pipeline-card">
              <p className="eyebrow">WHAT HAPPENS NEXT</p>
              {[
                ["01", "Validate rows", "Required fields and positive amounts"],
                ["02", "Normalize numbers", "Canonical +256 mobile format"],
                ["03", "Detect network", "MTN or Airtel from prefix"],
                ["04", "Remove duplicates", "One recipient number per run"],
                [
                  "05",
                  "Verify identity",
                  "Registered-name lookup before payment",
                ],
              ].map(([n, t, d]) => (
                <div className="pipeline-step" key={n}>
                  <span>{n}</span>
                  <div>
                    <strong>{t}</strong>
                    <small>{d}</small>
                  </div>
                </div>
              ))}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
