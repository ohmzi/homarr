import { redirect } from "next/navigation";
import { Alert, Box, Center, Code, Stack, Text, Title } from "@mantine/core";
import { IconLogin } from "@tabler/icons-react";

import { env } from "@homarr/auth/env";
import { auth } from "@homarr/auth/next";
import { sanitizeRedirectionUrl } from "@homarr/validation/redirection-url";

import { env as appEnv } from "~/env";

import { BrandWordmark } from "~/components/layout/logo/homarr-logo";
import { Logo } from "~/components/layout/logo/logo";
import { brandPageTitle } from "~/metadata";
import { LoginForm } from "./_login-form";

interface LoginProps {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
}

export default async function Login(props: LoginProps) {
  const searchParams = await props.searchParams;
  const session = await auth();

  if (session) {
    redirect(sanitizeRedirectionUrl(searchParams.callbackUrl));
  }

  return (
    // mih fills the viewport so the card is optically centred instead of
    // stranded at the top with dead space under it.
    <Center component="main" mih="100dvh" px={40} py="xl" className="ohmz-auth-screen">
      {/* pb=141 is not decoration. Ohmz AI's card measures 551px tall and is
          vertically centred, so its logo lands at (100vh - 551) / 2. This block
          is only ~410px — it has no sign-up row, no guest button and no caption
          — so the same centring put it ~70px lower. Padding it out to the same
          551px total makes identical centring produce an identical position,
          rather than nudging it with an offset that would only hold at one
          viewport height. Ohmz AI uses the same device on its own card (pb-10).

          Ohmz AI's card is `w-full sm:max-w-md` inside a `px-10` container: full
          width on mobile with 40px of page padding, capped at 28rem only from the
          sm breakpoint up. A fixed width with maw="90vw" is NOT the same thing —
          it left the fields ~40px wider per side on a phone. */}
      <Stack align="center" gap={18} w="100%" maw={448} pb={141}>
        <Stack align="center" gap={24}>
          {/* Circular amber badge, as on the OhmzAI sign-in: the filled amber
              square with a centred omega, so a round crop lands the glyph dead
              centre without needing a separate asset.

              The filename carries a hash of the file's own bytes. This is the
              SAME artwork Ohmz AI serves (identical md5 to its favicon.png), and
              a content-addressed name means the URL changes whenever the bytes
              do — so a browser can never serve a stale mark. Replacing an image
              in place does not work: every browser that already
              cached it showing the previous artwork indefinitely — a new URL is
              the only reliable way to retire it. */}
          <Box className="ohmz-auth-badge">
            <Logo size={96} src="/logo/ohmz-badge.1b89078f.png" alt={brandPageTitle} />
          </Box>
          {/* The brand name alone, matching the OhmzAI heading. */}
          <Title order={2} className="ohmz-auth-heading" ta="center">
            <BrandWordmark />
          </Title>
        </Stack>
        {appEnv.DEMO_MODE && (
          <Alert icon={<IconLogin size={18} />} color="blue" variant="light" w="100%">
            <Text size="sm" fw={500}>
              Demo mode is enabled. Sign in with username <Code>demo</Code> and password <Code>demo</Code>
            </Text>
          </Alert>
        )}
        {/* Card-free: the form sits straight on the canvas, matching OhmzAI. */}
        <Box w="100%">
          <LoginForm
            providers={env.AUTH_PROVIDERS}
            oidcClientName={env.AUTH_OIDC_CLIENT_NAME}
            isOidcAutoLoginEnabled={env.AUTH_OIDC_AUTO_LOGIN}
            callbackUrl={searchParams.callbackUrl ?? "/"}
          />
        </Box>
      </Stack>
    </Center>
  );
}
