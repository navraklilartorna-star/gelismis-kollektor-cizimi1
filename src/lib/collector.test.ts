import { describe, it, expect } from "vitest";
import { computeLayout, validate, newProject, normalizeProject, todayDate, customerProjects, groupCustomerProjects, noteLines, savedBatches, saveSnapshot, inchFlat } from "./collector";
import { inchParts, textsWidth } from "./drawing";

const base = { count: 9, spacing: 20, start: 8, end: 4, layout: "karsilikli" as const };

describe("collector layout", () => {
  it("creates separate immutable 3-collector and 1-collector saves for Aaa", () => {
    const source = newProject();
    const original = [source, newProject(), newProject()];
    const first = saveSnapshot(original, "Aaa", 1000);
    const second = saveSnapshot([source], "Aaa", 2000);
    expect(new Set(first.map((x) => x.batchId)).size).toBe(1);
    expect(first[0]?.batchId).not.toBe(second[0]?.batchId);
    expect(first.map((x) => x.batchPosition)).toEqual([0, 1, 2]);
    expect(first.every((x) => !original.some((o) => o.id === x.id))).toBe(true);
    expect(savedBatches([...first].reverse().concat(second)).map((g) => g.projects.length)).toEqual([1, 3]);
    expect(savedBatches(first.slice().reverse())[0]?.projects.map((x) => x.id)).toEqual(first.map((x) => x.id));
    expect(original.map((x) => x.customerName)).toEqual(["", "", ""]);
    const firstCollector = first[0];
    if (!firstCollector) throw new Error("Missing snapshot collector");
    expect(computeLayout(firstCollector)).toEqual(computeLayout(source));
  });
  it("keeps legacy individual records isolated instead of inventing save boundaries", () => {
    expect(savedBatches([newProject(), newProject()]).map((g) => g.projects.length)).toEqual([1, 1]);
  });
  it("new projects default to karşılıklı", () => {
    expect(newProject().layout).toBe("karsilikli");
  });
  it("new projects default to kapalı tek", () => {
    expect(newProject().thread).toBe("kapali");
  });
  it("new karşılıklı projects default to a 10 cm start length", () => {
    expect(newProject().start).toBe(10);
  });
  it("formats mixed inch sizes with a vulgar fraction and keeps plain fractions flat", () => {
    expect(inchFlat("1 1/2")).toBe("1½");
    expect(inchFlat("2 1/4")).toBe("2¼");
    expect(inchFlat("2 3/4")).toBe("2¾");
    expect(inchFlat("1/2")).toBe("1/2");
    expect(inchFlat("3/4")).toBe("3/4");
    expect(inchFlat("2")).toBe("2");
  });
  it("renders mixed inch sizes as one flat vulgar-fraction label", () => {
    expect(inchParts("1 1/2", 24)).toEqual([{ text: "1½", s: 24, bold: true }]);
    expect(inchParts("3/4", 18)).toEqual([{ text: "3/4", s: 18, bold: true }]);
    expect(textsWidth(inchParts("2 1/2", 24))).toBeGreaterThan(0);
  });
  it("quantity is an independent production count", () => {
    const p = { ...newProject(), quantity: 25, count: 9 };
    expect(validate(p)).toEqual([]);
    expect(computeLayout(p).outlets).toHaveLength(9);
  });
  it("rejects nonpositive or fractional production quantity", () => {
    for (const quantity of [0, -1, 1.5, NaN]) expect(validate({ ...newProject(), quantity })).not.toEqual([]);
  });
  it("preserves existing project settings when filling missing fields", () => {
    const { date, quantity, ...old } = { ...newProject(), layout: "tek" as const, thread: "acik" as const };
    const restored = normalizeProject(old as ReturnType<typeof newProject>);
    expect(restored.quantity).toBe(1);
    expect(restored.layout).toBe("tek");
    expect(restored.thread).toBe("acik");
  });
  it("legacy customer and notes default to empty without changing geometry", () => {
    const { customerName, notes, ...old } = newProject();
    const restored = normalizeProject(old as ReturnType<typeof newProject>);
    expect(restored.customerName).toBe("");
    expect(restored.notes).toBe("");
    expect(computeLayout(restored)).toEqual(computeLayout(old));
  });
  it("exports only this customer's collectors, replacing saved current edits exactly once", () => {
    const current = { ...newProject(), customerName: "İbrahim", notes: "Kontrol edilecek", quantity: 25 };
    const sibling = { ...newProject(), customerName: " ibrahim " };
    const other = { ...newProject(), customerName: "Mehmet" };
    const result = customerProjects(current, [{ ...current, quantity: 1 }, sibling, other]);
    expect(result.map((x) => x.id)).toEqual([current.id, sibling.id]);
    expect(result[0]?.quantity).toBe(25);
    expect(result[0]?.notes).toBe("Kontrol edilecek");
  });
  it("combines blank customer names under İsimsiz Müşteri", () => {
    const current = newProject();
    const saved = { ...newProject(), customerName: "İsimsiz Müşteri" };
    expect(customerProjects(current, [saved])).toEqual([saved, current]);
    expect(validate(current)).toEqual([]);
  });
  it("groups collectors by Turkish customer name with concrete collector counts", () => {
    const projects = [
      { ...newProject(), customerName: "Özyıl" },
      { ...newProject(), customerName: " özyıl " },
      { ...newProject(), customerName: "Ahmet Bey" },
      { ...newProject(), customerName: "  " },
    ];
    const groups = groupCustomerProjects(projects);
    expect(groups.map((g) => [g.name, g.projects.length])).toEqual([["Ahmet Bey", 1], ["İsimsiz Müşteri", 1], ["Özyıl", 2]]);
    expect(groups.flatMap((g) => g.projects)).toHaveLength(4);
  });
  it("wraps the entire printable note without losing words", () => {
    const note = "Kaynak sonrası tüm çıkışlar kontrol edilecek ve dişli uçlar koruma kapağı takılarak müşteriye teslim edilecek.";
    const lines = noteLines(note);
    expect(lines.join(" ")).toBe(note);
    expect(lines.every((x) => x.length <= 64)).toBe(true);
  });
  it("uses the Istanbul calendar date", () => {
    expect(todayDate(new Date("2026-10-18T22:00:00Z"))).toBe("2026-10-19");
  });
  it("tek sıra: 4 çıkış, 20 cm, 8+4 → 72 cm", () => {
    expect(computeLayout({ ...base, count: 4, layout: "tek", thread: "acik" }).total).toBe(72);
  });
  it("açık tek: 4+5 karşılıklı, tek çıkış giriş ucunda", () => {
    const r = computeLayout({ ...base, thread: "acik" });
    expect(r.outlets.filter((o) => o.pos === 0)).toHaveLength(1);
    expect(r.outlets.filter((o) => o.side === "bottom")).toHaveLength(5);
    expect(r.total).toBe(8 + 4 * 20 + 4);
  });
  it("kapalı tek: tek çıkış kapalı uçta", () => {
    const r = computeLayout({ ...base, thread: "kapali" });
    expect(r.outlets.filter((o) => o.pos === 80)).toHaveLength(1);
    expect(r.outlets.filter((o) => o.pos === 0)).toHaveLength(2);
  });
  it("proje adı boş olsa da geçerli", () => {
    expect(validate({ ...newProject(), name: "" })).toEqual([]);
  });
});
