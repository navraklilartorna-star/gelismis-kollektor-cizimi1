import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route } from "./index";
import { newProject, branchSettings, computeLayout, mainEndKind, type Project } from "@/lib/collector";
import { saveManufacturingProject, saveCloudProject, deleteCloudProject } from "@/lib/cloud-projects";

const records = vi.hoisted(() => ({ projects: [] as Project[] }));

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => ({ options }), Link: () => null }));
vi.mock("@/components/AccountProvider", () => ({ useAccount: () => ({ user: { id: "owner-a", email: "" }, ready: true }) }));
vi.mock("@/components/AccountDialog", () => ({ AccountDialog: () => null }));
vi.mock("@/components/Drawing", () => ({ Drawing: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn() }, rpc: vi.fn(async () => ({ data: false, error: null })) } }));
vi.mock("@/lib/cloud-projects", () => ({
  listCloudProjects: vi.fn(async () => records.projects),
  saveCloudProject: vi.fn(async (p: Project) => {
    const saved = { ...p, customerName: p.customerName.trim() || "İsimsiz Müşteri" };
    records.projects = [saved, ...records.projects.filter((x) => x.id !== p.id)];
    return saved;
  }),
  saveManufacturingProject: vi.fn(async (items: Project[]) => { const id = items[0]?.batchId; records.projects = [...records.projects.filter(p => p.batchId !== id), ...items]; return items; }),
  deleteCloudProject: vi.fn(),
}));

function editor() {
  const Component = Route.options.component;
  if (!Component) throw new Error("Missing editor");
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Component /></QueryClientProvider>);
}

