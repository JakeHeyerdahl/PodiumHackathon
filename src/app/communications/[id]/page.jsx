"use client";

import { use, useState } from "react";
import Link from "next/link";
import { SUBMITTALS } from "../../lib/mockData";
import { ArrowLeft, Bot, User, Send, AlertTriangle, RotateCcw, Flame, Minus } from "lucide-react";

const SENTIMENT_CONFIGS = {
  critical:   { label: "Critical — urgent attention needed", bg: "#fee2e2", color: "#991b1b", border: "#fecaca", icon: Flame },
  frustrated: { label: "Frustrated — monitor closely",      bg: "#fef3c7", color: "#92400e", border: "#fde68a", icon: AlertTriangle },
  neutral:    { label: "Neutral",                           bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0", icon: Minus },
};

function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function ThreadPage({ params }) {
  const { id } = use(params);
  const submittal = SUBMITTALS.find(s => s.id === id);

  const subMsgs = submittal?.communications.filter(m => m.direction === "sub_in" && m.sentiment) ?? [];
  const topSentiment = subMsgs.length > 0
    ? subMsgs.reduce((a, b) => b.sentiment.score > a.sentiment.score ? b : a).sentiment
    : null;

  const [humanControlled, setHumanControlled] = useState(false);
  const [messages, setMessages] = useState(submittal?.communications ?? []);
  const [draft, setDraft] = useState("");

  if (!submittal) {
    return <div style={{ padding: "40px 48px", color: "#94a3b8" }}>Thread not found.</div>;
  }

  const s = submittal;

  function handleTakeOver() {
    setHumanControlled(true);
  }

  function handleRelease() {
    setHumanControlled(false);
  }

  function handleSend() {
    if (!draft.trim()) return;
    setMessages(prev => [...prev, {
      id: `msg_manual_${Date.now()}`,
      direction: "agent_out",
      text: draft.trim(),
      timestamp: new Date().toISOString(),
      agent: null,
      humanControlled: true,
    }]);
    setDraft("");
  }

  return (
    <div style={{ padding: "40px 48px", maxWidth: 800 }}>
      {/* Back */}
      <Link
        href="/communications"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 13, textDecoration: "none", marginBottom: 24, fontWeight: 500 }}
      >
        <ArrowLeft size={14} /> Back to Communications
      </Link>

      {/* Header */}
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
        padding: "20px 24px", marginBottom: 20,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
            {s.subcontractor.name}
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {s.submittalTitle} · <span style={{ color: "#94a3b8" }}>{s.projectName}</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            {s.subcontractor.contact} · {s.subcontractor.email}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          {/* Control status */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 99,
            background: humanControlled ? "#fef3c7" : "#f1f5f9",
            color: humanControlled ? "#92400e" : "#475569",
            fontSize: 12, fontWeight: 600,
          }}>
            {humanControlled ? <User size={12} /> : <Bot size={12} />}
            {humanControlled ? "Human Controlled" : "Agent Controlled"}
          </div>

          {/* Action button */}
          {!humanControlled ? (
            <button
              onClick={handleTakeOver}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: "#0f172a", color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              <User size={13} /> Take Over Thread
            </button>
          ) : (
            <button
              onClick={handleRelease}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer",
              }}
            >
              <RotateCcw size={13} /> Release to Agent
            </button>
          )}
        </div>
      </div>

      {/* Sentiment alert banner */}
      {topSentiment && topSentiment.score >= 60 && (() => {
        const cfg = SENTIMENT_CONFIGS[topSentiment.label] ?? SENTIMENT_CONFIGS.neutral;
        const Icon = cfg.icon;
        return (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          }}>
            <Icon size={15} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color, marginBottom: 2 }}>
                Sentiment Alert: {cfg.label}
              </div>
              <div style={{ fontSize: 12, color: cfg.color, opacity: 0.85 }}>
                Detected signals: {topSentiment.flags.map(f => f.replace(/_/g, " ")).join(", ")}
              </div>
            </div>
            <div style={{ marginLeft: "auto", flexShrink: 0, fontSize: 12, fontWeight: 800, color: cfg.color }}>
              {topSentiment.score}/100
            </div>
          </div>
        );
      })()}

      {/* Takeover notice */}
      {humanControlled && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: 8, padding: "10px 16px", marginBottom: 16,
          fontSize: 13, color: "#92400e",
        }}>
          <AlertTriangle size={14} />
          You have taken control of this thread. Agent messages are paused until you release it.
        </div>
      )}

      {/* Message thread */}
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
        overflow: "hidden",
      }}>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, minHeight: 300 }}>
          {messages.map((msg) => {
            const isOutbound = msg.direction === "agent_out";
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isOutbound ? "flex-start" : "flex-end",
                }}
              >
                {/* Sender label */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 5,
                  marginBottom: 4, fontSize: 11, color: "#94a3b8", fontWeight: 600,
                }}>
                  {isOutbound
                    ? msg.humanControlled
                      ? <><User size={11} /> You (Manual)</>
                      : <><Bot size={11} /> Agent{msg.agent ? ` · ${msg.agent}` : ""}</>
                    : <><User size={11} /> {s.subcontractor.contact}</>
                  }
                  <span style={{ color: "#cbd5e1", fontWeight: 400, marginLeft: 4 }}>
                    {fmtTime(msg.timestamp)}
                  </span>
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: "72%",
                  padding: "10px 14px",
                  borderRadius: isOutbound ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
                  background: isOutbound
                    ? msg.humanControlled ? "#fef3c7" : "#f0f9ff"
                    : "#f8fafc",
                  border: `1px solid ${isOutbound
                    ? msg.humanControlled ? "#fde68a" : "#bae6fd"
                    : "#e2e8f0"}`,
                  fontSize: 13, color: "#1e293b", lineHeight: 1.55,
                }}>
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compose box — only shown when human controlled */}
        {humanControlled && (
          <div style={{
            borderTop: "1px solid #e2e8f0",
            padding: "16px 20px",
            background: "#fafafa",
            display: "flex", gap: 10, alignItems: "flex-end",
          }}>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={`Message ${s.subcontractor.contact}…`}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              style={{
                flex: 1, padding: "10px 14px",
                border: "1px solid #e2e8f0", borderRadius: 8,
                fontSize: 13, color: "#0f172a", background: "#fff",
                resize: "none", outline: "none", lineHeight: 1.5,
                minHeight: 60, maxHeight: 120,
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim()}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 40, height: 40, borderRadius: 8, border: "none",
                background: draft.trim() ? "#0f172a" : "#e2e8f0",
                color: draft.trim() ? "#fff" : "#94a3b8",
                cursor: draft.trim() ? "pointer" : "default",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              <Send size={15} />
            </button>
          </div>
        )}

        {/* Agent controlled footer */}
        {!humanControlled && (
          <div style={{
            borderTop: "1px solid #f1f5f9", padding: "12px 20px",
            background: "#f8fafc",
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: "#94a3b8",
          }}>
            <Bot size={13} />
            Agent is managing this thread. Take over to send a manual message.
          </div>
        )}
      </div>
    </div>
  );
}
