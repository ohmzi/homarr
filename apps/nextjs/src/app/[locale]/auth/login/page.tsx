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
    <Center component="main" mih="100dvh" px="md" py="xl" className="ohmz-auth-screen">
      {/* 28rem = Tailwind's max-w-md, the class the Ohmz AI auth form actually
          carries (build/_app/immutable/nodes/50.*.js). */}
      <Stack align="center" gap={4} w={448} maw="90vw">
        <Stack align="center" gap={24}>
          {/* Circular amber badge, as on the OhmzAI sign-in: the filled amber
              square with a centred omega, so a round crop lands the glyph dead
              centre without needing a separate asset.

              Served from its own filename rather than reusing /logo/logo.png.
              That path shipped the old Homarr mark for a long time, and
              replacing an image in place leaves every browser that already
              cached it showing the previous artwork indefinitely — a new URL is
              the only reliable way to retire it. */}
          <Box className="ohmz-auth-badge">
            <Logo size={96} src="/logo/ohmz-badge.png" alt={brandPageTitle} />
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
