import { describe, it, expect, vi } from "vitest";
import { newProject, branchSettings, computeLayout, savedBatches, validate, MAIN_END_LABELS, PIPE_SIZES } from "./collector";
import { buildDrawingPages } from "./drawing";
import { projectRow, rowProject, saveManufacturingProject } from "./cloud-projects";
import { supabase } from "@/integrations/supabase/client";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
describe("advanced manufacturing rules", () => {
  it("offers main pipe diameters from half an inch through six inches", () => {
    expect(PIPE_SIZES[0]).toBe("1/2"); expect(PIPE_SIZES.at(-1)).toBe("6");
  });
  it("supports exactly the five requested main end combinations", () => {
    expect(Object.keys(MAIN_END_LABELS)).toEqual(["open-open", "closed-closed", "open-closed", "closed-flanged", "flanged-flanged"]);
  });
  it("keeps per-branch size length spacing and connection through cloud serialization", () => {
    const p = { ...newProject(), customerName: "Ahmet", projectId: "project-a", projectTitle: "Kazan", mainEndType: "closed-flanged" as const };
    const branches = branchSettings(p); branches[0] = { size: "1 1/2", length: 15, spacing: 25, connection: "flanged" };
    const advanced = { ...p, branches };
    expect(rowProject(projectRow(advanced,"owner-a"))).toEqual(advanced);
  });
  it("each side preserves its own axis spacing without changing the other side", () => {
    const p = { ...newProject(), branches: branchSettings(newProject()) };
    const b = p.branches[2]; if (!b) throw new Error("Missing C3"); b.spacing=35;
    expect(computeLayout(p).outlets.map(o => [o.side,o.pos])).toEqual([["top",0],["bottom",0],["top",35],["bottom",20]]);
    expect(computeLayout(p).total).toBe(49);
  });
  it("projects for the same customer never merge and restore stored order", () => {
    const base = newProject();
    const groups=savedBatches([{...base,id:"a2",projectId:"a",batchPosition:1},{...base,id:"b1",projectId:"b"},{...base,id:"a1",projectId:"a",batchPosition:0}]);
    expect(groups.find(g=>g.id==="a")?.projects.map(p=>p.id)).toEqual(["a1","a2"]);
    expect(groups.find(g=>g.id==="b")?.projects.map(p=>p.id)).toEqual(["b1"]);
  });
  it("rejects invalid branch production values", () => {
    const p=newProject(); const branches=branchSettings(p); branches[0]={size:"7",length:0,spacing:-1,connection:"male"};
    expect(validate({...p,branches}).length).toBeGreaterThan(0);
  });
  it("paginates all sixty branch details without losing any manufacturing records", () => {
    const p={...newProject(),count:60,mainEndType:"flanged-flanged" as const};
    const pages=buildDrawingPages(p);
    expect(pages).toHaveLength(5);
    const labels=pages.slice(1).flat().filter(v=>v.t==="text" && /^C\d+$/.test(v.text));
    expect(labels).toHaveLength(60);
  });
  it("saves the exact project membership atomically with one RPC", async () => {
    const p={...newProject(),batchId:"batch-a",projectTitle:"Kazan"};
    vi.mocked(supabase.rpc).mockResolvedValue({data:[projectRow(p,"owner-a")],error:null} as never);
    await saveManufacturingProject([p],"owner-a");
    expect(supabase.rpc).toHaveBeenCalledWith("save_manufacturing_project",expect.objectContaining({_project_id:"batch-a",_title:"Kazan",_rows:[projectRow(p,"owner-a")]}));
  });
});