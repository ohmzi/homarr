import { env } from "@homarr/common/env";
import { EVERY_DAY } from "@homarr/cron-jobs-core/expressions";
import { createLogger } from "@homarr/core/infrastructure/logs";
import { ErrorWithMetadata } from "@homarr/core/infrastructure/logs/error";

import { createCronJob } from "../lib";
import { addRangeAsync, addToDayAsync, getAnchorAsync, toDateKey } from "../lib/uptime-daily";

const logger = createLogger({ module: "openWebUiProbeJob" });

/** This row is produced by Homarr rather than Uptime Kuma, so it has no integration id. */
const SOURCE_ID = "openwebui";
const MONITOR_ID = "openwebui";
const MONITOR_NAME = "OpenWebUI";

/**
 * A result stays current for this long, so a container restart does not wake the model again.
 * Slightly under a day, so a probe that runs a little early each day is not skipped.
 */
const MIN_HOURS_BETWEEN_PROBES = 20;

/**
 * A cold model load is the entire point of this check, so the timeout has to absorb one -
 * a tight timeout would report a perfectly healthy model as an outage.
 */
const REQUEST_TIMEOUT_MS = 180_000;

const PROMPT = "Reply with exactly: PONG";
/** Matched case-insensitively against the whole reply. */
const EXPECTED_ANSWER = "pong";

const requestAsync = (url: string, init: RequestInit) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

const signInAsync = async (baseUrl: string, email: string, password: string) => {
  const response = await requestAsync(`${baseUrl}/api/v1/auths/signin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) throw new Error(`sign-in failed with status ${response.status}`);

  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== "string") throw new Error("sign-in returned no token");

  return body.token;
};

const resolveModelAsync = async (baseUrl: string, token: string, preferred: string | undefined) => {
  if (preferred) return preferred;

  const response = await requestAsync(`${baseUrl}/api/models`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error(`listing models failed with status ${response.status}`);

  const body = (await response.json()) as { data?: { id?: unknown }[] };
  const first = body.data?.[0]?.id;
  if (typeof first !== "string") throw new Error("no model is available to probe with");

  return first;
};

/**
 * Reads a server-sent-event completion body and assembles the streamed answer.
 *
 * Chunks are buffered rather than split per-read: a `data:` line can straddle a chunk
 * boundary, and parsing the fragments independently would silently drop part of the reply -
 * which would then look like the model failing to answer.
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
      // A single unparseable chunk is not fatal on its own - the answer check decides.
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
    // Streamed, because that is the path the chat UI itself uses. A proxy that buffers or
    // breaks server-sent events would answer a non-streamed request happily.
    body: JSON.stringify({ model, messages: [{ role: "user", content: PROMPT }], stream: true }),
  });

  if (!response.ok) throw new Error(`completion failed with status ${response.status}`);
  if (!response.body) throw new Error("completion returned no stream");

  const answer = await readAnswerAsync(response.body);

  // A 2xx with any body at all is not proof the model ran. Requiring the instruction to
  // have been followed is what actually establishes that inference worked end to end.
  if (!answer.toLowerCase().includes(EXPECTED_ANSWER)) {
    throw new Error(`completion did not contain the expected answer: ${JSON.stringify(answer.trim().slice(0, 80))}`);
  }

  return answer;
};

/**
 * Probes OpenWebUI by logging in and actually asking the model a question, so the check
 * covers auth, model load and inference rather than just whether the port answers.
 *
 * Runs from Homarr rather than Uptime Kuma because Homarr shares the host network and can
 * reach 127.0.0.1:4567, which the firewall does not expose to the Kuma container.
 */
export const openWebUiProbeJob = createCronJob("openWebUiProbe", EVERY_DAY, {
  runOnStart: true,
  // A cold model load is the point of this check, so it legitimately runs far longer than
  // the default budget. Without this the job warns on every successful run.
  expectedMaximumDurationInMillis: REQUEST_TIMEOUT_MS + 20_000,
}).withCallback(async () => {
  const baseUrl = env.OPENWEBUI_URL ?? "http://127.0.0.1:4567";
  const { OPENWEBUI_EMAIL: email, OPENWEBUI_PASSWORD: password } = env;

  if (!email || !password) {
    logger.debug("OpenWebUI probe is not configured, skipping");
    return;
  }

  const now = new Date();
  const anchor = await getAnchorAsync(SOURCE_ID, MONITOR_ID);

  if (anchor && now.getTime() - anchor.getTime() < MIN_HOURS_BETWEEN_PROBES * 60 * 60 * 1000) {
    logger.debug("OpenWebUI probe ran recently, skipping");
    return;
  }

  let isUp = false;
  try {
    const token = await signInAsync(baseUrl, email, password);
    const model = await resolveModelAsync(baseUrl, token, env.OPENWEBUI_MODEL);
    const content = await askAsync(baseUrl, token, model);
    isUp = true;
    logger.info("OpenWebUI probe succeeded", { model, reply: content.trim().slice(0, 60) });
  } catch (cause) {
    logger.error(new ErrorWithMetadata("OpenWebUI probe failed", { url: baseUrl }, { cause }));
  }

  const source = { sourceId: SOURCE_ID, monitorId: MONITOR_ID, monitorName: MONITOR_NAME };

  // The result covers the stretch since the previous probe, which is the same
  // backward-looking model the host row uses. On the very first run there is no stretch to
  // cover, so only the anchor is recorded and the day stays grey until the next probe.
  if (anchor === null) {
    await addToDayAsync({ ...source, date: toDateKey(now), upSeconds: 0, downSeconds: 0, lastBeatAt: now });
    return;
  }

  const seconds = (now.getTime() - anchor.getTime()) / 1000;
  await addRangeAsync({
    ...source,
    from: anchor,
    to: now,
    upSeconds: isUp ? seconds : 0,
    downSeconds: isUp ? 0 : seconds,
    lastBeatAt: now,
  });
});
