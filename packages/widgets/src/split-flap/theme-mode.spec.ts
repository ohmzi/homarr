import { describe, expect, it } from "vitest";

import { resolveFlapTheme } from "./theme-mode";

const custom = { light: "#dfe6ef", dark: "#232a33" };

describe("resolveFlapTheme", () => {
  it("follows the app's scheme on auto", () => {
    expect(resolveFlapTheme("auto", "light", custom).id).toBe("white");
    expect(resolveFlapTheme("auto", "dark", custom).id).toBe("black");
  });

  it("pins the board when a mode is chosen, whatever the app is doing", () => {
    expect(resolveFlapTheme("light", "dark", custom).id).toBe("white");
    expect(resolveFlapTheme("dark", "light", custom).id).toBe("black");
    expect(resolveFlapTheme("solari", "light", custom).id).toBe("solari");
    expect(resolveFlapTheme("solari", "dark", custom).id).toBe("solari");
  });

  it("honors the values stored before modes existed", () => {
    // A board saved as "black" meant a fixed dark board, not "follow the app".
    expect(resolveFlapTheme("black", "light", custom).id).toBe("black");
    expect(resolveFlapTheme("white", "dark", custom).id).toBe("white");
  });

  it("builds a board from the picked color for the custom families", () => {
    expect(resolveFlapTheme("customLight", "dark", custom).id).toBe("custom-light:#dfe6ef");
    expect(resolveFlapTheme("customDark", "light", custom).id).toBe("custom-dark:#232a33");
  });

  it("returns the same board for the same color, so the board is not rebuilt each render", () => {
    expect(resolveFlapTheme("customLight", "dark", custom)).toBe(resolveFlapTheme("customLight", "light", custom));
  });

  it("treats an unknown or missing value as auto", () => {
    expect(resolveFlapTheme(undefined, "light", custom).id).toBe("white");
    expect(resolveFlapTheme("somethingRemoved", "dark", custom).id).toBe("black");
  });
});
