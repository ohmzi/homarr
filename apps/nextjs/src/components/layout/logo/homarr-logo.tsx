"use client";

import { Text } from "@mantine/core";

import { defaultBrandingSettings } from "@homarr/server-settings";
import { useSettings } from "@homarr/settings";

import { homarrLogoPath } from "./constants";
import type { LogoWithTitleProps } from "./logo";
import { Logo, LogoWithTitle } from "./logo";

interface LogoProps {
  size: number;
}

/**
 * Mirrors the home.ohmz.cloud wordmark: "Ohmz" in the body colour, the second
 * half in brand amber. Only the default app name gets the lockup; an admin's own
 * app name is shown as typed.
 */
export const BrandWordmark = () => (
  <>
    Ohmz{" "}
    <Text component="span" inherit c="ohmzAmber.6">
      HomeLab
    </Text>
  </>
);

export const useBrandTitle = () => {
  const { branding } = useSettings();
  return branding.appName === defaultBrandingSettings.appName ? <BrandWordmark /> : branding.appName;
};

const useBrandLogo = () => {
  const { branding } = useSettings();
  const configuredLogoUrl = branding.logoImageUrl?.trim();
  return {
    title: useBrandTitle(),
    image: {
      src: configuredLogoUrl || homarrLogoPath,
      alt: `${branding.appName} logo`,
      // next/image refuses SVG unless dangerouslyAllowSVG is set, and the default
      // header mark is an SVG, so a plain img is used for every logo here.
      shouldUseNextImage: false,
    },
  };
};

export const HomarrLogo = ({ size }: LogoProps) => {
  const brand = useBrandLogo();
  return <Logo size={size} {...brand.image} />;
};

interface CommonLogoWithTitleProps {
  size: LogoWithTitleProps["size"];
  hideTitleOnMobile?: boolean;
}

export const HomarrLogoWithTitle = ({ size, hideTitleOnMobile }: CommonLogoWithTitleProps) => {
  const brand = useBrandLogo();
  return <LogoWithTitle size={size} title={brand.title} image={brand.image} hideTitleOnMobile={hideTitleOnMobile} />;
};
