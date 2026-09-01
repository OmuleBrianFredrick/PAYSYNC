"use client";

import { useState } from "react";

type Contact = {
  id: number;
  initials: string;
  name: string;
  phone: string;
  network: "MTN" | "Airtel";
  registered: string;
  amount: number;
  state: "verified" | "review" | "paid";
};

const initialContacts: Contact[] = [
  {
    id: 1,
    initials: "AN",
    name: "Amina Nansubuga",
    phone: "+256 772 614 208",
    network: "MTN",
    registered: "AMINA NANSUBUGA",
    amount: 420000,
    state: "verified",
  },
  {
    id: 2,
    initials: "JO",
    name: "Joel Okello",
    phone: "+256 752 038 911",
    network: "Airtel",
    registered: "JOEL OKELLO",
    amount: 315000,
    state: "verified",
  },
  {
    id: 3,
    initials: "MK",
    name: "Mariam Kato",
    phone: "+256 783 226 047",
    network: "MTN",
    registered: "MARIAM N. KATO",
    amount: 285000,
    state: "review",
  },
  {
    id: 4,
    initials: "SB",
    name: "Simon Byaruhanga",
    phone: "+256 701 844 392",
    network: "Airtel",
    registered: "SIMON BYARUHANGA",
    amount: 510000,
    state: "verified",
  },
  {
    id: 5,
    initials: "FN",
    name: "Fatuma Namuli",
    phone: "+256 778 409 126",
    network: "MTN",
    registered: "FATUMA NAMULI",
    amount: 375000,
    state: "verified",
  },
];

const money = new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 });

