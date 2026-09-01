"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
type Contact = {
  id: number;
  nameOnFile: string;
  phone: string;
  network: "MTN" | "Airtel";
  amount: number;
  registeredName: string | null;
  namesMatch: number | null;
  paymentStatus: string;
};
type RunData = {
  session: {
    id: number;
    reference: string;
    name: string;
    batchSize: number;
    totalContacts: number;
    totalAmount: number;
    status: string;
  };
  contacts: Contact[];
  audit: { id: number; action: string; createdAt: string }[];
  verificationMode: string;
};
type VerificationResponse = {
  error?: string;
  verified: number;
  matched: number;
  mismatched: number;
};
type ReviewResponse = { error?: string; ok?: boolean };
const money = new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 });
export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<RunData | null>(null),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/sessions/${id}`);
      const j = (await r.json()) as RunData & { error?: string };
      if (!r.ok) throw new Error(j.error);
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payment run");
    }
  }, [id]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/${id}`)
      .then(async (response) => {
        const payload = (await response.json()) as RunData & { error?: string };
        if (!response.ok) throw new Error(payload.error);
        if (!cancelled) setData(payload);
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load payment run",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  const counts = useMemo(
    () => ({
      pending:
        data?.contacts.filter(
          (c) => !c.registeredName && c.paymentStatus === "pending",
        ).length ?? 0,
      matched:
        data?.contacts.filter(
          (c) => c.namesMatch === 1 && c.paymentStatus === "pending",
        ).length ?? 0,
      review:
        data?.contacts.filter(
          (c) => c.namesMatch === 0 && c.paymentStatus === "pending",
        ).length ?? 0,
      skipped:
        data?.contacts.filter((c) => c.paymentStatus === "skipped").length ?? 0,
    }),
    [data],
  );
  const verify = async () => {
    setWorking(true);
    setError("");
    try {
      const r = await fetch(`/api/sessions/${id}/verify`, { method: "POST" });
      const j = (await r.json()) as VerificationResponse;
      if (!r.ok) throw new Error(j.error);
      setNotice(
        `${j.verified} checked · ${j.matched} matched · ${j.mismatched} require review`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setWorking(false);
    }
  };
  const review = async (contactId: number, action: "approve" | "skip") => {
    setWorking(true);
    try {
      const r = await fetch(
        `/api/sessions/${id}/contacts/${contactId}/review`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const j = (await r.json()) as ReviewResponse;
      if (!r.ok) throw new Error(j.error);
      setNotice(
        action === "approve"
          ? "Mismatch approved and recorded in the audit trail."
          : "Recipient skipped and removed from the payable pool.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setWorking(false);
    }
  };
  if (error && !data)
    return (
      <main className="run-page">
        <div className="error-state">
          <h1>Unable to open payment run</h1>
          <p>{error}</p>
          <Link href="/">Return to dashboard</Link>
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="run-page">
        <div className="loading-state">Opening verified payment run…</div>
      </main>
    );
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
      <section className="session-wrap">
        <div className="session-title">
          <div>
            <p className="eyebrow">
              {data.session.reference} · {data.session.status.toUpperCase()}
            </p>
            <h1>{data.session.name}</h1>
            <p>
              {data.session.totalContacts} recipients · UGX{" "}
              {money.format(data.session.totalAmount)} · batches of{" "}
              {data.session.batchSize}
            </p>
          </div>
          <div className="sandbox-badge">
            <i /> SANDBOX NAME LOOKUP
          </div>
        </div>
        <div className="verify-stats">
          <article>
            <strong>{counts.pending}</strong>
            <span>Awaiting lookup</span>
          </article>
          <article>
            <strong>{counts.matched}</strong>
            <span>Name matched</span>
          </article>
          <article>
            <strong>{counts.review}</strong>
            <span>Needs review</span>
          </article>
          <article>
            <strong>{counts.skipped}</strong>
            <span>Skipped</span>
          </article>
        </div>
        <section className="panel verify-panel">
          <div className="verify-toolbar">
            <div>
              <h2>Recipient verification</h2>
              <p>
                Exact registered-name comparison. Mismatches can only proceed
                after explicit human approval.
              </p>
            </div>
            <button
              className="primary"
              disabled={working || counts.pending === 0}
              onClick={verify}
            >
              {working
                ? "Checking…"
                : counts.pending
                  ? `Verify ${counts.pending} recipients`
                  : "Verification complete"}
            </button>
          </div>
          {notice && <div className="inline-notice">✓ {notice}</div>}
          {error && <p className="form-error">{error}</p>}
          <div className="verify-head">
            <span>Recipient</span>
            <span>Network</span>
            <span>Registered identity</span>
            <span>Status</span>
            <span>Amount</span>
          </div>
          {data.contacts.map((c) => (
            <div className="verify-row" key={c.id}>
              <div>
                <strong>{c.nameOnFile}</strong>
                <small>{c.phone}</small>
              </div>
              <span className={`network ${c.network.toLowerCase()}`}>
                {c.network}
              </span>
              <div>
                <strong>{c.registeredName ?? "Not checked"}</strong>
                <small>
                  {c.registeredName
                    ? "Returned by sandbox adapter"
                    : "Waiting for lookup"}
                </small>
              </div>
              <div>
                {c.paymentStatus === "skipped" ? (
                  <span className="status skipped">Skipped</span>
                ) : c.namesMatch === 1 ? (
                  <span className="status matched">✓ Matched</span>
                ) : c.namesMatch === 0 ? (
                  <div className="review-actions">
                    <span className="status mismatch">Mismatch</span>
                    <button
                      disabled={working}
                      onClick={() => review(c.id, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      disabled={working}
                      onClick={() => review(c.id, "skip")}
                    >
                      Skip
                    </button>
                  </div>
                ) : (
                  <span className="status pending">Pending</span>
                )}
              </div>
              <strong className="amount">{money.format(c.amount)}</strong>
            </div>
          ))}
        </section>
        <aside className="audit-strip">
          <p className="eyebrow">RECENT AUDIT EVENTS</p>
          {data.audit.slice(0, 4).map((a) => (
            <div key={a.id}>
              <span>✓</span>
              <strong>{a.action.replaceAll(".", " ")}</strong>
              <small>{new Date(a.createdAt + "Z").toLocaleString()}</small>
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
}
