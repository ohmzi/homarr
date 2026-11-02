import { z } from "zod";

/** Uptime Kuma's raw heartbeat status codes, as the status page heartbeat endpoint reports them. */
export const uptimeKumaHeartbeatStatus = {
  down: 0,
  up: 1,
  pending: 2,
  maintenance: 3,
} as const;

export type UptimeKumaMonitorStatus = "up" | "down" | "pending" | "maintenance" | "stale" | "unknown";

export const uptimeKumaMaxHeartbeats = 50;

const monitorStatusByHeartbeatCode: Record<number, UptimeKumaMonitorStatus> = {
  0: "down",
  1: "up",
  2: "pending",
  3: "maintenance",
};

export const toUptimeKumaMonitorStatus = (heartbeatCode: number): UptimeKumaMonitorStatus =>
  monitorStatusByHeartbeatCode[heartbeatCode] ?? "unknown";

export const uptimeKumaIncidentStyles = ["info", "warning", "danger", "primary", "light", "dark"] as const;
export type UptimeKumaIncidentStyle = (typeof uptimeKumaIncidentStyles)[number];

const tagSchema = z.object({
  name: z.string(),
  color: z.string().nullish(),
  value: z.string().nullish(),
});

const statusPageMonitorSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string().nullish(),
  url: z.string().nullish(),
  tags: z.array(tagSchema).nullish(),
  certExpiryDaysRemaining: z.union([z.number(), z.string()]).nullish(),
  validCert: z.boolean().nullish(),
});

const statusPageGroupSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  monitorList: z.array(statusPageMonitorSchema),
});

const incidentSchema = z.object({
  id: z.number().int(),
  title: z.string().nullish(),
  content: z.string().nullish(),
  style: z.string().nullish(),
  createdDate: z.string().nullish(),
  lastUpdatedDate: z.string().nullish(),
});

const maintenanceSchema = z.object({
  id: z.number().int(),
  title: z.string().nullish(),
  description: z.string().nullish(),
});

export const uptimeKumaStatusPageResponseSchema = z.object({
  config: z.object({ title: z.string().nullish() }).nullish(),
  incident: incidentSchema.nullish(),
  incidents: z.array(incidentSchema).nullish(),
  maintenanceList: z.array(maintenanceSchema).nullish(),
  publicGroupList: z.array(statusPageGroupSchema),
});

export const uptimeKumaHeartbeatResponseSchema = z.object({
  heartbeatList: z.record(
    z.string(),
    z.array(z.object({ status: z.number().int(), time: z.string(), ping: z.number().nullish() })),
  ),
  uptimeList: z.record(z.string(), z.number()),
});

export type UptimeKumaStatusPageResponse = z.infer<typeof uptimeKumaStatusPageResponseSchema>;
export type UptimeKumaHeartbeatResponse = z.infer<typeof uptimeKumaHeartbeatResponseSchema>;

/**
 * A monitor with its raw heartbeat history (status code and Uptime Kuma's UTC time string), for
 * the uptime-status history job. The status page endpoint caps heartbeats at 100 per monitor.
 */
export interface UptimeKumaMonitorHeartbeats {
  id: number;
  name: string;
  heartbeats: UptimeKumaHeartbeatResponse["heartbeatList"][string];
}

export interface UptimeKumaHeartbeat {
  status: UptimeKumaMonitorStatus;
  time: number;
  ping: number | null;
}

export interface UptimeKumaTag {
  name: string;
  color: string | null;
  value: string | null;
}

export interface UptimeKumaMonitor {
  id: number;
  name: string;
  type: string | null;
  url: string | null;
  status: UptimeKumaMonitorStatus;
  uptime24h: number | null;
  ping: number | null;
  lastCheckAt: number | null;
  statusSince: number | null;
  certificateDaysRemaining: number | null;
  tags: UptimeKumaTag[];
  heartbeats: UptimeKumaHeartbeat[];
}

export interface UptimeKumaGroup {
  id: number;
  name: string;
  monitors: UptimeKumaMonitor[];
}

export interface UptimeKumaIncident {
  id: number;
  title: string;
  content: string | null;
  style: UptimeKumaIncidentStyle;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface UptimeKumaMaintenance {
  id: number;
  title: string;
  description: string | null;
}

export interface UptimeKumaStatusPage {
  title: string;
  url: string;
  groups: UptimeKumaGroup[];
  incidents: UptimeKumaIncident[];
  maintenances: UptimeKumaMaintenance[];
}
