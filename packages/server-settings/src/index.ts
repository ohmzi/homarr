import type { ColorScheme } from "@homarr/definitions";
import type { SupportedLanguage } from "@homarr/translation";

export const defaultServerSettingsKeys = [
  "analytics",
  "crawlingAndIndexing",
  "board",
  "user",
  "appearance",
  "culture",
  "search",
] as const;

export type ServerSettingsRecord = Record<(typeof defaultServerSettingsKeys)[number], Record<string, unknown>>;

export const defaultServerSettings = {
  analytics: {
    enableGeneral: true,
    instanceId: null as string | null,
  },
  crawlingAndIndexing: {
    noIndex: true,
    noFollow: true,
    noTranslate: true,
    noSiteLinksSearchBox: false,
  },
  board: {
    homeBoardId: null as string | null,
    mobileHomeBoardId: null as string | null,
    enableStatusByDefault: true,
    forceDisableStatus: false,
  },
  user: {
    enableGravatar: true,
  },
  appearance: {
    // Dark by default, matching Ohmz AI and ohmz.cloud: these apps are
    // dark-first, and a visitor whose OS is in light mode should still meet the
    // brand the way it is designed. "auto" would hand that decision to the OS.
    // A signed-in user's own choice still wins — it is stored in the colour
    // scheme cookie and read ahead of this in theme/color-scheme.ts.
    defaultColorScheme: "dark" as ColorScheme,
  },
  culture: {
    defaultLocale: "en" as SupportedLanguage,
  },
  search: {
    defaultSearchEngineId: null as string | null,
  },
} satisfies ServerSettingsRecord;

export type ServerSettings = typeof defaultServerSettings;
