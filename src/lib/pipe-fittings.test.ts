import { describe, it, expect } from "vitest";
import { newProject, branchSettings, computeLayout, manufacturingRows, validate, pipeDiameterMm, mainEndKind, END_LABELS, type EndKind, type Project } from "./collector";
import { projectRow, rowProject } from "./cloud-projects";
import { buildDrawingPages } from "./drawing";

describe("pipe fitting updates", () => {
  it.each(["top", "bottom"] as const)("draws one complete socket body seated on the %s main surface without an extension", side => {
    const base = newProject();
    const branches = branchSettings(base);
    const index = side === "top" ? 0 : 1;
    branches[index] = { size: "3/4", length: 17, spacing: 20, connection: "socket" };
    const p = { ...base, branches };
    const sheet = buildDrawingPages(p)[0] ?? [];
    const mainHeight = pipeDiameterMm("2") * 70 / pipeDiameterMm("2");
    const mainPipe = sheet.find(pr => pr.t === "rect" && pr.stroke && pr.sw === 1.8 && pr.w > 700);
    if (!mainPipe || mainPipe.t !== "rect") throw new Error("Missing main pipe");
    const surface = mainPipe.y + mainPipe.h / 2 + (side === "top" ? -1 : 1) * mainHeight / 2;
    const x = 140 + 10 * 720 / 34;
    const bodies = sheet.filter(pr => pr.t === "rect" && pr.stroke && pr.sw === 1.8 && Math.abs(pr.x + pr.w / 2 - x) < 0.01 && (side === "top" ? pr.y < surface : pr.y >= surface));
    expect(bodies).toHaveLength(1);
    const body = bodies[0];
    if (!body || body.t !== "rect") throw new Error("Missing socket body");
    expect(body.h).toBe(70);
    expect(body.w).toBeCloseTo(pipeDiameterMm("3/4") * 70 / pipeDiameterMm("2") * 1.3);
    expect(side === "top" ? body.y + body.h : body.y).toBeCloseTo(surface);
    expect(manufacturingRows(p)[index]?.length).toBe(17);
    expect(computeLayout(p).total).toBe(34);
  });
  it.each(Object.keys(END_LABELS) as EndKind[])("round trips independent %s ends without changing the branch axes", left => {
    for (const right of Object.keys(END_LABELS) as EndKind[]) {
      const p: Project = { ...newProject(), customerName: "Atölye", mainEnds: { left: { kind: left, size: "1/2", connection: "male" }, right: { kind: right, size: "6", connection: "socket" } } };
      const restored = rowProject(projectRow(p, "owner"));
      expect(mainEndKind(restored, "left")).toBe(left);
      expect(mainEndKind(restored, "right")).toBe(right);
      expect(restored.mainEnds?.left?.size).toBe("1/2");
      expect(restored.mainEnds?.right?.size).toBe("6");
      expect(computeLayout(restored).total).toBe(34);
      expect(manufacturingRows(restored).map(r => r.position)).toEqual([10, 10, 30, 30]);
      expect(validate(restored)).toEqual([]);
    }
  });
  it("resolves legacy sockets and flanges without rewriting the record", () => {
    const p: Project = { ...newProject(), mainEndType: "open-flanged", mainEnds: { left: { size: "1", connection: "socket" } } };
    expect(mainEndKind(p, "left")).toBe("socket");
    expect(mainEndKind(p, "right")).toBe("flanged");
    expect(p.mainEnds?.left?.kind).toBeUndefined();
  });
  it("round trips independent open-end diameters and connections without changing dimensions", () => {
    const p: Project = { ...newProject(), customerName: "Atölye", mainEndType: "open-open", mainEnds: { left: { size: "1/2", connection: "socket" }, right: { size: "6", connection: "male" } } };
    expect(rowProject(projectRow(p, "owner"))).toEqual(p);
    expect(computeLayout(p).total).toBe(34);
    expect(validate(p)).toEqual([]);
  });
  it("keeps socket branch dimensions and connection in cloud data", () => {
    const p = newProject(); const branches = branchSettings(p);
    branches[2] = { size: "1 1/4", length: 17, spacing: 31, connection: "socket" };
    const saved = rowProject(projectRow({ ...p, customerName: "Atölye", branches }, "owner"));
    expect(saved.branches?.[2]).toEqual({ size: "1 1/4", length: 17, spacing: 31, connection: "socket" });
    expect(computeLayout(saved).total).toBe(45);
    expect(validate(saved)).toEqual([]);
  });
  it.each(["center-top", "center-bottom"] as const)("places %s drains halfway without extending the pipe", position => {
    const p: Project = { ...newProject(), auxiliaryOutlets: { drain: { position, size: "3/4", length: 5, offset: 2 } } };
    expect(computeLayout(p).total).toBe(34);
    expect(manufacturingRows(p).at(-1)).toMatchObject({ position: 17, side: position === "center-top" ? "top" : "bottom", axis: 17 });
  });
  it.each(["bottom-left", "bottom-right"] as const)("places %s gauges below with the selected diameter", position => {
    const p: Project = { ...newProject(), auxiliaryOutlets: { gauge: { position, size: "1 1/2", length: 5, offset: 3 } } };
    expect(manufacturingRows(p).at(-1)).toMatchObject({ size: "1 1/2", position: position === "bottom-left" ? 3 : 34, side: "bottom" });
    expect(validate(p)).toEqual([]);
  });
  it("preserves all legacy layout calculations with no new settings", () => {
    expect(["tek", "karsilikli", "capraz"].map(layout => computeLayout({ ...newProject(), layout: layout as Project["layout"] }).total)).toEqual([74, 34, 74]);
  });
  it("uses actual standard pipe diameters for proportions", () => {
    expect(pipeDiameterMm("1/2")).toBe(21.3);
    expect(pipeDiameterMm("2")).toBe(60.3);
    expect(pipeDiameterMm("6")).toBe(168.3);
  });
  it("retains exactly one sheet for sixty branches with sockets and auxiliary fittings", () => {
    const p: Project = { ...newProject(), count: 60, mainEndType: "open-flanged", mainEnds: { left: { size: "1", connection: "socket" } }, auxiliaryOutlets: { drain: { position: "center-bottom", size: "3/4", length: 5, offset: 2 } } };
    expect(buildDrawingPages(p)).toHaveLength(1);
    expect(manufacturingRows(p)).toHaveLength(61);
  });
});