import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Management — Daily Task Tracker",
  description: "Unfinished tasks roll forward automatically, due-time reminders keep you honest, and everything syncs across your devices.",
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B1F3A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
