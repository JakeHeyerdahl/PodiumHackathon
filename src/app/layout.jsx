import "./globals.css";
import Sidebar from "./components/Sidebar";

export const metadata = {
  title: "Subly — Submittal Intelligence",
  description: "AI-powered construction submittal management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100vh", background: "#ffffff" }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
