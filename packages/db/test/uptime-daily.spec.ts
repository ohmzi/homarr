import { expect, test } from "vitest";

import * as postgresqlSchema from "../schema/postgresql";
import * as sqliteSchema from "../schema/sqlite";

test("exposes the uptime_daily table added by the fork in both dialects", () => {
  expect(Object.keys(sqliteSchema)).toContain("uptimeDaily");
  expect(Object.keys(postgresqlSchema)).toContain("uptimeDaily");

  expect(Object.keys(sqliteSchema.uptimeDaily)).toEqual(
    expect.arrayContaining(["sourceId", "monitorId", "monitorName", "date", "upSeconds", "downSeconds", "lastBeatAt"]),
  );
});
