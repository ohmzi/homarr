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
    // Optional. The OpenWebUI uptime probe logs in and asks the model a question, so it
    // needs an account; the probe is skipped entirely when these are unset.
    OPENWEBUI_URL: z.string().optional(),
    OPENWEBUI_EMAIL: z.string().optional(),
    OPENWEBUI_PASSWORD: z.string().optional(),
    OPENWEBUI_MODEL: z.string().optional(),
  },
  runtimeEnv: {
    SECRET_ENCRYPTION_KEY: process.env.SECRET_ENCRYPTION_KEY,
    NODE_ENV: process.env.NODE_ENV,
    NO_EXTERNAL_CONNECTION: process.env.NO_EXTERNAL_CONNECTION,
    OPENWEBUI_URL: process.env.OPENWEBUI_URL,
    OPENWEBUI_EMAIL: process.env.OPENWEBUI_EMAIL,
    OPENWEBUI_PASSWORD: process.env.OPENWEBUI_PASSWORD,
    OPENWEBUI_MODEL: process.env.OPENWEBUI_MODEL,
  },
});
