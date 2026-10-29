import { describe, expect, it } from "vitest";
import { branchSettings, computeLayout, defaultAuxiliaryOutlet, manufacturingRows, newProject, validate } from "./collector";
import { buildDrawingPages } from "./drawing";
import { projectRow, rowProject } from "./cloud-projects";

describe("workshop optional outlets", () => {
  it("keeps existing axes and length unchanged when optional outlets are added", () => {
    const p = newProject();
    const extended = { ...p, auxiliaryOutlets: { drain: defaultAuxiliaryOutlet("drain"), gauge: defaultAuxiliaryOutlet("gauge") } };
    expect(computeLayout(extended)).toEqual(computeLayout(p));
    expect(manufacturingRows(extended).map(r => r.id)).toEqual(["C1", "C2", "C3", "C4", "B1", "M1"]);
    expect(newProject().auxiliaryOutlets).toBeUndefined();
  });
  it("positions the drain below and gauge above at their selected left or right allowance", () => {
    const p = { ...newProject(), auxiliaryOutlets: { drain: { ...defaultAuxiliaryOutlet("drain"), position: "left" as const, offset: 3 }, gauge: { ...defaultAuxiliaryOutlet("gauge"), offset: 2 } } };
    expect(manufacturingRows(p).slice(-2).map(r => [r.id, r.side, r.position, r.axis, r.size])).toEqual([["B1", "bottom", 3, 3, "3/4"], ["M1", "top", 32, 2, "1/2"]]);
  });
  it("enforces the fixed half-inch manometer diameter", () => {
    expect(validate({ ...newProject(), auxiliaryOutlets: { gauge: { ...defaultAuxiliaryOutlet("gauge"), size: "3/4" } } })).toHaveLength(1);
    expect(validate({ ...newProject(), auxiliaryOutlets: { gauge: defaultAuxiliaryOutlet("gauge") } })).toEqual([]);
  });
  it("reports first branch axes from the start and subsequent axes from the same side", () => {
    const p = { ...newProject(), branches: branchSettings(newProject()) };
    const b = p.branches[2]; if (b) b.spacing = 35;
    expect(manufacturingRows(p).map(r => [r.axis, r.position])).toEqual([[10,10],[10,10],[35,45],[20,30]]);
  });
  it("preserves both optional outlet settings through cloud round trips", () => {
    const p = { ...newProject(), auxiliaryOutlets: { drain: defaultAuxiliaryOutlet("drain"), gauge: defaultAuxiliaryOutlet("gauge") } };
    expect(rowProject(projectRow(p, "owner"))).toEqual(p);
    expect(rowProject(projectRow(newProject(), "owner")).auxiliaryOutlets).toBeUndefined();
  });
  it("paginates sixty numbered branches plus both auxiliary fittings without losing production rows", () => {
    const p = { ...newProject(), count: 60, auxiliaryOutlets: { drain: defaultAuxiliaryOutlet("drain"), gauge: defaultAuxiliaryOutlet("gauge") } };
    const pages = buildDrawingPages(p);
    expect(pages).toHaveLength(4);
    const rows = pages.flat().filter(v => v.t === "text" && v.c === "#111827" && /^(C\d+|B1 Boşaltma|M1 Manometre)$/.test(v.text));
    expect(rows).toHaveLength(62);
  });
});