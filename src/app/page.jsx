"use client";

import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { SUBMITTALS, getDashboardStats, getWeeklyChartData, getRoutingBreakdown, getSentimentAlerts } from "./lib/mockData";
import StatusBadge from "./components/StatusBadge";
import { ArrowUpRight, FileCheck, Clock, AlertTriangle, TrendingUp, CheckCircle2, Flame, MessageSquare } from "lucide-react";

function KpiCard({ label, value, sub, icon: Icon }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
      padding: "24px 28px", display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>{label}</span>
        <Icon size={20} color="#94a3b8" strokeWidth={1.75} />
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const stats = getDashboardStats();
  const chartData = getWeeklyChartData();
  const breakdown = getRoutingBreakdown();
  const recent = SUBMITTALS.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 5);
  const pendingApprovals = SUBMITTALS.filter(s => s.requiresHumanApproval && s.humanApprovalStatus === "pending");
  const sentimentAlerts = getSentimentAlerts();

  const SENTIMENT_STYLE = {
    critical:   { bg: "#fee2e2", color: "#991b1b", border: "#fecaca", icon: Flame },
    frustrated: { bg: "#fef3c7", color: "#92400e", border: "#fde68a", icon: AlertTriangle },
  };

  return (
    <div style={{ padding: "40px 48px" }}>


      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
      <div>{/* LEFT COLUMN */}

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <KpiCard label="Submittals This Week" value={stats.totalThisWeek} sub="Across 4 projects" icon={FileCheck} />
        <KpiCard label="Approval Rate" value={`${stats.approvalRate}%`} sub="Of completed reviews" icon={TrendingUp} />
        <KpiCard label="Pending Approvals" value={stats.pendingApproval} sub="Awaiting manager sign-off" icon={AlertTriangle} />
        <KpiCard label="Avg. Processing Time" value={`${stats.avgProcessingSeconds}s`} sub="End-to-end agent pipeline" icon={Clock} />
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
          <div style={{
            padding: "20px 28px", borderBottom: "1px solid #fde68a", background: "#fffbeb",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} color="#d97706" />
              <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Pending Approvals</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "#fef3c7", color: "#92400e" }}>
                {pendingApprovals.length} awaiting sign-off
              </span>
            </div>
            <Link href="/approvals" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#d97706", fontWeight: 600, textDecoration: "none" }}>
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          {pendingApprovals.map((s, i) => (
            <div key={s.id} style={{
              padding: "16px 28px", borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
              display: "flex", alignItems: "center", gap: 20,
            }}>
              <div style={{ flexShrink: 0, background: "#fffbeb", borderRadius: 8, padding: "8px 14px", border: "1px solid #fde68a", textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>${s.dollarAmount.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: "#d97706", fontWeight: 600, marginTop: 1 }}>CONTRACT VALUE</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 2 }}>{s.submittalTitle}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{s.projectName} · {s.subcontractor.name}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Link href="/approvals" style={{ padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 700, background: "#0f172a", color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                  <CheckCircle2 size={13} /> Review
                </Link>
                <Link href={`/submittals/${s.id}`} style={{ padding: "7px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600, background: "#f1f5f9", color: "#475569", textDecoration: "none" }}>
                  Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "24px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Weekly Volume by Outcome</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Week of March 10 – 14, 2025</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={18} barCategoryGap="35%">
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="approved" name="Approved" fill="#334155" radius={[4, 4, 0, 0]} />
              <Bar dataKey="returned" name="Returned" fill="#d97706" radius={[4, 4, 0, 0]} />
              <Bar dataKey="escalated" name="Escalated" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "24px 28px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 20 }}>Routing Breakdown</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={breakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={3} dataKey="value">
                {breakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {breakdown.map(b => (
              <div key={b.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, display: "inline-block" }} />
                  <span style={{ color: "#475569" }}>{b.name}</span>
                </div>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>{b.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Submittals */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "20px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Recent Submittals</div>
          <Link href="/submittals" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
            View all <ArrowUpRight size={14} />
          </Link>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Submittal", "Project", "Subcontractor", "Status", "Date"].map(h => (
                <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map((s, i) => (
              <tr key={s.id} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "14px 20px" }}>
                  <Link href={`/submittals/${s.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{s.submittalTitle}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{s.specSection}</div>
                  </Link>
                </td>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "#475569" }}>{s.projectName}</td>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "#475569" }}>{s.subcontractor.name}</td>
                <td style={{ padding: "14px 20px" }}><StatusBadge status={s.currentStatus} /></td>
                <td style={{ padding: "14px 20px", fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {new Date(s.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      </div>{/* END LEFT COLUMN */}

      {/* RIGHT COLUMN — Sentiment Alerts */}
      <div style={{ position: "sticky", top: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid #f1f5f9",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Flame size={15} color="#dc2626" />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>Comm Alerts</span>
            </div>
            <Link href="/communications" style={{ fontSize: 12, color: "#2563eb", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
              All <ArrowUpRight size={12} />
            </Link>
          </div>

          {sentimentAlerts.length === 0 && (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              No flagged conversations
            </div>
          )}

          {sentimentAlerts.map((alert, i) => {
            const cfg = SENTIMENT_STYLE[alert.sentiment.label];
            const Icon = cfg?.icon ?? AlertTriangle;
            return (
              <div key={alert.submittalId} style={{ borderTop: i > 0 ? "1px solid #f1f5f9" : "none", padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 99,
                    background: cfg?.bg ?? "#f1f5f9", color: cfg?.color ?? "#64748b",
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    <Icon size={9} />
                    {alert.sentiment.label} · {alert.sentiment.score}/100
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{alert.subcontractor.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{alert.submittalTitle}</div>
                <div style={{
                  fontSize: 12, color: "#475569", lineHeight: 1.5,
                  background: cfg?.bg ?? "#f8fafc", border: `1px solid ${cfg?.border ?? "#e2e8f0"}`,
                  borderRadius: 6, padding: "8px 10px", marginBottom: 10,
                  display: "-webkit-box", WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  "{alert.triggerMessage}"
                </div>
                {alert.sentiment.flags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                    {alert.sentiment.flags.map(f => (
                      <span key={f} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "#f1f5f9", color: "#64748b", fontWeight: 600 }}>
                        {f.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
                <Link href={`/communications/${alert.submittalId}`} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  padding: "7px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                  background: "#0f172a", color: "#fff", textDecoration: "none",
                }}>
                  <MessageSquare size={12} /> Jump In
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      </div>{/* END TWO-COLUMN GRID */}

    </div>
  );
}
