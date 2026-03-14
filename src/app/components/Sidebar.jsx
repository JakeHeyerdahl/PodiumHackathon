"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  ClipboardCheck,
  BarChart2,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/submittals", label: "Submittals", icon: FileText },
  { href: "/communications", label: "Communications", icon: MessageSquare },
  { href: "/reports", label: "Reports", icon: BarChart2 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div style={{ padding: "12px", flexShrink: 0, width: 240 + 24 }}>
      <aside
        style={{
          width: 240,
          height: "calc(100vh - 24px)",
          position: "sticky",
          top: 12,
          background: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div style={{ padding: "24px 24px 20px" }}>
          <img
            src="/subly_logo_transparent.png"
            alt="Subly"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>

        {/* Nav */}
        <nav style={{ padding: "8px 12px", flex: 1 }}>

          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 8,
                  marginBottom: 2,
                  textDecoration: "none",
                  background: active ? "#eff6ff" : "transparent",
                  color: active ? "#2563eb" : "#64748b",
                  fontWeight: active ? 600 : 400,
                  fontSize: 14,
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "16px 24px", color: "#cbd5e1", fontSize: 11 }}>
          Agent Swarm v0.1
        </div>
      </aside>
    </div>
  );
}
