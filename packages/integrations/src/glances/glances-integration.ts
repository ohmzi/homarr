import dayjs from "dayjs";
import { z } from "zod/v4";

import { ResponseError } from "@homarr/common/server";
import { fetchWithTrustedCertificatesAsync } from "@homarr/core/infrastructure/http";

import type { IntegrationInput, IntegrationTestingInput } from "../base/integration";
import { Integration } from "../base/integration";
import type { SessionStore } from "../base/session-store";
import { createSessionStore } from "../base/session-store";
import { TestConnectionError } from "../base/test-connection/test-connection-error";
import type { TestingResult } from "../base/test-connection/test-connection-service";
import type { ISystemHealthMonitoringIntegration } from "../interfaces/health-monitoring/health-monitoring-integration";
import type { SystemHealthMonitoring } from "../types";

export class GlancesIntegration extends Integration implements ISystemHealthMonitoringIntegration {
  private readonly sessionStore: SessionStore<{ version: string }>;

  constructor(integration: IntegrationInput) {
    super(integration);
    this.sessionStore = createSessionStore(integration);
  }

  public async getSystemInfoAsync(): Promise<SystemHealthMonitoring> {
    let session = await this.sessionStore.getAsync();

    if (session == null) {
      await this.sessionStore.setAsync({
        version: await this.getGlancesVersionAsync(),
      });

      // update the store to re-use the values below.
      session = await this.sessionStore.getAsync();
    }

    if (session == null) throw new Error("Session was unexpectitly null");

    const [stats, sensors] = await Promise.all([this.getAllStatsAsync(), this.getSensorsAsync()]);

    return {
      cpuUtilization: stats.cpu.total,
      memUsedInBytes: stats.mem.used,
      memAvailableInBytes: stats.mem.total - stats.mem.used,
      network: {
        down: stats.network.reduce((acc, net) => net.bytes_recv_rate_per_sec + acc, 0),
        up: stats.network.reduce((acc, net) => net.bytes_sent_rate_per_sec + acc, 0),
      },
      availablePkgUpdates: 0,
      version: session.version,
      fileSystem: stats.fs.map((fileSystem) => ({
        // Prefer a human-readable name: the alias set in glances.conf, else the
        // mount point. Falls back to the raw device, whose /dev/sdX letters are
        // not stable across reboots.
        deviceName: fileSystem.alias ?? fileSystem.mnt_point ?? fileSystem.device_name,
        used: `${fileSystem.used}`,
        available: `${fileSystem.free}`,
        percentage: fileSystem.percent,
      })),
      uptime: stats.uptime.as("seconds"),
      rebootRequired: false,
      cpuModelName: stats.quicklook?.cpu_name ?? "Unknown",
      loadAverage: null,
      smart: buildGlancesDiskSmartFromSensors(sensors, stats.fs),
      cpuTemp: parseGlancesCpuTempFromSensors(sensors),
      gpu: stats.gpu.map((gpu) => ({
        gpuId: gpu.gpu_id,
        name: gpu.name,
        memoryUtilization: gpu.mem ?? 0,
        processorUtilization: gpu.proc ?? 0,
        temperature: gpu.temperature ?? null,
        fanSpeed: gpu.fan_speed ?? null,
      })),
    };
  }

  private async getGlancesVersionAsync() {
    const response = await fetchWithTrustedCertificatesAsync(this.url("/api/4/version"));

    if (!response.ok) {
      throw new ResponseError(response);
    }

    return await response.text();
  }

  /**
   * Sensor readings, or an empty list.
   *
   * Temperatures are optional data, so a transport error or payload drift on /api/4/sensors
   * must not fail the whole getSystemInfoAsync() call - that would blank every widget fed by
   * this integration just because a fan reading changed shape.
   */
  private async getSensorsAsync(): Promise<z.infer<typeof sensorsSchema>> {
    try {
      const response = await fetchWithTrustedCertificatesAsync(this.url("/api/4/sensors"));

      if (!response.ok) {
        return [];
      }

      return await sensorsSchema.parseAsync(await response.json());
    } catch {
      return [];
    }
  }

