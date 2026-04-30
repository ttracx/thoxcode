import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThoxCode Sandbox · Powered by Claude",
  description:
    "Browser playground for ThoxCode — Thox.ai's coding agent running in isolated Vercel Sandbox microVMs.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
