import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ohmz HomeLab",
    short_name: "Ohmz HomeLab",
    description: "Your dashboard for managing your server.",
    start_url: "/",
    display: "standalone",
    // Brand canvas (--ohmz-canvas), so the PWA splash matches the app shell.
    background_color: "#1a1917",
    theme_color: "#1a1917",
    icons: [
      {
        src: "/images/pwa/192.maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/pwa/192.maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/images/pwa/512.maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/pwa/512.maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
