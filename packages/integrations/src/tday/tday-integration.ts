import { ResponseError } from "@homarr/common/server";
import { fetchWithTrustedCertificatesAsync } from "@homarr/core/infrastructure/http";
import { createLogger } from "@homarr/core/infrastructure/logs";

import type { IntegrationTestingInput } from "../base/integration";
import { Integration } from "../base/integration";
import { TestConnectionError } from "../base/test-connection/test-connection-error";
import type { TestingResult } from "../base/test-connection/test-connection-service";
import {
  tdayFloatersResponseSchema,
  tdayListsResponseSchema,
  tdaySessionResponseSchema,
  tdayTodosResponseSchema,
} from "./tday-types";
import type { TdayList, TdayPriority, TdayTask, TdayTaskKind, TdayTaskView } from "./tday-types";

const logger = createLogger({ module: "tdayIntegration" });

export class TdayIntegration extends Integration {
  protected async testingAsync(input: IntegrationTestingInput): Promise<TestingResult> {
    const response = await input.fetchAsync(this.url("/api/auth/session"), {
      headers: { Authorization: `Bearer ${this.getSecretValue("apiKey")}` },
    });

    if (!response.ok) return TestConnectionError.StatusResult(response);

    tdaySessionResponseSchema.parse(await response.json());
    return { success: true };
  }

  /**
   * Returns the tasks for the requested view, scoped to the user that owns the API key:
   * - today: dated todos due on the user's current local date
   * - scheduled: dated todos that are not overdue (due now or later)
   * - overdue: dated todos whose due time has passed
   * - floater: incomplete floaters (no due date)
   */
  public async getTasksAsync(view: TdayTaskView): Promise<TdayTask[]> {
    const listMetaById = new Map((await this.getListsAsync(view)).map((list) => [list.id, list]));
    const listMeta = (listId: string | null | undefined) => {
      const meta = listId ? listMetaById.get(listId) : undefined;
      return {
        listId: listId ?? null,
        listName: meta?.name ?? null,
        listIconKey: meta?.iconKey ?? null,
        listColor: meta?.color ?? null,
      };
    };

    if (view === "floater") {
      const { floaters } = tdayFloatersResponseSchema.parse(await this.requestAsync("/api/floater"));
      return floaters
        .filter((floater) => !floater.completed)
        .map((floater) => ({
          id: floater.id,
          title: floater.title,
          priority: floater.priority,
          due: null,
          instanceDate: null,
          completed: floater.completed,
          kind: "floater" as const,
          ...listMeta(floater.listID),
        }));
    }

    const mapTodo = (todo: { id: string; title: string; priority: string; due?: string | null; instanceDate?: string | null; completed: boolean; listID?: string | null }) => ({
      id: todo.id,
      title: todo.title,
      priority: todo.priority,
      due: todo.due ?? null,
      instanceDate: todo.instanceDate ?? null,
      completed: todo.completed,
      kind: "todo" as const,
      ...listMeta(todo.listID),
    });

    if (view === "overdue") {
      const { todos } = tdayTodosResponseSchema.parse(await this.requestAsync("/api/todo/overdue"));
      return todos.filter((todo) => !todo.completed).map(mapTodo);
    }

    const timeZone = await this.getTimeZoneAsync();
    const { dateStr, dateTimeStr } = nowInTimeZone(timeZone);

    // Cap recurring expansion so "scheduled" doesn't balloon with far-future occurrences.
    const { todos } = tdayTodosResponseSchema.parse(
      await this.requestAsync("/api/todo", { queryParams: { timeline: "true", recurringFutureDays: "60" } }),
    );

    const active = todos.filter((todo) => !todo.completed && todo.due);
    const filtered =
      view === "today"
        ? active.filter((todo) => (todo.due ?? "").slice(0, 10) === dateStr)
        : active.filter((todo) => (todo.due ?? "").slice(0, 16) >= dateTimeStr.slice(0, 16));

    return filtered.map(mapTodo);
  }

  /** Lists the user's lists for the view: floater-lists for "floater", todo-lists otherwise. */
  public async getListsAsync(view: TdayTaskView): Promise<TdayList[]> {
    const path = view === "floater" ? "/api/floaterList" : "/api/list";
    const { lists } = tdayListsResponseSchema.parse(await this.requestAsync(path));
    return lists.map((list) => ({
      id: list.id,
      name: list.name,
      iconKey: list.iconKey ?? null,
      color: list.color ?? null,
    }));
  }

