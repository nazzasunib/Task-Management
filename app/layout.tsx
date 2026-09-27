import type { Metadata, Viewport } from "next";
import "./globals.css";

/* Android app detection, run before first paint. The Task Management APK appends
   "TaskManagementApp" to its user agent (capacitor.config.json → appendUserAgent);
   older APKs are recognised by the Capacitor bridge; "?app=1" / "?app=0" turns a
   preview on/off in a normal browser. Only then does <html> get "tm-app" — the
   website is unaffected. */
const APP_MODE_SCRIPT = `(function(){try{var d=document.documentElement,ua=navigator.userAgent||"",q=/[?&]app=(1|0)\\b/.exec(location.search);if(q){try{q[1]==="1"?localStorage.setItem("tm-app-mode","1"):localStorage.removeItem("tm-app-mode")}catch(e){}}var saved=false;try{saved=localStorage.getItem("tm-app-mode")==="1"}catch(e){}var cap=window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform();if(ua.indexOf("TaskManagementApp")>=0||cap||saved)d.classList.add("tm-app")}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Task Management — Daily Task Tracker",
  description: "Unfinished tasks roll forward automatically, due-time reminders keep you honest, and everything syncs across your devices.",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B1F3A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: APP_MODE_SCRIPT }} />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
