import { describe, expect, it } from "vitest";
import { getDayPart } from "./greeting";

describe("getDayPart", () => {
  it.each([
    [4, "night"],
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [18, "evening"],
    [22, "evening"],
    [23, "night"],
  ] as const)("%d → %s", (hour, part) => {
    expect(getDayPart(hour)).toBe(part);
  });
});
