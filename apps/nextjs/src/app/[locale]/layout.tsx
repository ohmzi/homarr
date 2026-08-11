import type { Metadata, Viewport } from "next";

import "@gfazioli/mantine-onboarding-tour/styles.css";
import "@homarr/notifications/styles.css";
import "@homarr/spotlight/styles.css";
import "@homarr/ui/styles.css";
import "mantine-datatable/styles.css";
import "~/styles/color-scheme.scss";
import "~/styles/ohmz-brand.scss";
import "~/styles/scroll-area.scss";

import { notFound } from "next/navigation";
import type { DayOfWeek } from "@mantine/dates";
import { NextIntlClientProvider } from "next-intl";

import { api } from "@homarr/api/server";
import { env } from "@homarr/auth/env";
import { auth } from "@homarr/auth/next";
import { db } from "@homarr/db";
import { getServerSettingsAsync } from "@homarr/db/queries";
import { ModalProvider } from "@homarr/modals";
import { Notifications } from "@homarr/notifications";
import { SettingsProvider } from "@homarr/settings";
import { SpotlightProvider } from "@homarr/spotlight";
import type { SupportedLanguage } from "@homarr/translation";
import { isLocaleRTL, isLocaleSupported } from "@homarr/translation";

import { Analytics } from "~/components/layout/analytics";
import { CrowdinLiveTranslation } from "~/components/layout/crowdin-live-translation";

import { SearchEngineOptimization } from "~/components/layout/search-engine-optimization";
import { ServiceWorkerRegistration } from "~/components/layout/service-worker-registration";
import { getCurrentColorSchemeAsync } from "~/theme/color-scheme";
import { DayJsLoader } from "./_client-providers/dayjs-loader";
import { JotaiProvider } from "./_client-providers/jotai";
import { CustomMantineProvider } from "./_client-providers/mantine";
import { AuthProvider } from "./_client-providers/session";
import { TRPCReactProvider } from "./_client-providers/trpc";
import { composeWrappers } from "./compose";

// eslint-disable-next-line no-restricted-syntax
export const generateMetadata = async (): Promise<Metadata> => ({
  title: "Ohmz HomeLab",
  description:
    "A self-hosted dashboard for the *arr stack and your entire homelab. Integrates with 50+ services, real-time widgets, no config files.",
  openGraph: {
    title: "Ohmz HomeLab",
    description:
      "A self-hosted dashboard for the *arr stack and your entire homelab. Integrates with 50+ services, real-time widgets, no config files.",
    url: "https://homarr.dev",
    siteName: "Ohmz HomeLab",
  },
  // Declared explicitly and in preference order so browsers never fall back to
  // a generated letter tile. The filled amber square is deliberate here: a tab
  // favicon sits on the browser's own chrome, where a transparent glyph would
  // vanish. The bare omega is for the in-app header only.
  icons: {
    icon: [
      { url: "/logo/favicon.svg", type: "image/svg+xml" },
      { url: "/logo/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/logo/apple-touch-icon.png",
  },
  appleWebApp: {
    title: "Ohmz HomeLab",
    capable: true,
    startupImage: { url: "/logo/logo.png" },
    statusBarStyle: (await getCurrentColorSchemeAsync()) === "dark" ? "black-translucent" : "default",
  },
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: SupportedLanguage }>;
}) {
  if (!isLocaleSupported((await props.params).locale)) {
    notFound();
  }

  const session = await auth();
  const user = session ? await api.user.getById({ userId: session.user.id }).catch(() => null) : null;
  const serverSettings = await getServerSettingsAsync(db);
  const colorScheme = await getCurrentColorSchemeAsync();
  const direction = isLocaleRTL((await props.params).locale) ? "rtl" : "ltr";

  const StackedProvider = composeWrappers([
    (innerProps) => {
      return <AuthProvider session={session} logoutUrl={env.AUTH_LOGOUT_REDIRECT_URL} {...innerProps} />;
    },
    (innerProps) => (
      <SettingsProvider
        user={
          user
            ? {
                ...user,
                // Convert type, because output schema is not smart enough to infer $type from drizzle
                firstDayOfWeek: user.firstDayOfWeek as DayOfWeek,
              }
            : null
        }
        serverSettings={{
          board: {
            homeBoardId: serverSettings.board.homeBoardId,
            mobileHomeBoardId: serverSettings.board.mobileHomeBoardId,
            enableStatusByDefault: serverSettings.board.enableStatusByDefault,
            forceDisableStatus: serverSettings.board.forceDisableStatus,
          },
          search: { defaultSearchEngineId: serverSettings.search.defaultSearchEngineId },
          user: { enableGravatar: serverSettings.user.enableGravatar },
        }}
        {...innerProps}
      />
    ),
    (innerProps) => <JotaiProvider {...innerProps} />,
    (innerProps) => <TRPCReactProvider {...innerProps} />,
    (innerProps) => <DayJsLoader {...innerProps} />,
    (innerProps) => <NextIntlClientProvider {...innerProps} />,
    (innerProps) => <CustomMantineProvider {...innerProps} defaultColorScheme={colorScheme} />,
    (innerProps) => <ModalProvider {...innerProps} />,
    (innerProps) => <SpotlightProvider {...innerProps} />,
  ]);

  const { locale } = await props.params;

  return (
    // Instead of ColorSchemScript we use data-mantine-color-scheme to prevent flickering
    <html
      lang={locale}
      dir={direction}
      data-mantine-color-scheme={colorScheme}
      style={{
        // Brand canvases (--ohmz-canvas / --ohmz-l-canvas). These must match the
        // Mantine body colour exactly, otherwise any page shorter than the
        // viewport shows a hard seam where <html> takes over from <body>.
        backgroundColor: colorScheme === "dark" ? "#1a1917" : colorScheme === "auto" ? undefined : "#faf9f7",
      }}
      suppressHydrationWarning
    >
      <head>
        <SearchEngineOptimization />
        <CrowdinLiveTranslation locale={locale} />
      </head>
      <body suppressHydrationWarning>
        <Analytics enabled={serverSettings.analytics.enableGeneral} />
        <StackedProvider>
          <Notifications pauseResetOnHover="notification" />
          <ServiceWorkerRegistration />
          {props.children}
        </StackedProvider>
      </body>
    </html>
  );
}
