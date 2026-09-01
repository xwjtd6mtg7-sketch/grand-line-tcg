import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { BrowserGuard } from "@/components/browser-guard";
import { CatalogProvider } from "@/components/catalog-provider";
import { Shell } from "@/components/shell";
import appCss from "../styles.css?url";

const APP_NAME = "Grand Line TCG";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#070B14" },
      {
        name: "description",
        content: "Jeu de cartes One Piece TCG : combat, boosters officiels et collection.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/__grok/icon-180.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "preload", href: "/data/catalog.json?v=fr-cards-opcollec-13", as: "fetch", crossOrigin: "anonymous" },
      { rel: "preload", href: "/data/meta.json", as: "fetch", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Figtree:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <BrowserGuard />
        <AuthProvider>
          <CatalogProvider>
            <Shell>
              <Outlet />
            </Shell>
          </CatalogProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