  private async getAllStatsAsync() {
    const response = await fetchWithTrustedCertificatesAsync(this.url("/api/4/all"));

    if (!response.ok) {
      throw new ResponseError(response);
    }

    return allSchema.parseAsync(await response.json());
  }

  protected async testingAsync(_: IntegrationTestingInput): Promise<TestingResult> {
    const response = await fetchWithTrustedCertificatesAsync(this.url("/api/4/status"), {
      headers: { "User-Agent": "Homarr" },
    });

    if (!response.ok) {
      return TestConnectionError.StatusResult(response);
    }

    return { success: true };
  }
}

// Glances is written in python and uses the following code to format uptime:
// from datetime import datetime
// uptime = datetime.now() - datetime.fromtimestamp(1773395580)
// str(uptime).split(".")[0]
// This results in one of the following formats:
// - 71 days, 9:51:35
// - 1 day, 9:50:23
// - 9:51:24
// - 0:22:02
// - 0:00:17
// See https://github.com/nicolargo/glances/blob/4139b10c5c3a98afc67a19ae67d66d2d94d7db6a/glances/plugins/uptime/__init__.py#L58
const regex = /^(?:(?<days>\d+) days?, )?(?<hours>\d+):(?<minutes>\d+):(?<seconds>\d+)$/m;

const allSchema = z.object({
  cpu: z.object({
    total: z.number().min(0).max(100),
  }),
  mem: z.object({
    total: z.number().min(0),
    used: z.number().min(0),
    free: z.number().min(0),
  }),
  network: z.array(
    z.object({
      // A host with heavy container churn constantly gains and loses veth/br-
      // interfaces. On the first poll after one appears Glances has no rate for
      // it yet (missing or null), and a strict schema would reject the entire
      // payload - blanking every widget fed by this integration. Treat an
      // unusable rate as 0 rather than failing the whole response.
      bytes_sent_rate_per_sec: z.number().min(0).catch(0),
      bytes_recv_rate_per_sec: z.number().min(0).catch(0),
    }),
  ),
  fs: z.array(
    z.object({
      device_name: z.string(),
      mnt_point: z.string(),
      alias: z.string().optional(),
      used: z.number().min(0),
      free: z.number().min(0),
      percent: z.number().min(0).max(100),
    }),
  ),
  uptime: z
    .string()
    .regex(new RegExp(regex))
    .transform((uptime) => {
      const match = regex.exec(uptime);
      if (!match?.groups) {
        throw new Error(`Unable to parse uptime value '${uptime}' with regex.`);
      }

      const days = "days" in match.groups ? Number(match.groups.days) : undefined;
      const hours = "hours" in match.groups ? Number(match.groups.hours) : undefined;
      const minutes = "minutes" in match.groups ? Number(match.groups.minutes) : undefined;
      const seconds = "seconds" in match.groups ? Number(match.groups.seconds) : undefined;

      return dayjs.duration({ days, hours, minutes, seconds });
    }),
  quicklook: z
    .object({
      cpu_name: z.string(),
    })
    .optional(),
  gpu: z
    .array(
      z.object({
        gpu_id: z.string(),
        name: z.string(),
        mem: z.number().nullable().optional(),
        proc: z.number().nullable().optional(),
        temperature: z.number().nullable().optional(),
        fan_speed: z.number().nullable().optional(),
      }),
    )
    .default([]),
});

const sensorsSchema = z.array(
  z.object({
    label: z.string(),
    // Deliberately not z.number(): a spun-down or failing drive can report a non-numeric
    // sentinel instead of a temperature, and because this is one array a single such entry
    // would fail the whole parse - silently blanking every disk temperature and the CPU
    // ring at once. Callers coerce and skip rather than trusting the shape.
    value: z.union([z.number(), z.string()]),
    type: z.string().optional(),
  }),
);

