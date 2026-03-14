import "./globals.css";

export const metadata = {
  title: "PodiumHackathon",
  description: "Next.js hackathon scaffold",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
