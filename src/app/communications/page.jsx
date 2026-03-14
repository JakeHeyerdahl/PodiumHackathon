"use client";

import Link from "next/link";
import { SUBMITTALS } from "../lib/mockData";
import { MessageSquare, Bot, User, Flame, AlertTriangle, Minus } from "lucide-react";

const SENTIMENT_CONFIGS = {
  critical:   { label: "Critical", bg: "#fee2e2", color: "#991b1b", icon: Flame },
  frustrated: { label: "Frustrated", bg: "#fef3c7", color: "#92400e", icon: AlertTriangle },
  neutral:    { label: "Neutral",   bg: "#f1f5f9", color: "#64748b", icon: Minus },
};

function threadSentiment(communications) {
  const subMsgs = communications.filter(m => m.direction === "sub_in" && m.sentiment);
  if (subMsgs.length === 0) return null;
  return subMsgs.reduce((a, b) => (b.sentiment.score > a.sentiment.score ? b : a)).sentiment;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${mins}m ago`;
}

function getInitials(name) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// Build thread list: one thread per submittal that has communications
const threads = SUBMITTALS
  .filter(s => s.communications.length > 0)
  .map(s => {
    const lastMsg = s.communications[s.communications.length - 1];
    const humanControlled = s.communications.some(m => m.humanControlled);
    const hasSubReply = s.communications.some(m => m.direction === "sub_in");
    return {
      id: s.id,
      subcontractor: s.subcontractor,
      submittalTitle: s.submittalTitle,
      projectName: s.projectName,
      messageCount: s.communications.length,
      lastMessage: lastMsg.text,
      lastMessageTime: lastMsg.timestamp,
      lastDirection: lastMsg.direction,
      humanControlled,
      hasSubReply,
      sentiment: threadSentiment(s.communications),
    };
  })
  .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

const agentThreads = threads.filter(t => !t.humanControlled);
const humanThreads = threads.filter(t => t.humanControlled);

function ThreadRow({ thread }) {
  return (
    <Link href={`/communications/${thread.id}`} style={{ textDecoration: "none" }}>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 14,
        padding: "16px 20px",
        borderBottom: "1px solid #f1f5f9",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
          background: "#e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#475569",
        }}>
          {getInitials(thread.subcontractor.name)}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
              {thread.subcontractor.name}
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", marginLeft: 12 }}>
              {timeAgo(thread.lastMessageTime)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 500 }}>
            {thread.submittalTitle}
          </div>
          <div style={{
            fontSize: 12, color: "#94a3b8",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            {thread.lastDirection === "agent_out"
              ? <Bot size={11} style={{ flexShrink: 0 }} />
              : <User size={11} style={{ flexShrink: 0 }} />
            }
            {thread.lastMessage}
          </div>
        </div>

        {/* Badges */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          {thread.sentiment && (() => {
            const cfg = SENTIMENT_CONFIGS[thread.sentiment.label] ?? SENTIMENT_CONFIGS.neutral;
            const Icon = cfg.icon;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 99, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
                <Icon size={10} /> {cfg.label}
              </div>
            );
          })()}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 99,
            background: thread.humanControlled ? "#fef3c7" : "#f1f5f9",
            color: thread.humanControlled ? "#92400e" : "#64748b",
            fontSize: 11, fontWeight: 600,
          }}>
            {thread.humanControlled ? <User size={10} /> : <Bot size={10} />}
            {thread.humanControlled ? "Human" : "Agent"}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CommunicationsPage() {
  return (
    <div style={{ padding: "40px 48px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
          Communications
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
          {threads.length} active threads · {humanThreads.length} under human control
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total Threads", value: threads.length },
          { label: "Agent Controlled", value: agentThreads.length },
          { label: "Human Controlled", value: humanThreads.length },
          { label: "Awaiting Sub Reply", value: threads.filter(t => t.lastDirection === "agent_out").length },
        ].map(({ label, value }) => (
          <div key={label} style={{
            flex: 1, background: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 10, padding: "16px 20px",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{value}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Thread list */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>

        {/* Agent controlled */}
        <div style={{ padding: "12px 20px 0", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
            <Bot size={13} color="#64748b" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Agent Controlled — {agentThreads.length}
            </span>
          </div>
        </div>
        {agentThreads.map(t => <ThreadRow key={t.id} thread={t} />)}

        {/* Human controlled */}
        {humanThreads.length > 0 && (
          <>
            <div style={{ padding: "12px 20px 0", background: "#fffbeb", borderTop: "1px solid #fde68a", borderBottom: "1px solid #fde68a" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
                <User size={13} color="#92400e" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Human Controlled — {humanThreads.length}
                </span>
              </div>
            </div>
            {humanThreads.map(t => <ThreadRow key={t.id} thread={t} />)}
          </>
        )}
      </div>
    </div>
  );
}
