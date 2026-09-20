import { randomBytes } from "crypto";
import { z } from "zod/v4";

import { createBooleanSchema, createEnv } from "@homarr/core/infrastructure/env";

const errorSuffix = `, please generate a 64 character secret in hex format or use the following: "${randomBytes(32).toString("hex")}"`;

export const env = createEnv({
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  server: {
    SECRET_ENCRYPTION_KEY: z
      .string({
        error: `SECRET_ENCRYPTION_KEY is required${errorSuffix}`,
      })
      .min(64, {
        message: `SECRET_ENCRYPTION_KEY has to be 64 characters${errorSuffix}`,
      })
      .max(64, {
        message: `SECRET_ENCRYPTION_KEY has to be 64 characters${errorSuffix}`,
      })
      .regex(/^[0-9a-fA-F]{64}$/, {
        message: `SECRET_ENCRYPTION_KEY must only contain hex characters${errorSuffix}`,
      }),
    NO_EXTERNAL_CONNECTION: createBooleanSchema(false),
    // Optional. The Ohmz AI uptime probe reaches a guest instance and asks the model a question,
    // so it needs to know which instance to reach. It signs in as a guest rather than with an
    // account, so there is no password to configure.
    OHMZAI_URL: z.string().optional(),
    // A guest is not shown the model list, so the probe cannot discover one. When this is unset
    // the probe falls back to the instance's own list and gives up quietly if that is empty —
    // "I do not know which model to ask" is a misconfiguration, not an outage.
    OHMZAI_MODEL: z.string().optional(),
  },
  runtimeEnv: {
    SECRET_ENCRYPTION_KEY: process.env.SECRET_ENCRYPTION_KEY,
    NODE_ENV: process.env.NODE_ENV,
    NO_EXTERNAL_CONNECTION: process.env.NO_EXTERNAL_CONNECTION,
    OHMZAI_URL: process.env.OHMZAI_URL,
    OHMZAI_MODEL: process.env.OHMZAI_MODEL,
  },
});
