import { redirect } from "next/navigation";
import { Alert, Box, Center, Code, Stack, Text, Title } from "@mantine/core";
import { IconLogin } from "@tabler/icons-react";

import { env } from "@homarr/auth/env";
import { auth } from "@homarr/auth/next";
import { getScopedI18n } from "@homarr/translation/server";
import { sanitizeRedirectionUrl } from "@homarr/validation/redirection-url";

import { env as appEnv } from "~/env";

import { BrandWordmark } from "~/components/layout/logo/homarr-logo";
import { Logo } from "~/components/layout/logo/logo";
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

  const t = await getScopedI18n("user.page.login");

  return (
    // mih fills the viewport so the card is optically centred instead of
    // stranded at the top with dead space under it.
    <Center component="main" mih="100dvh" px="md" py="xl" className="ohmz-auth-screen">
      <Stack align="center" gap="xl" w={64 * 6} maw="90vw">
        <Stack align="center" gap="lg">
          {/* Circular amber badge, as on the OhmzAI sign-in. logo.png is the
              filled amber square with a centred omega, so a round crop lands
              the glyph dead centre without needing a separate asset. */}
          <Box className="ohmz-auth-badge">
            <Logo size={84} src="/logo/logo.png" alt="Ohmz HomeLab" />
          </Box>
          <Stack gap={6} align="center">
            <Title order={2} className="ohmz-auth-heading" ta="center">
              <BrandWordmark />
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {t("title")}
            </Text>
          </Stack>
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
