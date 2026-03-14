"use client";

import { useState } from "react";
import Link from "next/link";
import { SUBMITTALS } from "../lib/mockData";
import { DollarSign, Building2, User, Calendar, FileText, CheckCircle2, XCircle, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

const THRESHOLD = 100000;

function fmtDollars(n) {
  return "$" + n.toLocaleString();
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ApprovalCard({ submittal }) {
  const [decision, setDecision] = useState(submittal.humanApprovalStatus); // "pending" | "approved" | "rejected"
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState(submittal.humanApprovalNote ?? "");
  const [submitted, setSubmitted] = useState(decision !== "pending");

  const s = submittal;

  function handleDecision(d) {
    setDecision(d);
    setShowComment(true);
  }

  function handleSubmit() {
    setSubmitted(true);
    setShowComment(false);
  }

  const isOver = s.dollarAmount >= THRESHOLD;

  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
      overflow: "hidden",
      opacity: submitted && decision !== "pending" ? 0.75 : 1,
    }}>
      {/* Top bar — dollar amount highlight */}
      <div style={{
        background: submitted
          ? decision === "approved" ? "#f0fdf4" : "#fef2f2"
          : "#fffbeb",
        borderBottom: `1px solid ${submitted
          ? decision === "approved" ? "#bbf7d0" : "#fecaca"
          : "#fde68a"}`,
        padding: "12px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DollarSign size={15} color={submitted ? (decision === "approved" ? "#15803d" : "#dc2626") : "#d97706"} />
          <span style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            {fmtDollars(s.dollarAmount)}
          </span>
          {isOver && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
              background: "#fef3c7", color: "#92400e", letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              Over ${(THRESHOLD / 1000).toFixed(0)}k threshold
            </span>
          )}
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
          background: submitted
            ? decision === "approved" ? "#dcfce7" : "#fee2e2"
            : "#dbeafe",
          color: submitted
            ? decision === "approved" ? "#15803d" : "#991b1b"
            : "#1e40af",
        }}>
          {submitted
            ? decision === "approved"
              ? <><CheckCircle2 size={12} /> Approved</>
              : <><XCircle size={12} /> Rejected</>
            : "Pending Approval"
          }
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: "20px 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 4, letterSpacing: "-0.01em" }}>
            {s.submittalTitle}
          </h2>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{s.specSection} · {s.id}</div>
        </div>

        {/* Meta grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
          {[
            { icon: Building2, label: "Project", value: s.projectName },
            { icon: User, label: "Subcontractor", value: `${s.subcontractor.name} · ${s.subcontractor.contact}` },
            { icon: Calendar, label: "Submitted", value: fmtDate(s.submittedAt) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                <Icon size={11} /> {label}
              </div>
              <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Agent intake summary */}
        {s.agentTrail.length > 0 && (
          <div style={{
            background: "#f0f9ff", border: "1px solid #bae6fd",
            borderRadius: 8, padding: "12px 14px", marginBottom: 20,
            display: "flex", gap: 10,
          }}>
            <FileText size={14} color="#0369a1" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Agent Intake Summary
              </div>
              <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.5 }}>
                {s.agentTrail[0].summary}
              </div>
            </div>
          </div>
        )}

        {/* Approval note if already decided */}
        {submitted && comment && (
          <div style={{
            background: "#f8fafc", border: "1px solid #e2e8f0",
            borderRadius: 8, padding: "12px 14px", marginBottom: 16,
            display: "flex", gap: 10,
          }}>
            <MessageSquare size={14} color="#64748b" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Manager Note
              </div>
              <div style={{ fontSize: 13, color: "#1e293b" }}>{comment}</div>
            </div>
          </div>
        )}

        {/* Action buttons — show when pending and not yet decided */}
        {!submitted && decision === "pending" && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => handleDecision("approved")}
              style={{
                flex: 1, padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                background: "#0f172a", color: "#fff", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <CheckCircle2 size={15} /> Approve
            </button>
            <button
              onClick={() => handleDecision("rejected")}
              style={{
                flex: 1, padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                background: "#fee2e2", color: "#dc2626", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <XCircle size={15} /> Reject
            </button>
            <Link
              href={`/submittals/${s.id}`}
              style={{
                padding: "11px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: "#f1f5f9", color: "#475569", textDecoration: "none",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <FileText size={14} /> View Details
            </Link>
          </div>
        )}

        {/* Comment box — shown after clicking approve/reject but before submitting */}
        {!submitted && showComment && (
          <div style={{ marginTop: 14 }}>
            <div style={{
              padding: "12px 14px", borderRadius: 8,
              background: decision === "approved" ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${decision === "approved" ? "#bbf7d0" : "#fecaca"}`,
              marginBottom: 10,
              fontSize: 13, fontWeight: 600,
              color: decision === "approved" ? "#15803d" : "#dc2626",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {decision === "approved" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              Marked as {decision === "approved" ? "Approved" : "Rejected"} — add an optional note below
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a note for the record (optional)…"
              style={{
                width: "100%", padding: "10px 14px",
                border: "1px solid #e2e8f0", borderRadius: 8,
                fontSize: 13, color: "#0f172a", background: "#fff",
                resize: "none", outline: "none", lineHeight: 1.5,
                minHeight: 72, fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={handleSubmit}
                style={{
                  padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: "#0f172a", color: "#fff", border: "none", cursor: "pointer",
                }}
              >
                Confirm Decision
              </button>
              <button
                onClick={() => { setDecision("pending"); setShowComment(false); }}
                style={{
                  padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Undo if submitted */}
        {submitted && (
          <button
            onClick={() => { setDecision("pending"); setSubmitted(false); setShowComment(false); }}
            style={{
              marginTop: 4, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: "transparent", color: "#94a3b8", border: "1px solid #e2e8f0", cursor: "pointer",
            }}
          >
            Undo decision
          </button>
        )}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const pending = SUBMITTALS.filter(s => s.requiresHumanApproval && s.humanApprovalStatus === "pending");
  const decided = SUBMITTALS.filter(s => s.requiresHumanApproval && s.humanApprovalStatus !== "pending");
  const totalValue = pending.reduce((sum, s) => sum + s.dollarAmount, 0);

  return (
    <div style={{ padding: "40px 48px", maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
          Approvals
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
          Submittals over {fmtDollars(THRESHOLD)} require manager sign-off before agent processing
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Pending Review", value: pending.length },
          { label: "Total Value Pending", value: fmtDollars(totalValue) },
          { label: "Decided This Week", value: decided.length },
          { label: "Approval Threshold", value: fmtDollars(THRESHOLD) },
        ].map(({ label, value }) => (
          <div key={label} style={{
            flex: 1, background: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 10, padding: "16px 20px",
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{value}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Pending cards */}
      {pending.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Awaiting Decision — {pending.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
            {pending.map(s => <ApprovalCard key={s.id} submittal={s} />)}
          </div>
        </>
      )}

      {/* Decided cards */}
      {decided.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Previously Decided — {decided.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {decided.map(s => <ApprovalCard key={s.id} submittal={s} />)}
          </div>
        </>
      )}

      {pending.length === 0 && decided.length === 0 && (
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
          padding: "60px 24px", textAlign: "center", color: "#94a3b8",
        }}>
          <CheckCircle2 size={32} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>No pending approvals</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>All high-value submittals have been reviewed.</div>
        </div>
      )}
    </div>
  );
}