afterEach(() => { cleanup(); records.projects = []; vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("collector editor actions", () => {
  it("closes both ends without changing odd-outlet placement or production measurements", async () => {
    editor();
    fireEvent.change(screen.getByLabelText("Çıkış sayısı"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("C1 boy"), { target: { value: "17" } });
    fireEvent.change(screen.getByLabelText("Kollektör tipi"), { target: { value: "closed" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(saveManufacturingProject).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(saveManufacturingProject).mock.calls[0]?.[0]?.[0];
    if (!saved) throw new Error("Missing saved collector");
    expect(mainEndKind(saved, "left")).toBe("closed");
    expect(mainEndKind(saved, "right")).toBe("closed");
    expect(saved.thread).toBe("kapali");
    expect(branchSettings(saved)[0]?.length).toBe(17);
    const legacyGeometry: Project = { ...saved, mainEnds: undefined };
    expect(computeLayout(saved).outlets).toEqual(computeLayout(legacyGeometry).outlets);
    expect(deleteCloudProject).not.toHaveBeenCalled();
  });
  it("saves independently selected socket and flanged ends with their diameters", async () => {
    editor();
    fireEvent.change(screen.getByLabelText("Sol uç bağlantı"), { target: { value: "socket" } });
    fireEvent.change(screen.getByLabelText("Sol uç çap"), { target: { value: "1/2" } });
    fireEvent.change(screen.getByLabelText("Sağ uç bağlantı"), { target: { value: "flanged" } });
    fireEvent.change(screen.getByLabelText("Sağ uç çap"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(saveManufacturingProject).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(saveManufacturingProject).mock.calls[0]?.[0]?.[0];
    expect(saved?.mainEnds?.left).toMatchObject({ kind: "socket", size: "1/2" });
    expect(saved?.mainEnds?.right).toMatchObject({ kind: "flanged", size: "6" });
    if (!saved) throw new Error("Missing saved collector");
    expect(computeLayout(saved).total).toBe(34);
  });
  it("preserves three collectors on customer rename and saves each click as an isolated snapshot", async () => {
    editor();
    fireEvent.change(screen.getByLabelText("Adet"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Kollektör Ekle" }));
    fireEvent.change(screen.getByLabelText("Adet"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Kollektör Ekle" }));
    fireEvent.change(screen.getByLabelText("Müşteri adı (isteğe bağlı)"), { target: { value: "Aaa" } });
    expect(screen.getAllByRole("button", { name: /Kollektör \d ·/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 1 ·/ }));
    expect(screen.getByLabelText("Adet")).toHaveValue("7");
    expect(screen.getByLabelText("Müşteri adı (isteğe bağlı)")).toHaveValue("Aaa");
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(saveManufacturingProject).toHaveBeenCalledTimes(1));
    const first = vi.mocked(saveManufacturingProject).mock.calls[0]?.[0] ?? [];
    expect(first.map((x) => x.quantity)).toEqual([7, 25, 1]);
    expect(first.map((x) => x.customerName)).toEqual(["Aaa", "Aaa", "Aaa"]);
    expect(new Set(first.map((x) => x.batchId)).size).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "+ Yeni" }));
    fireEvent.change(screen.getByLabelText("Müşteri adı (isteğe bağlı)"), { target: { value: "Aaa" } });
    fireEvent.change(screen.getByLabelText("Adet"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(saveManufacturingProject).toHaveBeenCalledTimes(2));
    const second = vi.mocked(saveManufacturingProject).mock.calls[1]?.[0] ?? [];
    expect(second).toHaveLength(1);
    expect(second[0]?.batchId).not.toBe(first[0]?.batchId);
    expect(records.projects).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Projeler" }));
    fireEvent.click(await screen.findByRole("button", { name: /Aaa.*4 kollektör/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kayıt.*3 Kollektör/ }));
    expect(screen.getAllByRole("button", { name: /Kollektör \d ·/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 2 ·/ }));
    expect(screen.getByLabelText("Adet")).toHaveValue("25");
    fireEvent.click(screen.getByRole("button", { name: "Projeler" }));
    fireEvent.click(await screen.findByRole("button", { name: /Aaa.*4 kollektör/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kayıt.*1 Kollektör/ }));
    expect(screen.getAllByRole("button", { name: /Kollektör \d ·/ })).toHaveLength(1);
    expect(screen.getByLabelText("Adet")).toHaveValue("9");
    expect(saveCloudProject).not.toHaveBeenCalled();
  });
  it("blocks the entire save when another collector has invalid raw measurements", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "+ Kollektör Ekle" }));
    fireEvent.change(screen.getByLabelText("Başlangıç uzunluğu (cm)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 1 ·/ }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(saveManufacturingProject).not.toHaveBeenCalled();
    expect(records.projects).toHaveLength(0);
  });

  it("switches collectors without writes or deletion and preserves both drafts and tab order", async () => {
    editor();
    fireEvent.change(screen.getByLabelText("Adet"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Kollektör Ekle" }));
    await screen.findByRole("button", { name: "Kollektör 2 iptal et" });
    fireEvent.change(screen.getByLabelText("Adet"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Üretim notu"), { target: { value: "İkinci kollektör" } });
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 1 ·/ }));
    expect(screen.getByLabelText("Adet")).toHaveValue("7");
    fireEvent.change(screen.getByLabelText("Adet"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 2 ·/ }));
    expect(screen.getByLabelText("Adet")).toHaveValue("25");
    expect(screen.getByLabelText("Üretim notu")).toHaveValue("İkinci kollektör");
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 1 ·/ }));
    expect(screen.getByLabelText("Adet")).toHaveValue("9");
    expect(screen.getAllByRole("button", { name: /Kollektör \d ·/ })).toHaveLength(2);
    expect(saveManufacturingProject).not.toHaveBeenCalled();
    expect(deleteCloudProject).not.toHaveBeenCalled();
  });
  it("keeps incomplete numeric input when switching without blocking navigation", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "+ Kollektör Ekle" }));
    await screen.findByRole("button", { name: "Kollektör 2 iptal et" });
    fireEvent.change(screen.getByLabelText("Başlangıç uzunluğu (cm)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 1 ·/ }));
    expect(screen.getByLabelText("Başlangıç uzunluğu (cm)")).toHaveValue("10");
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 2 ·/ }));
    expect(screen.getByLabelText("Başlangıç uzunluğu (cm)")).toHaveValue("");
    expect(saveManufacturingProject).not.toHaveBeenCalled();
    expect(deleteCloudProject).not.toHaveBeenCalled();
  });
  it("notifies cloud save success only after an explicit Save click", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "+ Kollektör Ekle" }));
    await screen.findByRole("button", { name: "Kollektör 2 iptal et" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 1 ·/ }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(saveManufacturingProject).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });
  it("requires confirmed X before deleting a cloud record", async () => {
    records.projects = [{ ...newProject(), id: "cloud-one", customerName: "Ahmet Bey" }];
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Projeler" }));
    fireEvent.click(await screen.findByRole("button", { name: /Ahmet Bey.*1 kollektör/ }));
    fireEvent.click(screen.getByRole("button", { name: "Kollektör 1 sil" }));
    expect(deleteCloudProject).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Kollektör 1 sil" }));
    await waitFor(() => expect(deleteCloudProject).toHaveBeenCalledWith("cloud-one", "owner-a"));
    expect(saveManufacturingProject).not.toHaveBeenCalled();
  });
  it("keeps additions local and saves both collectors together only on Save", async () => {
    editor();
    fireEvent.change(screen.getByLabelText("Adet"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Kollektör Ekle" }));
    expect(saveManufacturingProject).not.toHaveBeenCalled();
    expect(records.projects).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Adet"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Projeler" }));
    expect(await screen.findByText("Henüz kayıtlı kollektör yok.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kapat" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(saveManufacturingProject).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(saveManufacturingProject).mock.calls[0]?.[0]?.[1];
    expect(saved?.quantity).toBe(25);
    expect(records.projects).toHaveLength(2);
    expect(records.projects[0]?.customerName).toBe("İsimsiz Müşteri");
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 1 ·/ }));
    expect(screen.getByLabelText("Adet")).toHaveValue("7");
    expect(saveManufacturingProject).toHaveBeenCalledTimes(1);
    expect(records.projects[1]?.quantity).toBe(25);
  });
  it("confirmed cancellation returns to the list without saving the draft", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    editor();
    fireEvent.change(screen.getByLabelText("Adet"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Kollektör 1 iptal et" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(saveManufacturingProject).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Adet")).toHaveValue(String(newProject().quantity));
    expect(screen.getByRole("heading", { name: "Kayıtlı projeler" })).toBeInTheDocument();
  });
  it("declining cancellation keeps the draft unchanged", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    editor();
    fireEvent.change(screen.getByLabelText("Adet"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Kollektör 1 iptal et" }));
    expect(screen.getByLabelText("Adet")).toHaveValue("25");
    expect(screen.queryByRole("heading", { name: "Kayıtlı projeler" })).not.toBeInTheDocument();
    expect(saveManufacturingProject).not.toHaveBeenCalled();
  });
  it("New resets edited fields and excludes previous unnamed collectors", async () => {
    records.projects = [{ ...newProject(), id: "old-unnamed", customerName: "İsimsiz Müşteri", count: 16 }];
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Projeler" }));
    fireEvent.click(await screen.findByRole("button", { name: /İsimsiz Müşteri.*1 kollektör/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kollektör 1 Ø/ }));
    expect(screen.getByLabelText("Çıkış sayısı")).toHaveValue("16");
    fireEvent.change(screen.getByLabelText("Üretim notu"), { target: { value: "Eski not" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Yeni" }));
    expect(screen.getByLabelText("Müşteri adı (isteğe bağlı)")).toHaveValue("");
    expect(screen.getByLabelText("Çıkış sayısı")).toHaveValue("4");
    expect(screen.getByLabelText("Üretim notu")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Tümünü PDF Oluştur (1 sayfa)" })).toBeInTheDocument();
    expect(records.projects).toHaveLength(1);
    expect(saveManufacturingProject).not.toHaveBeenCalled();
  });
  it("adds only the session's collectors and cancels the added one without deleting saved records", async () => {
    records.projects = [{ ...newProject(), id: "old-unnamed", customerName: "İsimsiz Müşteri", count: 16 }];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    editor();
    fireEvent.click(screen.getByRole("button", { name: "+ Kollektör Ekle" }));
    await screen.findByRole("button", { name: "Kollektör 2 iptal et" });
    expect(screen.getByRole("button", { name: "Tümünü PDF Oluştur (2 sayfa)" })).toBeInTheDocument();
    expect(records.projects).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Kollektör 2 iptal et" }));
    expect(screen.getByRole("heading", { name: "Kayıtlı projeler" })).toBeInTheDocument();
    expect(saveManufacturingProject).not.toHaveBeenCalled();
    expect(records.projects).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Kapat" }));
    expect(screen.getAllByRole("button", { name: /Kollektör \d ·/ })).toHaveLength(1);
    expect(screen.getByLabelText("Çıkış sayısı")).toHaveValue("4");
  });
});