export default function Home() {
  const [section, setSection] = useState("Overview");
  const [contacts, setContacts] = useState(initialContacts);
  const [notice, setNotice] = useState(
    "4 recipients are verified and ready for the next confirmed batch.",
  );
  const [modal, setModal] = useState(false);
  const ready = contacts.filter((c) => c.state === "verified");
  const resolve = (id: number, state: "verified" | "paid") => {
    setContacts((all) => all.map((c) => (c.id === id ? { ...c, state } : c)));
    setNotice(
      state === "verified"
        ? "Mismatch approved after human review. The audit trail has been updated."
        : notice,
    );
  };

  const confirmBatch = () => {
    const ids = new Set(ready.slice(0, 4).map((c) => c.id));
    setContacts((all) =>
      all.map((c) => (ids.has(c.id) ? { ...c, state: "paid" } : c)),
    );
    setModal(false);
    setNotice(
      "Batch PS-1048 was confirmed. 4 payments are now processing with network reconciliation enabled.",
    );
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <strong>PaySync</strong>
            <small>Verified disbursements</small>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          {["Overview", "Payment runs", "Recipients", "Audit trail"].map(
            (item) => (
              <button
                key={item}
                className={section === item ? "active" : ""}
                onClick={() => setSection(item)}
              >
                <span>
                  {item === "Overview"
                    ? "⌂"
                    : item === "Payment runs"
                      ? "↗"
                      : item === "Recipients"
                        ? "◎"
                        : "≡"}
                </span>
                {item}
              </button>
            ),
          )}
        </nav>
        <div className="workspace">
          <small>WORKSPACE</small>
          <strong>Asinga Technologies</strong>
          <span>Production controls</span>
        </div>
        <div className="operator">
          <div className="avatar">BN</div>
          <div>
            <strong>Brian N.</strong>
            <small>Administrator</small>
          </div>
          <button aria-label="Open account menu">•••</button>
        </div>
      </aside>

      <section className="content">
        <header>
          <div>
            <p className="eyebrow">TUESDAY, 01 SEPTEMBER</p>
            <h1>{section}</h1>
          </div>
          <div className="header-actions">
            <button className="icon-button" aria-label="Notifications">
              ●<span className="ping" />
            </button>
            <button
              className="primary"
              onClick={() => {
                window.location.href = "/new-run";
              }}
            >
              ＋ New payment run
            </button>
          </div>
        </header>

        <div className="trust-bar">
          <span className="seal">✓</span>
          <p>
            <strong>Every recipient verified before funds move.</strong>
            <br />
            Name matching, human review and confirmed batches are enforced.
          </p>
          <span className="live">
            <i /> SYSTEM HEALTHY
          </span>
        </div>

        <section className="metrics" aria-label="Payment summary">
          <article>
            <p>Disbursed this month</p>
            <strong>UGX 48.2M</strong>
            <span className="positive">
              ↗ 12.4% <em>from August</em>
            </span>
          </article>
          <article>
            <p>Recipients paid</p>
            <strong>1,284</strong>
            <span>
              <b>98.7%</b> success rate
            </span>
          </article>
          <article>
            <p>Awaiting review</p>
            <strong>
              {contacts.filter((c) => c.state === "review").length}
            </strong>
            <span className="warning">Requires attention</span>
          </article>
          <article>
            <p>Active payment runs</p>
            <strong>3</strong>
            <span>Next batch ready</span>
          </article>
        </section>

        <div className="grid">
          <section className="panel activity-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">LIVE WORKFLOW</p>
                <h2>Current payment run</h2>
              </div>
              <span className="run-id">PS-1048</span>
            </div>
            <div className="run-summary">
              <div>
                <small>Field Agent Payouts · September</small>
                <strong>
                  UGX{" "}
                  {money.format(
                    ready.reduce((s, c) => s + c.amount, 0) +
                      contacts
                        .filter((c) => c.state === "paid")
                        .reduce((s, c) => s + c.amount, 0),
                  )}
                </strong>
              </div>
              <div className="progress-wrap">
                <span>
                  <b>{contacts.filter((c) => c.state === "paid").length}</b> of{" "}
                  {contacts.length} paid
                </span>
                <div className="progress">
                  <i
                    style={{
                      width: `${(contacts.filter((c) => c.state === "paid").length / contacts.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="table-head">
              <span>Recipient</span>
              <span>Network</span>
              <span>Verification</span>
              <span>Amount</span>
            </div>
            <div className="contact-list">
              {contacts.map((c) => (
                <div className="contact" key={c.id}>
                  <div className="person">
                    <span className="mini-avatar">{c.initials}</span>
                    <div>
                      <strong>{c.name}</strong>
                      <small>{c.phone}</small>
                    </div>
                  </div>
                  <span className={`network ${c.network.toLowerCase()}`}>
                    {c.network}
                  </span>
                  <div>
                    {c.state === "review" ? (
                      <button
                        className="review"
                        onClick={() => resolve(c.id, "verified")}
                      >
                        Review mismatch
                      </button>
                    ) : c.state === "paid" ? (
                      <span className="paid">✓ Paid</span>
                    ) : (
                      <span className="verified">✓ Name matched</span>
                    )}
                    <small className="registered">{c.registered}</small>
                  </div>
                  <strong className="amount">{money.format(c.amount)}</strong>
                </div>
              ))}
            </div>
            <div className="panel-footer">
              <p>{notice}</p>
              <button
                className="primary"
                disabled={!ready.length}
                onClick={() => setModal(true)}
              >
                Review next batch <span>→</span>
              </button>
            </div>
          </section>

          <aside className="right-column">
            <section className="panel batch-card">
              <p className="eyebrow">NEXT CONFIRMED BATCH</p>
              <div className="batch-number">
                {String(Math.min(ready.length, 4)).padStart(2, "0")}
                <small>recipients</small>
              </div>
              <div className="batch-total">
                <span>Total value</span>
                <strong>
                  UGX{" "}
                  {money.format(
                    ready.slice(0, 4).reduce((s, c) => s + c.amount, 0),
                  )}
                </strong>
              </div>
              <p className="safety">
                No payment is sent until you review and explicitly confirm this
                batch.
              </p>
              <button
                className="primary full"
                disabled={!ready.length}
                onClick={() => setModal(true)}
              >
                Open batch review
              </button>
            </section>
            <section className="panel network-card">
              <div className="panel-heading">
                <h2>Network distribution</h2>
                <button>30 days⌄</button>
              </div>
              <div className="donut">
                <div>
                  <strong>1,284</strong>
                  <small>payments</small>
                </div>
              </div>
              <div className="legend">
                <p>
                  <i className="mtn-dot" />
                  <span>
                    MTN Mobile Money<small>742 payments</small>
                  </span>
                  <strong>58%</strong>
                </p>
                <p>
                  <i className="airtel-dot" />
                  <span>
                    Airtel Money<small>542 payments</small>
                  </span>
                  <strong>42%</strong>
                </p>
              </div>
            </section>
          </aside>
        </div>
      </section>

      {modal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-title"
        >
          <div className="modal">
            <button
              className="close"
              onClick={() => setModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <span className="seal large">✓</span>
            <p className="eyebrow">HUMAN CONFIRMATION REQUIRED</p>
            <h2 id="batch-title">Confirm payment batch</h2>
            <p>
              You are about to send{" "}
              <strong>
                UGX{" "}
                {money.format(
                  ready.slice(0, 4).reduce((s, c) => s + c.amount, 0),
                )}
              </strong>{" "}
              to {Math.min(ready.length, 4)} verified recipients. This action
              will be recorded in the audit trail.
            </p>
            <div className="modal-check">
              <span>✓</span>
              <div>
                <strong>Identity gate passed</strong>
                <small>
                  Every recipient in this batch has an approved registered-name
                  match.
                </small>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setModal(false)}>Cancel</button>
              <button
                className="primary"
                onClick={confirmBatch}
                disabled={!ready.length}
              >
                Confirm & send batch
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
