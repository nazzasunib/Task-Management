import type { MetadataRoute } from "next";

/* Lets iPhone ("Add to Home Screen" in Safari) and Android browsers put
   Task Management on the home screen as a full-screen app without an APK. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Task Management",
    short_name: "Tasks",
    description: "Daily task tracker — unfinished tasks roll forward automatically.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0B1F3A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
