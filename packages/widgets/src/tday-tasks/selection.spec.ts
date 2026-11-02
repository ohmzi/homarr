import { describe, expect, test } from "vitest";

import { normalizeTdayTasksOptions, parseTdayWidgetSelection } from "./selection";

describe("parseTdayWidgetSelection", () => {
  test("reads a built-in view", () => {
    expect(parseTdayWidgetSelection("view:overdue")).toEqual({
      type: "view",
      view: "overdue",
    });
  });
  test("reads a user list of either kind", () => {
    expect(parseTdayWidgetSelection("todo:abc")).toEqual({
      type: "list",
      kind: "todo",
      id: "abc",
      encoded: "todo:abc",
    });
    expect(parseTdayWidgetSelection("floater:x1")).toEqual({
      type: "list",
      kind: "floater",
      id: "x1",
      encoded: "floater:x1",
    });
  });
  test("falls back to today for empty or unreadable values", () => {
    for (const value of [null, undefined, "", "view:nope", "todo:", "weird"]) {
      expect(parseTdayWidgetSelection(value)).toEqual({
        type: "view",
        view: "today",
      });
    }
  });
});

describe("normalizeTdayTasksOptions", () => {
  test("turns a legacy view into the selection", () => {
    expect(normalizeTdayTasksOptions({ view: "floater", sort: "priority" })).toEqual({
      sort: "priority",
      list: { value: "view:floater", label: "floater" },
    });
  });
  test("keeps a legacy list, which always won over the view", () => {
    expect(
      normalizeTdayTasksOptions({
        view: "today",
        list: { value: "todo:42", label: "Errands" },
      }),
    ).toEqual({
      list: { value: "todo:42", label: "Errands" },
    });
  });
  test("leaves already-merged options alone", () => {
    const options = { list: { value: "view:scheduled", label: "Scheduled" } };
    expect(normalizeTdayTasksOptions(options)).toBe(options);
  });
});
