import { MantineProvider } from "@mantine/core";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const executed: string[] = [];
const invalidated: string[] = [];

vi.mock("@homarr/api/client", () => ({
  clientApi: {
    useUtils: () => ({
      widget: {
        customApi: {
          getData: {
            invalidate: () => {
              invalidated.push("getData");
              return Promise.resolve();
            },
          },
        },
      },
    }),
    customWidget: {
      execute: {
        useMutation: () => ({
          mutateAsync: ({ definitionId }: { definitionId: string }) => {
            executed.push(definitionId);
            return Promise.resolve({ success: true });
          },
          isPending: false,
        }),
      },
    },
  },
}));
vi.mock("@homarr/modals", () => ({ useConfirmModal: () => ({ openConfirmModal: () => undefined }) }));
vi.mock("@homarr/notifications", () => ({
  showSuccessNotification: () => undefined,
  showErrorNotification: () => undefined,
}));

import CustomJsxDisplay from "./custom-jsx-display";

const TEMPLATE = `<Stack>
<ActionButton definitionId="def-a" label="Quiet" color="teal" variant="default" activeVariant="filled" active={data.cap===30} />
<ActionButton definitionId="def-b" label="Max" color="red" variant="default" activeVariant="filled" active={data.cap===100} />
</Stack>`;

describe("ActionButton in customJsx", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, writable: true });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  });

  beforeEach(() => {
    executed.length = 0;
    invalidated.length = 0;
  });

  const render = async (data: Record<string, unknown>) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(MantineProvider, null, createElement(CustomJsxDisplay, { data: { template: TEMPLATE, data } })),
      );
    });
    return container;
  };

  const variants = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("button")).map((button) => [
      button.textContent?.trim(),
      button.getAttribute("data-variant"),
    ]);

  it("marks only the button matching the current state as active", async () => {
    expect(variants(await render({ cap: 30 }))).toEqual([
      ["Quiet", "filled"],
      ["Max", "default"],
    ]);
  });

  it("moves the active state when the underlying data changes", async () => {
    expect(variants(await render({ cap: 100 }))).toEqual([
      ["Quiet", "default"],
      ["Max", "filled"],
    ]);
  });

  it("executes the referenced definition and refreshes the panel data", async () => {
    const container = await render({ cap: 30 });
    const maxButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Max"));

    await act(async () => {
      maxButton?.click();
    });

    expect(executed).toEqual(["def-b"]);
    expect(invalidated).toEqual(["getData"]);
  });
});
