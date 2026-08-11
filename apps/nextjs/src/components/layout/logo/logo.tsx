import type { ReactNode } from "react";
import Image from "next/image";
import type { TitleOrder } from "@mantine/core";
import { Group, Title } from "@mantine/core";

interface LogoProps {
  size: number;
  src: string;
  alt: string;
  shouldUseNextImage?: boolean;
}

export const Logo = ({ size = 60, shouldUseNextImage = false, src, alt }: LogoProps) =>
  shouldUseNextImage ? (
    <Image className="logo" src={src} alt={alt} width={size} height={size} />
  ) : (
    // we only want to use next/image for logos that we are sure will be preloaded and are allowed
    // eslint-disable-next-line @next/next/no-img-element
    <img className="logo" src={src} alt={alt} width={size} height={size} />
  );

/**
 * Brand lockup scale, shared with ohmz-cloud and OhmzAI.
 *
 * The name is 24px everywhere and the mark is 1.25x that (30px), the same
 * mark-to-text ratio ohmz-cloud/src/components/Wordmark.astro uses. `titleOrder`
 * now only picks the heading level for semantics — the visual size comes from
 * .ohmz-lockup-title so every lockup lands on the same number regardless of
 * which heading level the surrounding page needs.
 */
const logoWithTitleSizes = {
  lg: { logoSize: 30, titleOrder: 1 },
  md: { logoSize: 30, titleOrder: 2 },
  sm: { logoSize: 24, titleOrder: 3 },
} satisfies Record<string, { logoSize: number; titleOrder: TitleOrder }>;

export interface LogoWithTitleProps {
  size: keyof typeof logoWithTitleSizes;
  /** A node rather than a string so the brand lockup can two-tone the wordmark. */
  title: ReactNode;
  image: Omit<LogoProps, "size">;
  hideTitleOnMobile?: boolean;
}

export const LogoWithTitle = ({ size, title, image, hideTitleOnMobile }: LogoWithTitleProps) => {
  const { logoSize, titleOrder } = logoWithTitleSizes[size];

  return (
    <Group gap={8} wrap="nowrap" className="ohmz-lockup">
      <Logo {...image} size={logoSize} />
      <Title
        order={titleOrder}
        visibleFrom={hideTitleOnMobile ? "sm" : undefined}
        textWrap="nowrap"
        className="ohmz-lockup-title"
      >
        {title}
      </Title>
    </Group>
  );
};
