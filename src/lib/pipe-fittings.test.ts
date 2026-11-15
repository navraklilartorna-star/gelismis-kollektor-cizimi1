import { describe, it, expect } from "vitest";
import { newProject, branchSettings, computeLayout, manufacturingRows, validate, pipeDiameterMm, type Project } from "./collector";
import { projectRow, rowProject } from "./cloud-projects";
import { buildDrawingPages } from "./drawing";

describe("pipe fitting updates", () => {
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