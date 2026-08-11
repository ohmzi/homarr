/**
 * The single source of truth for the brand name in page metadata.
 *
 * Kept here rather than beside the logo component so that server-only metadata
 * files can read it without pulling in a React component.
 */
export const brandPageTitle = "Ohmz HomeLab";

/**
 * Every page reports the same tab title.
 *
 * Upstream composed "<page name> • Homarr". This instance shows the brand on
 * its own, so the page name is accepted and deliberately discarded: keeping the
 * parameter leaves the eleven call sites untouched, and keeps the board
 * settings placeholder (_general.tsx) honest — it previews the title a board
 * would actually get, which is now the brand alone.
 */
export const createMetaTitle = (_name: string) => brandPageTitle;
