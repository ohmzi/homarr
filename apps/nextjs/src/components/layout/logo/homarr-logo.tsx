import { Text } from "@mantine/core";

import type { LogoWithTitleProps } from "./logo";
import { Logo, LogoWithTitle } from "./logo";

interface LogoProps {
  size: number;
}

// The bare omega for the header lockup; the amber-square variant lives at
// /logo/logo.png and is used for favicons, PWA icons and OG images.
export const homarrLogoPath = "/logo/ohmz-mark.svg";
export { brandPageTitle as homarrPageTitle } from "~/metadata";

const imageOptions = {
  src: homarrLogoPath,
  alt: "Ohmz HomeLab logo",
  // next/image refuses SVG unless dangerouslyAllowSVG is set; a plain img is
  // the right call for a first-party static mark.
  shouldUseNextImage: false,
};

export const HomarrLogo = ({ size }: LogoProps) => <Logo size={size} {...imageOptions} />;

interface CommonLogoWithTitleProps {
  size: LogoWithTitleProps["size"];
}

/**
 * Mirrors the home.ohmz.cloud wordmark: "Ohmz" in the body colour, the second
 * half in brand amber. Shared with the board header, which falls back to this
 * lockup whenever a board has no page title of its own.
 */
export const BrandWordmark = () => (
  <>
    Ohmz{" "}
    <Text component="span" inherit c="ohmzAmber.6" className="ohmz-lockup-suffix">
      HomeLab
    </Text>
  </>
);

export const HomarrLogoWithTitle = ({ size }: CommonLogoWithTitleProps) => {
  return <LogoWithTitle size={size} title={<BrandWordmark />} image={imageOptions} />;
};
