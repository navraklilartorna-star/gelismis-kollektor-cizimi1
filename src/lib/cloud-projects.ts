import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { customerLabel, normalizeProject, validate, type Project } from "./collector";

type Row = Database["public"]["Tables"]["collector_projects"]["Row"];

export function projectRow(project: Project, userId: string): Row {
  const p = normalizeProject(project);
  return { id: p.id, user_id: userId, customer_name: customerLabel(p.customerName), name: p.name,
    notes: p.notes, main_size: p.mainSize, out_size: p.outSize, outlet_count: p.count,
    spacing: p.spacing, start_length: p.start, end_length: p.end, layout: p.layout,
    thread: p.thread, production_date: p.date, quantity: p.quantity, updated_at: p.updatedAt,
    batch_id: p.batchId ?? null, batch_saved_at: p.batchSavedAt ?? null, batch_position: p.batchPosition ?? 0 };
}

export function rowProject(row: Row): Project {
  if (!["tek", "karsilikli", "capraz"].includes(row.layout) || !["acik", "kapali", "cift"].includes(row.thread)) throw new Error("Kayıtlı kollektörün bağlantı bilgileri geçersiz.");
  return normalizeProject({ id: row.id, customerName: row.customer_name, name: row.name,
    notes: row.notes, mainSize: row.main_size, outSize: row.out_size, count: row.outlet_count,
    spacing: row.spacing, start: row.start_length, end: row.end_length,
    layout: row.layout as Project["layout"], thread: row.thread as Project["thread"],
    date: row.production_date, quantity: row.quantity, updatedAt: row.updated_at,
    ...(row.batch_id ? { batchId: row.batch_id, batchSavedAt: row.batch_saved_at ?? row.updated_at, batchPosition: row.batch_position } : {}) });
}

export async function listCloudProjects(userId: string): Promise<Project[]> {
  const rows: Project[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("collector_projects").select("*").eq("user_id", userId)
      .order("updated_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) throw new Error("Bulut kayıtları yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.");
    rows.push(...(data ?? []).map(rowProject));
    if (!data || data.length < 500) return rows;
  }
}

export async function saveCloudProject(project: Project, userId: string): Promise<Project> {
  const errors = validate(project);
  if (errors.length) throw new Error(errors[0]);
  const { data, error } = await supabase.from("collector_projects")
    .upsert(projectRow(project, userId), { onConflict: "user_id,id" }).select().single();
  if (error || !data) throw new Error("Kollektör buluta kaydedilemedi. Ölçüleriniz korunuyor; tekrar deneyin.");
  return rowProject(data);
}

export async function deleteCloudProject(id: string, userId: string) {
  const { error } = await supabase.from("collector_projects").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error("Kayıt silinemedi. Tekrar deneyin.");
}

/** One INSERT request is one database transaction: never partially save a batch. */
export async function saveCloudBatch(projects: Project[], userId: string): Promise<Project[]> {
  if (!projects.length) throw new Error("Kaydedilecek kollektör yok.");
  for (const project of projects) {
    const errors = validate(project);
    if (errors.length) throw new Error(errors[0]);
  }
  const { data, error } = await supabase.from("collector_projects").insert(projects.map((project) => projectRow(project, userId))).select();
  if (error || !data || data.length !== projects.length) throw new Error("Kollektör grubu kaydedilemedi. Ölçüleriniz korunuyor; tekrar deneyin.");
  return data.map(rowProject).sort((a, b) => (a.batchPosition ?? 0) - (b.batchPosition ?? 0));
}

/** Overwrite an existing save group: upsert its members in one request, then drop rows removed from it. */
export async function updateCloudBatch(projects: Project[], userId: string, removedIds: string[]): Promise<Project[]> {
  if (!projects.length) throw new Error("Kaydedilecek kollektör yok.");
  for (const project of projects) {
    const errors = validate(project);
    if (errors.length) throw new Error(errors[0]);
  }
  const { data, error } = await supabase.from("collector_projects")
    .upsert(projects.map((project) => projectRow(project, userId)), { onConflict: "user_id,id" }).select();
  if (error || !data || data.length !== projects.length) throw new Error("Kayıt güncellenemedi. Ölçüleriniz korunuyor; tekrar deneyin.");
  if (removedIds.length) {
    const { error: delError } = await supabase.from("collector_projects").delete().eq("user_id", userId).in("id", removedIds);
    if (delError) throw new Error("Kayıt güncellendi ancak çıkarılan kollektörler silinemedi. Tekrar kaydedin.");
  }
  return data.map(rowProject).sort((a, b) => (a.batchPosition ?? 0) - (b.batchPosition ?? 0));
}