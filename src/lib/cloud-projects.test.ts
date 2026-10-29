import { describe, expect, it, vi } from "vitest";
import { newProject, computeLayout, saveSnapshot } from "./collector";
import { projectRow, rowProject, saveCloudProject, saveCloudBatch, updateCloudBatch, listCloudProjects, deleteCloudProject } from "./cloud-projects";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
describe("cloud collector records", () => {
  it("inserts all three collectors atomically in one owner-scoped request", async () => {
    const projects = saveSnapshot([newProject(), newProject(), newProject()], "Aaa", 1234567);
    const insert = vi.fn(() => ({ select: async () => ({ data: projects.map((p) => projectRow(p, "owner-a")).reverse(), error: null }) }));
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);
    expect(await saveCloudBatch(projects, "owner-a")).toEqual(projects);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(projects.map((p) => projectRow(p, "owner-a")));
  });
  it("does not insert any rows if one collector is invalid", async () => {
    const insert = vi.fn();
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);
    await expect(saveCloudBatch([newProject(), { ...newProject(), quantity: 0 }], "owner-a")).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });
  it("round-trips every measurement and production field for its owner", () => {
    const p = { ...newProject(), id: "legacy-id", name: "", customerName: "Ahmet", mainSize: "3", outSize: "1", count: 9, spacing: 20.5, start: 8.5, end: 4.5, quantity: 25, date: "2026-10-21", notes: "Kontrol edilecek", layout: "capraz" as const, thread: "cift" as const, updatedAt: 1234567 };
    const row = projectRow(p, "owner-a");
    expect(row.user_id).toBe("owner-a");
    expect(row.name).toBe("");
    expect(rowProject(row)).toEqual(p);
    expect(computeLayout(rowProject(row))).toEqual(computeLayout(p));
  });
  it("updates the same owner and ID instead of creating duplicate saved designs", async () => {
    const p = { ...newProject(), id: "same-id", quantity: 25, customerName: "Ahmet" };
    const upsert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: projectRow(p, "owner-a"), error: null }) }) }));
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
    expect(await saveCloudProject(p, "owner-a")).toEqual(p);
    expect(upsert).toHaveBeenCalledWith(projectRow(p, "owner-a"), { onConflict: "user_id,id" });
  });
  it("saves a blank customer as İsimsiz Müşteri without changing geometry", async () => {
    const p = { ...newProject(), customerName: "   " };
    const upsert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: projectRow(p, "owner-a"), error: null }) }) }));
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
    const saved = await saveCloudProject(p, "owner-a");
    expect(saved.customerName).toBe("İsimsiz Müşteri");
    expect(saved.id).toBe(p.id);
    expect(computeLayout(saved)).toEqual(computeLayout(p));
  });
  it("scopes reads and deletion to the signed-in owner", async () => {
    const range = vi.fn(async () => ({ data: [], error: null }));
    const eq = vi.fn(() => chain);
    const chain = { select: () => chain, delete: () => chain, eq, order: () => chain, range, then: (resolve: (value: unknown) => void) => resolve({ error: null }) };
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    expect(await listCloudProjects("owner-a")).toEqual([]);
    await deleteCloudProject("saved-id", "owner-a");
    expect(eq).toHaveBeenCalledWith("user_id", "owner-a");
    expect(eq).toHaveBeenCalledWith("id", "saved-id");
    expect(range).toHaveBeenCalledWith(0, 499);
  });
  it("does not report a successful save after a cloud failure", async () => {
    vi.mocked(supabase.from).mockReturnValue({ upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: "offline" } }) }) }) } as never);
    await expect(saveCloudProject(newProject(), "owner-a")).rejects.toThrow("buluta kaydedilemedi");
  });
});describe("updating an opened save group", () => {
  it("overwrites the same 3-collector group as 4 collectors instead of creating a second group", async () => {
    const first = saveSnapshot([newProject(), newProject(), newProject()], "Aaa", 1000);
    const updated = saveSnapshot([...first, newProject()], "Aaa", 2000, first[0]!.batchId);
    expect(updated).toHaveLength(4);
    expect(new Set(updated.map((x) => x.batchId))).toEqual(new Set([first[0]!.batchId]));
    expect(updated.slice(0, 3).map((x) => x.id)).toEqual(first.map((x) => x.id));
    const upsert = vi.fn(() => ({ select: async () => ({ data: updated.map((p) => projectRow(p, "owner-a")), error: null }) }));
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
    const saved = await updateCloudBatch(updated, "owner-a", []);
    expect(upsert).toHaveBeenCalledWith(updated.map((p) => projectRow(p, "owner-a")), { onConflict: "user_id,id" });
    const { savedBatches } = await import("./collector");
    expect(savedBatches(saved).map((g) => g.projects.length)).toEqual([4]);
  });
});
