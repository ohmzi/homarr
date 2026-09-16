import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ohmz HomeLab",
    short_name: "Ohmz HomeLab",
    description: "Your dashboard for managing your server.",
    start_url: "/",
    display: "standalone",
    // Lock the installed app to portrait. The mobile boards are laid out as a
    // single narrow column, so landscape just stretches them badly.
    // NOTE: this only binds when Homarr is installed to the home screen; an
    // ordinary browser tab ignores manifest orientation.
    orientation: "portrait",
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
