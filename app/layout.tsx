import type { Metadata, Viewport } from "next";
import "./globals.css";

/* Android app detection, run before first paint. The Task Management APK appends
   "TaskManagementApp" to its user agent (capacitor.config.json → appendUserAgent);
   older APKs are recognised by the Capacitor bridge; "?app=1" / "?app=0" turns a
   preview on/off in a normal browser. iPhone: Task Management added to the home
   screen from Safari opens full screen ("standalone") and gets the same app
   layout; there we also let the page use the whole screen (viewport-fit=cover)
   so the bottom bar sits above the home indicator. Only then does <html> get
   "tm-app" — the website in a normal browser tab is unaffected. */
const APP_MODE_SCRIPT = `(function(){try{var d=document.documentElement,ua=navigator.userAgent||"",q=/[?&]app=(1|0)\\b/.exec(location.search);if(q){try{q[1]==="1"?localStorage.setItem("tm-app-mode","1"):localStorage.removeItem("tm-app-mode")}catch(e){}}var saved=false;try{saved=localStorage.getItem("tm-app-mode")==="1"}catch(e){}var cap=window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform();var home=false;try{home=navigator.standalone===true||window.matchMedia("(display-mode: standalone)").matches}catch(e){}if(ua.indexOf("TaskManagementApp")>=0||cap||saved||home)d.classList.add("tm-app");if(home){var fit=function(){var m=document.querySelector('meta[name="viewport"]');if(m&&m.content.indexOf("viewport-fit")<0)m.content+=", viewport-fit=cover"};fit();document.addEventListener("DOMContentLoaded",fit)}}catch(e){}})();`;

/* Theme (Light / Dark / System), run before first paint so there is no white flash.
   Choice lives in localStorage "tm-theme" ("light" | "dark" | "system", default system).
   <html> gets class "dark" when dark is active; window.__tmTheme(mode) is called by Settings. */
const THEME_SCRIPT = `(function(){var d=document.documentElement,mq=null;try{mq=window.matchMedia("(prefers-color-scheme: dark)")}catch(e){}function get(){try{return localStorage.getItem("tm-theme")||"system"}catch(e){return "system"}}function apply(){var m=get(),dark=m==="dark"||(m==="system"&&!!mq&&mq.matches);d.classList.toggle("dark",dark);d.style.colorScheme=dark?"dark":"light";var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content",dark?"#060f28":"#0B1F3A")}window.__tmTheme=function(m){try{localStorage.setItem("tm-theme",m)}catch(e){}apply();try{window.dispatchEvent(new Event("tm-theme"))}catch(e){}};if(mq){if(mq.addEventListener)mq.addEventListener("change",apply);else if(mq.addListener)mq.addListener(apply)}apply();document.addEventListener("DOMContentLoaded",apply)})();`;

export const metadata: Metadata = {
  title: "Task Management — Daily Task Tracker",
  description: "Unfinished tasks roll forward automatically, due-time reminders keep you honest, and everything syncs across your devices.",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
  applicationName: "Task Management",
  appleWebApp: { capable: true, title: "Task Management", statusBarStyle: "default" },
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
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* older iPhones (iOS < 16.4) only open full screen with this tag */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
