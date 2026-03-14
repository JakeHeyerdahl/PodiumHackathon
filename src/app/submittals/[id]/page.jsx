"use client";

import { use } from "react";
import Link from "next/link";
import { SUBMITTALS } from "../../lib/mockData";
import StatusBadge from "../../components/StatusBadge";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertCircle, Clock,
  FileText, User, DollarSign, Calendar, ChevronRight,
} from "lucide-react";

const AGENT_ORDER = ["Intake", "Parser", "Requirements", "Completeness", "Comparison", "Routing", "Executive"];

function fmtDollars(n) {
  return "$" + n.toLocaleString();
}

function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function agentStatusIcon(status) {
  const green = ["accepted", "success", "complete", "compliant", "auto_route_internal_review", "approve_internal_progression", "accepted_with_warnings"];
  const red = ["rejected", "incomplete", "deviation_detected", "return_to_subcontractor"];
  const yellow = ["needs_human_review", "unclear", "human_exception_queue", "escalate_to_human"];

  if (green.includes(status)) return <CheckCircle2 size={18} color="#16a34a" fill="#dcfce7" />;
  if (red.includes(status)) return <XCircle size={18} color="#dc2626" fill="#fee2e2" />;
  if (yellow.includes(status)) return <AlertCircle size={18} color="#d97706" fill="#fef3c7" />;
  return <Clock size={18} color="#94a3b8" />;
}

function MetaItem({ icon: Icon, label, value, accent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <Icon size={12} />
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: accent ?? "#0f172a" }}>{value}</div>
    </div>
  );
}

export default function SubmittalDetailPage({ params }) {
  const { id } = use(params);
  const submittal = SUBMITTALS.find(s => s.id === id);

  if (!submittal) {
    return (
      <div style={{ padding: "40px 48px" }}>
        <p style={{ color: "#94a3b8" }}>Submittal not found.</p>
      </div>
    );
  }

  const s = submittal;
  const agentTrailMap = Object.fromEntries(s.agentTrail.map(a => [a.agent, a]));

  return (
    <div style={{ padding: "40px 48px", maxWidth: 1100 }}>
      {/* Back */}
      <Link
        href="/submittals"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 13, textDecoration: "none", marginBottom: 24, fontWeight: 500 }}
      >
        <ArrowLeft size={14} /> Back to Submittals
      </Link>

      {/* Title Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
              {s.submittalTitle}
            </h1>
            <StatusBadge status={s.currentStatus} size="lg" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 13 }}>
            <span>{s.specSection}</span>
            <ChevronRight size={12} />
            <span>{s.projectName}</span>
            <ChevronRight size={12} />
            <span>{s.id}</span>
          </div>
        </div>
        {s.requiresHumanApproval && s.humanApprovalStatus === "pending" && (
          <div style={{
            background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
            padding: "12px 18px", display: "flex", alignItems: "center", gap: 8,
          }}>
            <AlertCircle size={16} color="#d97706" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>Awaiting manager approval</span>
          </div>
        )}
      </div>

      {/* Meta Cards */}
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
        padding: "24px 28px", marginBottom: 24,
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
        gap: 24, borderLeft: "4px solid #2563eb",
      }}>
        <MetaItem icon={User} label="Subcontractor" value={s.subcontractor.name} />
        <MetaItem icon={User} label="Contact" value={s.subcontractor.contact} />
        <MetaItem icon={DollarSign} label="Contract Value" value={fmtDollars(s.dollarAmount)} accent={s.requiresHumanApproval ? "#d97706" : "#0f172a"} />
        <MetaItem icon={Calendar} label="Submitted" value={fmtTime(s.submittedAt)} />
        <MetaItem icon={Clock} label="Processing Time" value={s.processingTimeMs ? `${(s.processingTimeMs / 1000).toFixed(1)}s` : "In progress"} />
      </div>

      {/* Main content: pipeline + log side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20 }}>

        {/* Agent Pipeline */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "24px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 20 }}>Agent Pipeline</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {AGENT_ORDER.map((agentName, i) => {
              const step = agentTrailMap[agentName];
              const isLast = i === AGENT_ORDER.length - 1;
              const pending = !step;

              return (
                <div key={agentName} style={{ display: "flex", gap: 14 }}>
                  {/* Line + icon */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      {pending
                        ? <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px dashed #cbd5e1", background: "#f8fafc" }} />
                        : agentStatusIcon(step.status)
                      }
                    </div>
                    {!isLast && (
                      <div style={{ width: 2, flex: 1, minHeight: 20, background: pending ? "#f1f5f9" : "#e2e8f0", marginTop: 4, marginBottom: 4 }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: pending ? "#94a3b8" : "#0f172a" }}>
                        {agentName}
                      </span>
                      {step && <StatusBadge status={step.status} />}
                    </div>
                    {step ? (
                      <>
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginTop: 2 }}>{step.summary}</div>
                        <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 4 }}>{fmtTime(step.timestamp)}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>Not yet executed</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Decision Summary + Communication Log */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Decision Summary */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "24px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 18 }}>Decision Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { label: "Completeness", value: s.completenessStatus },
                { label: "Comparison", value: s.comparisonStatus },
                { label: "Routing", value: s.routingDecision },
                { label: "Executive Decision", value: s.executiveDecision },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: "#f8fafc", borderRadius: 8, padding: "14px 16px",
                  border: "1px solid #f1f5f9",
                }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    {label}
                  </div>
                  {value
                    ? <StatusBadge status={value} size="lg" />
                    : <span style={{ fontSize: 12, color: "#cbd5e1" }}>Pending</span>
                  }
                </div>
              ))}
            </div>

            {/* Human Approval section */}
            {s.requiresHumanApproval && (
              <div style={{
                marginTop: 16, padding: "16px", borderRadius: 8,
                background: s.humanApprovalStatus === "approved" ? "#f0fdf4" : "#fffbeb",
                border: `1px solid ${s.humanApprovalStatus === "approved" ? "#bbf7d0" : "#fde68a"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      High-Value Approval
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <StatusBadge status={s.humanApprovalStatus} size="lg" />
                      {s.humanApprovalNote && (
                        <span style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>{s.humanApprovalNote}</span>
                      )}
                    </div>
                  </div>
                  {s.humanApprovalStatus === "pending" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{
                        padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                        background: "#16a34a", color: "#fff", border: "none", cursor: "pointer",
                      }}>
                        Approve
                      </button>
                      <button style={{
                        padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                        background: "#fee2e2", color: "#dc2626", border: "none", cursor: "pointer",
                      }}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Communication Log */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "24px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 18 }}>Communication Log</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {s.communications.map(msg => {
                const isOutbound = msg.direction === "agent_out";
                return (
                  <div key={msg.id} style={{
                    padding: "12px 14px", borderRadius: 8,
                    background: isOutbound ? "#f0f9ff" : "#f8fafc",
                    border: `1px solid ${isOutbound ? "#bae6fd" : "#e2e8f0"}`,
                    alignSelf: isOutbound ? "flex-start" : "flex-end",
                    maxWidth: "85%",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isOutbound ? "#0369a1" : "#475569" }}>
                        {isOutbound ? `Agent: ${msg.agent}` : `${s.subcontractor.name}`}
                      </span>
                      <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {fmtTime(msg.timestamp)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.55, margin: 0 }}>{msg.text}</p>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <Link
                href={`/communications/${s.id}`}
                style={{
                  padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: "#eff6ff", color: "#2563eb", textDecoration: "none", border: "none",
                }}
              >
                View Full Thread
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
