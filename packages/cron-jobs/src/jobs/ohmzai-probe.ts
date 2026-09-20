import { env } from "@homarr/common/env";
import { EVERY_30_MINUTES } from "@homarr/cron-jobs-core/expressions";
import { createLogger } from "@homarr/core/infrastructure/logs";
import { ErrorWithMetadata } from "@homarr/core/infrastructure/logs/error";

import { createCronJob } from "../lib";
import { decideProbeAction } from "../lib/probe-decision";
import { recordProbeWindowAsync } from "../lib/probe-schedule";
import { getAnchorAsync } from "../lib/uptime-daily";

const logger = createLogger({ module: "ohmzAiProbeJob" });

/** This row is produced by Homarr rather than Uptime Kuma, so it has no integration id. */
const SOURCE_ID = "ohmzai";
const MONITOR_ID = "ohmzai";
const MONITOR_NAME = "Ohmz AI";

const source = { sourceId: SOURCE_ID, monitorId: MONITOR_ID, monitorName: MONITOR_NAME };

/**
 * The identity the probe signs in as.
 *
 * The public instance trusts an `X-Ohmz-Guest` header that only its nginx gate can set, so the
 * probe never supplies a password. The gate pins a guest to whatever 32-hex `ohmzgid` cookie the
 * request carries, so sending a constant keeps this one stable account instead of minting a
 * throwaway guest on every run — and it skips the cookie-less redirect hop on `/` as well.
 *
 * Every request must carry it, including the completion: the gate derives the header from the
 * cookie, and OpenWebUI rejects a token whose identity does not match the header with
 * "User mismatch. Please sign in again."
 */
const GUEST_ID = "0badc0de5eedface0badc0de5eedface";
const GUEST_COOKIE = `ohmzgid=${GUEST_ID}`;
/** Must mirror the gate's mapping; only used to fill in a request body that is never consulted. */
const GUEST_EMAIL = `guest-${GUEST_ID}@public.ohmz.cloud`;

/**
 * Deliberately below Cloudflare's ~100s edge timeout. The probe reaches the instance through the
 * public hostname, so a longer budget would not buy a slower answer — Cloudflare would cut the
 * request first and the failure would read as an edge error rather than the model's behaviour.
 */
const REQUEST_TIMEOUT_MS = 90_000;

const PROMPT = "Reply with exactly: PONG";
/** Matched case-insensitively against the whole reply. */
const EXPECTED_ANSWER = "pong";

