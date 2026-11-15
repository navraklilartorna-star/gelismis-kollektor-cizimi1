import { describe, expect, it } from "vitest";
import { branchSettings, computeLayout, defaultAuxiliaryOutlet, manufacturingRows, newProject, validate } from "./collector";
import { buildDrawingPages } from "./drawing";
import { projectRow, rowProject } from "./cloud-projects";

describe("workshop optional outlets", () => {
  it("adds end fittings outside the numbered outlets, extending only the pipe length", () => {
    const p = newProject();
    const extended = { ...p, auxiliaryOutlets: { drain: defaultAuxiliaryOutlet("drain"), gauge: defaultAuxiliaryOutlet("gauge") } };
    expect(computeLayout(extended).total).toBe(computeLayout(p).total + 2);
    expect(manufacturingRows(extended).map(r => r.id)).toEqual(["C1", "C2", "C3", "C4", "B1", "M1"]);
    expect(newProject().auxiliaryOutlets).toBeUndefined();
  });
  it("positions the drain below and gauge above at their selected left or right allowance", () => {
    const p = { ...newProject(), auxiliaryOutlets: { drain: { ...defaultAuxiliaryOutlet("drain"), position: "left" as const, offset: 3 }, gauge: { ...defaultAuxiliaryOutlet("gauge"), offset: 2 } } };
    expect(manufacturingRows(p).slice(-2).map(r => [r.id, r.side, r.position, r.axis, r.size])).toEqual([["B1", "bottom", 3, 3, "3/4"], ["M1", "top", 37, 2, "1/2"]]);
  });
  it("accepts selectable manometer diameters through six inches", () => {
    expect(validate({ ...newProject(), auxiliaryOutlets: { gauge: { ...defaultAuxiliaryOutlet("gauge"), size: "6" } } })).toEqual([]);
    expect(validate({ ...newProject(), auxiliaryOutlets: { gauge: defaultAuxiliaryOutlet("gauge") } })).toEqual([]);
  });
  it("never places a left fitting between numbered outlets", () => {
    const p = { ...newProject(), auxiliaryOutlets: { drain: { ...defaultAuxiliaryOutlet("drain"), position: "left" as const, offset: 15 } } };
    const rows = manufacturingRows(p);
    const firstOutlet = Math.min(...rows.filter(r => r.id.startsWith("C")).map(r => r.position));
    expect(rows.find(r => r.id === "B1")?.position).toBeLessThan(firstOutlet);
  });
  it("reports first branch axes from the start and subsequent axes from the same side", () => {
    const p = { ...newProject(), branches: branchSettings(newProject()) };
    const b = p.branches[2]; if (b) b.spacing = 35;
    expect(manufacturingRows(p).map(r => [r.axis, r.position])).toEqual([[10,10],[10,10],[35,45],[20,30]]);
  });
  it("preserves both optional outlet settings through cloud round trips", () => {
    const p = { ...newProject(), customerName: "Atölye", auxiliaryOutlets: { drain: defaultAuxiliaryOutlet("drain"), gauge: defaultAuxiliaryOutlet("gauge") } };
    expect(rowProject(projectRow(p, "owner"))).toEqual(p);
    expect(rowProject(projectRow(newProject(), "owner")).auxiliaryOutlets).toBeUndefined();
  });
  it("paginates sixty numbered branches plus both auxiliary fittings without losing production rows", () => {
    const p = { ...newProject(), count: 60, auxiliaryOutlets: { drain: defaultAuxiliaryOutlet("drain"), gauge: defaultAuxiliaryOutlet("gauge") } };
    const pages = buildDrawingPages(p);
    expect(pages).toHaveLength(1);
    const rows = manufacturingRows(p);
    expect(rows).toHaveLength(62);
  });
});