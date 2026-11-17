import { describe, expect, it } from "vitest";
import { buildDrawing } from "./drawing";
import { newProject } from "./collector";

describe("socket internal thread length", () => {
  it("keeps internal threads short near the socket opening", () => {
    const p = newProject();
    p.branches = [{ size: "3/4", length: 10, spacing: 20, connection: "socket" }];
    const prims = buildDrawing(p);
    const threads = prims.filter(pr => pr.t === "line" && pr.w === 1 && pr.c === "#111827" && Math.abs(pr.y2 - pr.y1) <= 2 && Math.abs(pr.x2 - pr.x1) <= 8);
    // 4 short thread pairs (8 lines) near the opening; previously the full socket height.
    expect(threads.length).toBe(8);
  });
});