const requestAsync = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) =>
  fetch(url, {
    ...init,
    headers: { ...init?.headers, cookie: GUEST_COOKIE },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

const signInAsync = async (baseUrl: string) => {
  const response = await requestAsync(`${baseUrl}/api/v1/auths/signin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // The gate's header is the real identity. This body only satisfies the request schema, and
    // the password is never consulted — verified against the running instance.
    body: JSON.stringify({ email: GUEST_EMAIL, password: "probe" }),
  });

  if (!response.ok) throw new Error(`sign-in failed with status ${response.status}`);

  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== "string") throw new Error("sign-in returned no token");

  return body.token;
};

/**
 * A guest sees an empty model list, so the model has to come from configuration. Returning null
 * rather than throwing keeps "I do not know which model to ask" distinct from "the service is
 * down" — a misconfigured probe should not paint the row red.
 */
const resolveModelAsync = async (baseUrl: string, token: string) => {
  if (env.OHMZAI_MODEL) return env.OHMZAI_MODEL;

  const response = await requestAsync(`${baseUrl}/api/models`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;

  const body = (await response.json()) as { data?: { id?: unknown }[] };
  const first = body.data?.[0]?.id;

  return typeof first === "string" ? first : null;
};

/**
 * Reads a server-sent-event completion body and assembles the streamed answer.
 *
 * Chunks are buffered rather than split per-read: a `data:` line can straddle a chunk boundary,
 * and parsing the fragments independently would silently drop part of the reply — which would
 * then look like the model failing to answer.
 */
const readAnswerAsync = async (body: ReadableStream<Uint8Array>) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let answer = "";
  let buffer = "";

  const consumeLine = (line: string) => {
    if (!line.startsWith("data:")) return;

    const payload = line.slice(5).trim();
    if (payload === "[DONE]") return;

    try {
      answer +=
        (JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content ?? "";
    } catch {
      // A single unparseable chunk is not fatal on its own — the answer check decides.
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Hold the trailing partial line back until the rest of it arrives.
    buffer = lines.pop() ?? "";
    lines.forEach(consumeLine);
  }

  if (buffer.length > 0) consumeLine(buffer);

  return answer;
};

const askAsync = async (baseUrl: string, token: string, model: string) => {
  const response = await requestAsync(`${baseUrl}/api/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    // Streamed, because that is the path the chat UI itself uses. A proxy that buffers or breaks
    // server-sent events would answer a non-streamed request happily.
    body: JSON.stringify({ model, messages: [{ role: "user", content: PROMPT }], stream: true }),
  });

  if (!response.ok) throw new Error(`completion failed with status ${response.status}`);
  if (!response.body) throw new Error("completion returned no stream");

  const answer = await readAnswerAsync(response.body);

  // A 2xx with any body at all is not proof the model ran. Requiring the instruction to have been
  // followed is what actually establishes that inference worked end to end.
  if (!answer.toLowerCase().includes(EXPECTED_ANSWER)) {
    throw new Error(`completion did not contain the expected answer: ${JSON.stringify(answer.trim().slice(0, 80))}`);
  }

  return answer;
};

type ProbeOutcome =
  | { kind: "up"; reply: string }
  | { kind: "down"; reason: string }
  | { kind: "skipped"; reason: string };

/**
 * Asks the public Ohmz AI instance a question and requires the model to have answered it, so the
 * check covers the guest gate, sign-in, model load and inference rather than whether the port
 * answers. A `200` carrying an error string does not pass.
 *
 * Probing the public hostname rather than the loopback gate means Cloudflare and the tunnel are
 * part of what is measured — that is the path a visitor actually takes, and the trade accepted
 * with it is that an edge outage reads as an outage here too.
 */
const runProbeAsync = async (): Promise<ProbeOutcome> => {
  const baseUrl = env.OHMZAI_URL ?? "https://aipublic.ohmz.cloud";

  try {
    const token = await signInAsync(baseUrl);
    const model = await resolveModelAsync(baseUrl, token);

    if (model === null) {
      return { kind: "skipped", reason: "no model could be resolved; set OHMZAI_MODEL" };
    }

    const reply = await askAsync(baseUrl, token, model);

    return { kind: "up", reply: reply.trim().slice(0, 60) };
  } catch (cause) {
    logger.error(new ErrorWithMetadata("Ohmz AI probe failed", { url: baseUrl }, { cause }));
    return { kind: "down", reason: cause instanceof Error ? cause.message : String(cause) };
  }
};

export const ohmzaiProbeJob = createCronJob("ohmzaiProbe", EVERY_30_MINUTES, {
  runOnStart: true,
  // The retry policy is expressed in ticks against a 30-minute grid, so changing the interval
  // from the tasks UI would silently change how many attempts a window gets. The cadence is
  // configured here instead.
  preventCustomInterval: true,
  // Runs on a 30-minute tick but the probe itself can spend the full timeout on a cold model
  // load, so without this the job would warn on a successful run.
  expectedMaximumDurationInMillis: REQUEST_TIMEOUT_MS + 20_000,
}).withCallback(async () => {
  const now = new Date();
  const anchor = await getAnchorAsync(SOURCE_ID, MONITOR_ID);
  const action = decideProbeAction({ now, anchor });

  if (action.kind === "skip") return;

  if (action.kind === "concede") {
    await recordProbeWindowAsync({ source, window: action.window, isUp: false, at: now });
    logger.warn("Conceded the whole window after every attempt failed", { url: env.OHMZAI_URL });
    return;
  }

  const outcome = await runProbeAsync();

  // Warn rather than debug: the URL is configured, so this is a probe that cannot run rather
  // than one that was never set up, and the row silently never appearing is easy to miss.
  if (outcome.kind === "skipped") {
    logger.warn("Ohmz AI probe cannot run", { reason: outcome.reason });
    return;
  }

  if (outcome.kind === "up") {
    await recordProbeWindowAsync({ source, window: action.window, isUp: true, at: now });
    logger.info("Ohmz AI probe succeeded", { reply: outcome.reply });
    return;
  }

  // A failed attempt records nothing: the next tick is the retry, and the window's verdict is
  // written once, whichever way it goes. The exception is a monitor with no history, whose single
  // sample settles the window because it has no retry to fall back on.
  if (action.decideOnFailure) {
    await recordProbeWindowAsync({ source, window: action.window, isUp: false, at: now });
    logger.warn("First observation failed, conceding the window", { reason: outcome.reason });
    return;
  }

  logger.warn("Ohmz AI probe failed, will retry on the next tick", { attempt: action.attempt, reason: outcome.reason });
});
