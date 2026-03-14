"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SUBMITTALS } from "../lib/mockData";
import StatusBadge from "../components/StatusBadge";
import { Search, ArrowUpRight, ChevronUp, ChevronDown } from "lucide-react";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "approved_internal_progression", label: "Approved" },
  { value: "returned_to_subcontractor", label: "Returned" },
  { value: "escalated_to_human", label: "Escalated" },
  { value: "pending_human_approval", label: "Pending Approval" },
];

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDollars(n) {
  return "$" + n.toLocaleString();
}

export default function SubmittalsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortKey, setSortKey] = useState("submittedAt");
  const [sortDir, setSortDir] = useState("desc");

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = SUBMITTALS
    .filter(s => {
      if (filter !== "all" && s.currentStatus !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.submittalTitle.toLowerCase().includes(q) ||
          s.projectName.toLowerCase().includes(q) ||
          s.subcontractor.name.toLowerCase().includes(q) ||
          s.specSection.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "submittedAt") { av = new Date(av); bv = new Date(bv); }
      if (sortKey === "dollarAmount") { av = av ?? 0; bv = bv ?? 0; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  function SortIcon({ col }) {
    if (sortKey !== col) return <ChevronUp size={12} style={{ opacity: 0.25 }} />;
    return sortDir === "asc"
      ? <ChevronUp size={12} style={{ color: "#2563eb" }} />
      : <ChevronDown size={12} style={{ color: "#2563eb" }} />;
  }

  return (
    <div style={{ padding: "40px 48px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
          Submittals
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
          {SUBMITTALS.length} total — {filtered.length} shown
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "0 0 320px" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            placeholder="Search submittals, projects, subs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px 9px 34px",
              border: "1px solid #e2e8f0", borderRadius: 8,
              fontSize: 13, color: "#0f172a", background: "#fff",
              outline: "none",
            }}
          />
        </div>

        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 6 }}>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "1px solid",
                borderColor: filter === opt.value ? "#2563eb" : "#e2e8f0",
                background: filter === opt.value ? "#eff6ff" : "#fff",
                color: filter === opt.value ? "#2563eb" : "#64748b",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {[
                { key: "submittalTitle", label: "Submittal" },
                { key: "projectName", label: "Project" },
                { key: null, label: "Subcontractor" },
                { key: "completenessStatus", label: "Completeness" },
                { key: "comparisonStatus", label: "Comparison" },
                { key: "currentStatus", label: "Status" },
                { key: "dollarAmount", label: "Value" },
                { key: "submittedAt", label: "Submitted" },
                { key: null, label: "" },
              ].map(({ key, label }) => (
                <th
                  key={label}
                  onClick={() => key && toggleSort(key)}
                  style={{
                    padding: "10px 18px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, color: "#94a3b8",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    cursor: key ? "pointer" : "default",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {label}
                    {key && <SortIcon col={key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                  No submittals match your filters.
                </td>
              </tr>
            )}
            {filtered.map((s, i) => (
              <tr
                key={s.id}
                onClick={() => router.push(`/submittals/${s.id}`)}
                style={{
                  borderTop: "1px solid #f1f5f9",
                  background: i % 2 === 0 ? "#fff" : "#fafafa",
                  transition: "background 0.1s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f0f9ff"}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}
              >
                <td style={{ padding: "14px 18px", maxWidth: 260 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.submittalTitle}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{s.specSection}</div>
                </td>
                <td style={{ padding: "14px 18px", fontSize: 13, color: "#475569", whiteSpace: "nowrap" }}>
                  {s.projectName}
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: 13, color: "#475569", whiteSpace: "nowrap" }}>{s.subcontractor.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{s.subcontractor.contact}</div>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  {s.completenessStatus
                    ? <StatusBadge status={s.completenessStatus} />
                    : <span style={{ color: "#cbd5e1", fontSize: 12 }}>—</span>}
                </td>
                <td style={{ padding: "14px 18px" }}>
                  {s.comparisonStatus
                    ? <StatusBadge status={s.comparisonStatus} />
                    : <span style={{ color: "#cbd5e1", fontSize: 12 }}>—</span>}
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <StatusBadge status={s.currentStatus} />
                </td>
                <td style={{ padding: "14px 18px", fontSize: 13, color: "#0f172a", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {fmtDollars(s.dollarAmount)}
                </td>
                <td style={{ padding: "14px 18px", fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {fmt(s.submittedAt)}
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <Link
                    href={`/submittals/${s.id}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 12, color: "#2563eb", fontWeight: 600, textDecoration: "none",
                      padding: "5px 10px", borderRadius: 6, background: "#eff6ff",
                    }}
                  >
                    View <ArrowUpRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