/**
 * Sensor labels to prefer for the CPU reading, best first.
 *
 * This host's Super I/O reports `CPUTIN` and its cores report `Core 0` upward, so the two
 * upstream names alone matched nothing here and the function fell through to the first
 * reading it could find - an AUXTIN rail, which read 26C and would have looked like a
 * perfectly plausible CPU temperature while being unrelated to the CPU.
 */
const cpuTempLabelPriority = ["Package id 0", "CPU", "CPUTIN", "Core 0"] as const;

/**
 * Per-disk temperature, joined onto the filesystem list.
 *
 * Glances reports these under `temperature_hdd`, labelled with the bare kernel device
 * ("sda", "nvme0n1"). It does not carry the mount point, and the widget matches a
 * temperature to a disk by the same deviceName it prints on the card - the glances.conf
 * alias, else the mount point. So each reading is joined back to the filesystem entry
 * whose device it belongs to, partition suffix included: "/dev/sdi" has to find
 * "/dev/sdi1", and "/dev/nvme0n1" has to find "/dev/nvme0n1p2".
 *
 * These readings arrive over the loopback hddtemp bridge rather than from Glances' SMART
 * plugin, which refuses to run without root. `overallStatus` is deliberately left empty -
 * a temperature is not evidence about SMART health, and the card already renders an
 * absent status as "N/A" rather than asserting a pass we have not established.
 */
export const buildGlancesDiskSmartFromSensors = (
  sensors: z.infer<typeof sensorsSchema>,
  fileSystems: z.infer<typeof allSchema>["fs"],
) =>
  sensors
    .filter((sensor) => sensor.type === "temperature_hdd")
    .flatMap((sensor) => {
      // Coerced rather than trusted: a drive that is spinning up or unreachable reports a
      // sentinel here, and publishing that as a temperature would put a nonsense number on
      // the card. Dropping it leaves the card blank, which is honest.
      const celsius = Number(sensor.value);
      if (!Number.isFinite(celsius)) return [];

      const devicePath = `/dev/${sensor.label}`;

      // Every partition of this disk, not just the first. One physical drive can carry
      // several mounted filesystems - the 24TB disk here holds two backup targets and the
      // next-cloud partition - and each of those gets its own card, so each needs the
      // reading. Attaching it to only the first match would leave the others blank.
      return fileSystems
        .filter((candidate) => {
          if (candidate.device_name === devicePath) return true;
          const suffix = candidate.device_name.slice(devicePath.length);
          // Only a partition suffix counts, so /dev/sda never claims /dev/sdaa.
          return candidate.device_name.startsWith(devicePath) && /^p?[0-9]+$/.test(suffix);
        })
        .map((fileSystem) => ({
          deviceName: fileSystem.alias ?? fileSystem.mnt_point ?? fileSystem.device_name,
          temperature: Math.round(celsius),
          overallStatus: "",
          healthy: true,
        }));
    });

export const parseGlancesCpuTempFromSensors = (sensors: z.infer<typeof sensorsSchema>): number | undefined => {
  // Non-numeric readings are dropped up front, so neither the priority match nor the
  // fallback can select a sentinel and publish it as a CPU temperature.
  const temperatureSensors = sensors
    .filter((sensor) => sensor.type === "temperature_core" || sensor.type === "temperature")
    .map((sensor) => ({ label: sensor.label, value: Number(sensor.value) }))
    .filter((sensor) => Number.isFinite(sensor.value));

  for (const label of cpuTempLabelPriority) {
    const match = temperatureSensors.find((sensor) => sensor.label === label);
    if (match) {
      return match.value;
    }
  }

  // Last resort before the blind fallback: anything that looks like a CPU sensor. The
  // fallback below takes the first reading in the list, which on a board with a Super I/O
  // chip is reliably a bogus AUXTIN rail - this host reports -8C and 81C on those - so
  // preferring a named core keeps the ring honest.
  const namedCore = temperatureSensors.find((sensor) => /^Core [0-9]+$/.test(sensor.label));
  if (namedCore) {
    return namedCore.value;
  }

  const firstCore = temperatureSensors[0];
  if (firstCore) {
    return firstCore.value;
  }

  return undefined;
};

