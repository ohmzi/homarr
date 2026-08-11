"use client";

import { useRequiredBoard } from "@homarr/boards/context";
import { useSettings } from "@homarr/settings";

import { homarrLogoPath } from "./constants";
import { useBrandTitle } from "./homarr-logo";
import type { LogoWithTitleProps } from "./logo";
import { Logo, LogoWithTitle } from "./logo";

interface LogoProps {
  size: number;
}

const useImageOptions = () => {
  const board = useRequiredBoard();
  const { branding } = useSettings();
  return {
    src: board.logoImageUrl?.trim() || branding.logoImageUrl?.trim() || homarrLogoPath,
    alt: "Board logo",
    shouldUseNextImage: false,
  };
};

export const BoardLogo = ({ size }: LogoProps) => {
  const imageOptions = useImageOptions();
  return <Logo size={size} {...imageOptions} />;
};

interface CommonLogoWithTitleProps {
  size: LogoWithTitleProps["size"];
  hideTitleOnMobile?: boolean;
}

export const BoardLogoWithTitle = ({ size, hideTitleOnMobile }: CommonLogoWithTitleProps) => {
  const board = useRequiredBoard();
  const brandTitle = useBrandTitle();
  const imageOptions = useImageOptions();
  return (
    <LogoWithTitle
      size={size}
      hideTitleOnMobile={hideTitleOnMobile}
      // A board's own page title is user content and stays as typed; only the
      // fallback gets the two-tone brand lockup.
      title={board.pageTitle ?? brandTitle}
      image={imageOptions}
    />
  );
};
