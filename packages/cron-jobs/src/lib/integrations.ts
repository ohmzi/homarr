/**
 * Turns a stored integration into something the integration classes accept.
 *
 * Cron jobs read integrations straight out of the database rather than through a widget, so this
 * is the one place that knows a row's secrets arrive encrypted and have to be decrypted before a
 * client can be built from them.
 */
import { decryptSecret } from "@homarr/common/server";
import type { IntegrationSecretKind } from "@homarr/definitions";

/**
 * An integration row as the queries below return it: the record plus its still-encrypted secrets.
 * The value is the stored `iv.ciphertext` shape the secret columns are typed with, which is what
 * keeps it distinct from an already-decrypted secret.
 */
export interface IntegrationWithSecrets {
  id: string;
  name: string;
  url: string;
  secrets: { kind: IntegrationSecretKind; value: `${string}.${string}` }[];
}

export const toIntegrationInput = (integration: IntegrationWithSecrets) => ({
  id: integration.id,
  name: integration.name,
  url: integration.url,
  externalUrl: null,
  decryptedSecrets: integration.secrets.map((secret) => ({
    kind: secret.kind,
    value: decryptSecret(secret.value),
  })),
});

/** Prefer a service pointed at this machine; a homelab can easily have several. */
export const isLocalUrl = (url: string) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url);
