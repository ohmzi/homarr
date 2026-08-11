import { redirect } from "next/navigation";
import { Alert, Box, Center, Code, Stack, Text, Title } from "@mantine/core";
import { IconLogin } from "@tabler/icons-react";

import { getRscServerSettingsAsync } from "@homarr/api/server-settings-server";
import { env } from "@homarr/auth/env";
import { auth } from "@homarr/auth/next";
import { defaultBrandingSettings } from "@homarr/server-settings";
import { sanitizeRedirectionUrl } from "@homarr/validation/redirection-url";

import { env as appEnv } from "~/env";

import { BrandWordmark } from "~/components/layout/logo/homarr-logo";
import { Logo } from "~/components/layout/logo/logo";
import { brandPageTitle } from "~/metadata";
import { LoginForm } from "./_login-form";

interface LoginProps {
  searchParams: Promise<{
    callbackUrl?: string;
    redirect?: string;
  }>;
}

export default async function Login(props: LoginProps) {
  const [searchParams, session] = await Promise.all([props.searchParams, auth()]);
  const redirectUrl = sanitizeRedirectionUrl(searchParams.redirect ?? searchParams.callbackUrl);

  if (session) {
    redirect(redirectUrl);
  }

  const serverSettings = await getRscServerSettingsAsync();
  const branding = serverSettings.branding;
  const showCustomGreeting = branding.authBranding.showGreeting && branding.greeting.length > 0;
  const isDefaultName = branding.appName === defaultBrandingSettings.appName;

  return (
    // mih fills the viewport so the block is optically centred instead of
    // stranded at the top with dead space under it.
    <Center component="main" mih="100dvh" px={40} py="xl" className="ohmz-auth-screen">
      <Stack align="center" gap={18} w="100%" maw={448} pb={141}>
        <Stack align="center" gap={24}>
          {branding.authBranding.showLogo && (
            <Box className="ohmz-auth-badge">
              <Logo size={96} src={branding.logoImageUrl ?? "/logo/ohmz-badge.png"} alt={branding.appName} />
            </Box>
          )}
          {branding.authBranding.showAppName && (
            <Title order={2} className="ohmz-auth-heading" ta="center">
              {isDefaultName ? <BrandWordmark /> : branding.appName}
            </Title>
          )}
        </Stack>
        {showCustomGreeting && (
          <Text c="dimmed" ta="center">
            {branding.greeting}
          </Text>
        )}
        {appEnv.DEMO_MODE ? (
          <Alert icon={<IconLogin size={18} />} color="blue" variant="light" w="100%">
            <Text size="sm" fw={500}>
              Demo mode is enabled. Sign in with username <Code>demo</Code> and password <Code>demo</Code>
            </Text>
          </Alert>
        ) : null}
        <Box w="100%">
          <LoginForm
            providers={env.AUTH_PROVIDERS}
            oidcClientName={env.AUTH_OIDC_CLIENT_NAME}
            isOidcAutoLoginEnabled={env.AUTH_OIDC_AUTO_LOGIN}
            callbackUrl={redirectUrl}
          />
        </Box>
      </Stack>
    </Center>
  );
}
