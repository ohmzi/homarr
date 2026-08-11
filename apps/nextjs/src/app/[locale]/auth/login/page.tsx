import { redirect } from "next/navigation";
import { Alert, Card, Center, Code, Stack, Text, Title } from "@mantine/core";
import { IconLogin } from "@tabler/icons-react";

import { env } from "@homarr/auth/env";
import { auth } from "@homarr/auth/next";
import { getScopedI18n } from "@homarr/translation/server";
import { sanitizeRedirectionUrl } from "@homarr/validation/redirection-url";

import { env as appEnv } from "~/env";

import { HomarrLogoWithTitle } from "~/components/layout/logo/homarr-logo";
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
        <Stack align="center" gap="sm">
          <HomarrLogoWithTitle size="lg" />
          <Stack gap={4} align="center">
            <Title order={3} fw={500} ta="center">
              {t("title")}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {t("subtitle")}
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
        <Card w="100%" p="xl" radius="lg" withBorder className="ohmz-auth-card">
          <LoginForm
            providers={env.AUTH_PROVIDERS}
            oidcClientName={env.AUTH_OIDC_CLIENT_NAME}
            isOidcAutoLoginEnabled={env.AUTH_OIDC_AUTO_LOGIN}
            callbackUrl={searchParams.callbackUrl ?? "/"}
          />
        </Card>
      </Stack>
    </Center>
  );
}