  public async updateTaskAsync(
    kind: TdayTaskKind,
    id: string,
    fields: { title?: string; priority?: TdayPriority; listId?: string | null; due?: string | null },
  ): Promise<void> {
    const path = kind === "floater" ? "/api/floater" : "/api/todo";
    const body: Record<string, unknown> = { id };
    if (fields.title !== undefined) body.title = fields.title;
    if (fields.priority !== undefined) body.priority = fields.priority;
    // "" clears the list on the Tday side; undefined leaves it unchanged.
    if (fields.listId !== undefined) body.listID = fields.listId ?? "";
    // Only todos have a due date; a non-empty value sets it (clearing isn't supported here).
    if (kind !== "floater" && fields.due) {
      body.due = fields.due;
      body.dateChanged = true;
    }
    await this.requestAsync(path, { method: "PATCH", body });
  }

  public async completeTaskAsync(id: string, kind: TdayTaskKind, instanceDate?: string | null): Promise<void> {
    const path = kind === "floater" ? "/api/floater/complete" : "/api/todo/complete";
    const body = kind === "floater" ? { id } : { id, instanceDate: instanceDate ?? null };
    await this.requestAsync(path, { method: "PATCH", body });
  }

  public async uncompleteTaskAsync(id: string, kind: TdayTaskKind, instanceDate?: string | null): Promise<void> {
    const path = kind === "floater" ? "/api/floater/uncomplete" : "/api/todo/uncomplete";
    const body = kind === "floater" ? { id } : { id, instanceDate: instanceDate ?? null };
    await this.requestAsync(path, { method: "PATCH", body });
  }

  public async deleteTaskAsync(kind: TdayTaskKind, id: string, instanceDate?: string | null): Promise<void> {
    if (kind === "floater") {
      await this.requestAsync("/api/floater", { method: "DELETE", body: { id } });
      return;
    }
    if (instanceDate) {
      // Recurring occurrence — delete just this instance, not the whole series.
      await this.requestAsync("/api/todo/instance", { method: "DELETE", body: { todoId: id, instanceDate } });
      return;
    }
    await this.requestAsync("/api/todo", { method: "DELETE", body: { id } });
  }

  /**
   * Creates one task per title. Tday has no bulk endpoint, so the individual creates are
   * issued concurrently; returns how many succeeded and which titles failed (partial-failure safe).
   */
  public async createTasksAsync(
    view: TdayTaskView,
    titles: string[],
    priority: TdayPriority,
    listId?: string | null,
    due?: string | null,
  ): Promise<{ created: number; failedTitles: string[] }> {
    // Dated quick-add uses the picked due, or defaults to the end of the user's current day so it
    // shows up under both "today" and "scheduled" (non-overdue) immediately after creation.
    let resolvedDue: string | undefined;
    if (view !== "floater") {
      if (due) {
        resolvedDue = due;
      } else {
        const timeZone = await this.getTimeZoneAsync();
        resolvedDue = `${nowInTimeZone(timeZone).dateStr}T23:59:00`;
      }
    }

    const listField = listId ? { listID: listId } : {};
    const results = await Promise.allSettled(
      titles.map((title) =>
        view === "floater"
          ? this.requestAsync("/api/floater", { method: "POST", body: { title, priority, ...listField } })
          : this.requestAsync("/api/todo", { method: "POST", body: { title, priority, due: resolvedDue, ...listField } }),
      ),
    );

    const failedTitles = titles.filter((_, index) => results[index]?.status === "rejected");
    return { created: titles.length - failedTitles.length, failedTitles };
  }

  private async getTimeZoneAsync(): Promise<string> {
    const { user } = tdaySessionResponseSchema.parse(await this.requestAsync("/api/auth/session"));
    return user.timeZone ?? "UTC";
  }

  private async requestAsync(
    path: `/${string}`,
    options?: {
      queryParams?: Record<string, string>;
      method?: string;
      body?: unknown;
    },
  ): Promise<unknown> {
    const url = this.url(path, options?.queryParams);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.getSecretValue("apiKey")}`,
    };

    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetchWithTrustedCertificatesAsync(url, {
      method: options?.method ?? "GET",
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      logger.warn("Tday request failed", { statusCode: response.status, url: url.toString() });
      throw new ResponseError(response);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }
}

const nowInTimeZone = (timeZone: string): { dateStr: string; dateTimeStr: string } => {
  const now = new Date();
  try {
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    // sv-SE renders as "YYYY-MM-DD HH:mm:ss"
    const dateTime = new Intl.DateTimeFormat("sv-SE", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    return { dateStr, dateTimeStr: dateTime.replace(" ", "T") };
  } catch {
    const iso = now.toISOString();
    return { dateStr: iso.slice(0, 10), dateTimeStr: iso.slice(0, 19) };
  }
};
