const CONFIGS = {
  // Executive decisions
  approve_internal_progression: { label: "Approved", bg: "#f1f5f9", color: "#334155", dot: "#94a3b8" },
  return_to_subcontractor:      { label: "Returned", bg: "#fef3c7", color: "#92400e", dot: "#d97706" },
  escalate_to_human:            { label: "Escalated", bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  // Completeness
  complete:                     { label: "Complete", bg: "#f1f5f9", color: "#334155", dot: "#94a3b8" },
  incomplete:                   { label: "Incomplete", bg: "#fef3c7", color: "#92400e", dot: "#d97706" },
  needs_human_review:           { label: "Needs Review", bg: "#ede9fe", color: "#5b21b6", dot: "#7c3aed" },
  // Comparison
  compliant:                    { label: "Compliant", bg: "#f1f5f9", color: "#334155", dot: "#94a3b8" },
  deviation_detected:           { label: "Deviation", bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  unclear:                      { label: "Unclear", bg: "#ede9fe", color: "#5b21b6", dot: "#7c3aed" },
  // Intake
  accepted:                     { label: "Accepted", bg: "#f1f5f9", color: "#334155", dot: "#94a3b8" },
  accepted_with_warnings:       { label: "Accepted w/ Warnings", bg: "#fef3c7", color: "#92400e", dot: "#d97706" },
  rejected:                     { label: "Rejected", bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  // Workflow states
  approved_internal_progression:{ label: "Approved", bg: "#f1f5f9", color: "#334155", dot: "#94a3b8" },
  returned_to_subcontractor:    { label: "Returned", bg: "#fef3c7", color: "#92400e", dot: "#d97706" },
  escalated_to_human:           { label: "Escalated", bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  pending_human_approval:       { label: "Pending Approval", bg: "#dbeafe", color: "#1e40af", dot: "#2563eb" },
  // Human approval
  pending:                      { label: "Pending", bg: "#dbeafe", color: "#1e40af", dot: "#2563eb" },
  approved:                     { label: "Approved", bg: "#f1f5f9", color: "#334155", dot: "#94a3b8" },
  rejected_approval:            { label: "Rejected", bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  // Agent routing
  auto_route_internal_review:   { label: "Auto-Routed", bg: "#f1f5f9", color: "#334155", dot: "#94a3b8" },
  human_exception_queue:        { label: "Exception Queue", bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  // Parser
  success:                      { label: "Success", bg: "#f1f5f9", color: "#334155", dot: "#94a3b8" },
};

const FALLBACK = { label: "Unknown", bg: "#f1f5f9", color: "#475569", dot: "#94a3b8" };

export default function StatusBadge({ status, size = "sm" }) {
  const cfg = CONFIGS[status] ?? FALLBACK;
  const fontSize = size === "lg" ? 13 : 11;
  const padding = size === "lg" ? "5px 12px" : "3px 9px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: cfg.bg,
        color: cfg.color,
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: 99,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}
