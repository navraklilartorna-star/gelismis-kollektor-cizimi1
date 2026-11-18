import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "@/components/AccountProvider";
import { AccountDialog } from "@/components/AccountDialog";
import { supabase } from "@/integrations/supabase/client";
import { listCloudProjects, saveCloudProject, saveManufacturingProject, deleteCloudProject } from "@/lib/cloud-projects";
import { BranchEditor } from "@/components/BranchEditor";
import { MainEndEditor } from "@/components/MainEndEditor";
import { AuxiliaryOutletEditor } from "@/components/AuxiliaryOutletEditor";
import { buildDrawingPages } from "@/lib/drawing";
import { Drawing } from "@/components/Drawing";
import { logoUrl } from "@/assets/logo";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, Download, Folder, X } from "lucide-react";
import {
  PIPE_SIZES, LAYOUT_LABELS, computeLayout, fmt, inchFlat, newProject, normalizeProject, validate,
  customerLabel, groupCustomerProjects, savedBatches, saveSnapshot, mainEndKind, mainEndSetting, type Layout, type Project,
} from "@/lib/collector";

/** Default start length per layout: tek sıra 8 cm, karşılıklı 10 cm. */
const LAYOUT_START: Record<Layout, string> = { tek: "8", karsilikli: "10", capraz: "8" };
const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gelişmiş Kollektör İmalat ve Çizim – Navraklılar Torna" },
      { name: "description", content: "Ayrı müşteri ve proje kayıtları, özel branşman ölçüleri ve teknik imalat PDF paftaları." },
      { property: "og:title", content: "Gelişmiş Kollektör İmalat ve Çizim – Navraklılar Torna" },
      { property: "og:description", content: "Müşteri projelerinizi ve her kollektörün özel branşmanlarını güvenle kaydedin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const KEY = "navrak-projects";
const load = (): Project[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]").map(normalizeProject); } catch { return []; } };

function Seg<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted p-1">
      {(Object.keys(options) as T[]).map((k) => (
        <Button key={k} type="button" variant="ghost" onClick={() => onChange(k)} aria-pressed={value === k}
          className={`rounded-lg px-1 py-3 text-sm font-semibold transition ${value === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          {options[k]}
        </Button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col justify-end"><span className="mb-1.5 block text-sm font-semibold text-muted-foreground">{label}</span>{children}</label>;
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return <div><span className="mb-1.5 block text-sm font-semibold text-muted-foreground">{label}</span>{children}</div>;
}

const inputCls = "block h-14 min-w-0 w-full max-w-full rounded-xl border border-input bg-card px-4 py-3 font-mono text-lg text-foreground outline-none focus:border-accent";
type NumericFields = { count: string; spacing: string; start: string; end: string; quantity: string };
type EditorDraft = { project: Project; nums: NumericFields };

function Index() {
  const [p, setP] = useState<Project>(newProject);
  const [nums, setNums] = useState({ count: "4", spacing: "20", start: "10", end: "4", quantity: "1" });
  const { user, ready } = useAccount();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const projectsQuery = useQuery({ queryKey: ["collectors", userId], queryFn: () => userId ? listCloudProjects(userId) : Promise.resolve([]), enabled: Boolean(userId), retry: 1 });
  const list = userId ? projectsQuery.data ?? [] : [];
  const adminQuery = useQuery({ queryKey: ["is-admin", userId], enabled: Boolean(userId), retry: 1, queryFn: async () => { const { data, error } = await supabase.rpc("is_admin"); if (error) throw error; return data === true; } });
  const isAdmin = Boolean(userId) && adminQuery.data === true;
  const [legacy, setLegacy] = useState<Project[]>([]);
  const [showAccount, setShowAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const previousUser = useRef<string | undefined>(undefined);
  const [showList, setShowList] = useState(false);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [activeBatch, setActiveBatch] = useState<{ id: string; ids: string[] } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditorDraft>>({});
  const saveLock = useRef(false);
  const [pdf, setPdf] = useState<{ blob: Blob; url: string; name: string; format: "PDF" | "PNG"; deliver: (b: Blob, n: string) => Promise<void>; download: (b: Blob, n: string) => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => { setLegacy(load()); }, []);
  useEffect(() => {
    if (previousUser.current && previousUser.current !== userId) {
      setP(newProject()); setNums({ count: "4", spacing: "20", start: "10", end: "4", quantity: "1" });
      setSessionIds([]); setActiveBatch(null);
      setDrafts({});
      setPdf(null); setShowList(false);
    }
    previousUser.current = userId;
  }, [userId]);
  useEffect(() => { if (userId) setShowAccount(false); }, [userId]);
  useEffect(() => {
    if (!pdf) return;
    const url = pdf.url;
    return () => { setTimeout(() => URL.revokeObjectURL(url), 60_000); };
  }, [pdf]);

  const parsed: Project = useMemo(() => ({
    ...p,
    quantity: Number(nums.quantity),
    count: Number(nums.count), spacing: Number(nums.spacing.replace(",", ".")),
    start: Number(nums.start.replace(",", ".")), end: Number(nums.end.replace(",", ".")),
  }), [p, nums]);
  const errors = validate(parsed);
  const bothEndsClosed = mainEndKind(parsed, "left") === "closed" && mainEndKind(parsed, "right") === "closed";
  const ok = errors.length === 0 && Object.values(nums).every((value) => value.trim() !== "");
  const total = ok ? computeLayout(parsed).total : null;
  const candidates = new Map(list.map((x) => [x.id, x]));
  for (const [id, draft] of Object.entries(drafts)) candidates.set(id, draft.project);
  candidates.set(parsed.id, parsed);
  const batch = [...new Set([...sessionIds, parsed.id])].flatMap((id) => {
    const item = candidates.get(id);
    return item ? [{ ...item, customerName: p.customerName, projectTitle: p.projectTitle, projectId: p.projectId }] : [];
  });
  const customerGroups = useMemo(() => groupCustomerProjects(list), [list]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 5000); };
  const openProject = (x: Project, draft?: EditorDraft) => { const item = normalizeProject(draft?.project ?? x); setP(item); setNums(draft?.nums ?? { count: String(item.count), spacing: String(item.spacing), start: String(item.start), end: String(item.end), quantity: String(item.quantity) }); setPdf(null); setShowList(false); };
  const switchCollector = (x: Project) => {
    if (x.id === p.id || saveLock.current) return;
    setDrafts((old) => ({ ...old, [p.id]: { project: parsed, nums: { ...nums } } }));
    setSessionIds((ids) => [...new Set([...ids, p.id, x.id])]);
    const draft = drafts[x.id];
    openProject({ ...x, customerName: p.customerName, projectTitle: p.projectTitle, projectId: p.projectId }, draft ? { ...draft, project: { ...draft.project, customerName: p.customerName, projectTitle: p.projectTitle, projectId: p.projectId } } : undefined);
  };
  const openBatch = (items: Project[], selected = items[0]) => {
    if (!selected || saveLock.current) return;
    setActiveBatch({ id: items[0]?.projectId ?? items[0]?.batchId ?? crypto.randomUUID(), ids: items.map((x) => x.id) });
    setDrafts({}); setSessionIds(items.map((x) => x.id)); openProject(selected);
  };
  const startNew = () => { if (saveLock.current) return; setActiveBatch(null); setDrafts({}); setSessionIds([]); setPdf(null); openProject(newProject()); };
  const save = async (): Promise<boolean> => {
    if (!ok) { flash("Önce hataları düzeltin"); return false; }
    if (!userId) { setShowAccount(true); return false; }
    if (saveLock.current) return false;
    if (batch.some((item) => {
      const draft = drafts[item.id];
      return validate(item).length > 0 || (item.id !== p.id && draft !== undefined && Object.values(draft.nums).some((value) => !value.trim()));
    })) {
      flash("Tüm kollektörlerin ölçülerini kontrol edin"); return false;
    }
    const snapshot = saveSnapshot(batch, p.customerName, Date.now(), activeBatch?.id);
    const position = batch.findIndex((x) => x.id === p.id);
    saveLock.current = true; setSaving(true);
    try {
      const keep = new Set(snapshot.map((x) => x.id));
      const removed = activeBatch ? activeBatch.ids.filter((id) => !keep.has(id)) : [];
      const saved = await saveManufacturingProject(snapshot, userId);
      const savedIds = new Set(saved.map((x) => x.id));
      queryClient.setQueryData<Project[]>(["collectors", userId], (old = []) => [...old.filter((x) => !savedIds.has(x.id) && !removed.includes(x.id)), ...saved]);
      void queryClient.invalidateQueries({ queryKey: ["collectors", userId] });
      // Further saves of this editor session overwrite the same group instead of duplicating it.
      const savedBatchId = saved[0]?.projectId ?? saved[0]?.batchId;
      if (savedBatchId) setActiveBatch({ id: savedBatchId, ids: saved.map((x) => x.id) });
      setDrafts({}); setSessionIds(saved.map((x) => x.id));
      const current = saved[position] ?? saved[0];
      if (current) { setP(current); }
      flash(activeBatch ? "Kayıt güncellendi" : "Buluta kaydedildi"); return true;
    } catch (error) { flash(error instanceof Error ? error.message : "Kayıt tamamlanamadı"); return false; }
    finally { saveLock.current = false; setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!userId || !window.confirm("Bu kollektör buluttan silinsin mi?")) return;
    try {
      await deleteCloudProject(id, userId);
      queryClient.setQueryData<Project[]>(["collectors", userId], (old = []) => old.filter((x) => x.id !== id));
      // A deleted record must also leave the open editor group, or the next Save would recreate it.
      const remaining = batch.filter((item) => item.id !== id);
      setDrafts((old) => { const next = { ...old, ...Object.fromEntries(remaining.map((item) => [item.id, { project: item, nums: item.id === p.id ? { ...nums } : old[item.id]?.nums ?? { count: String(item.count), spacing: String(item.spacing), start: String(item.start), end: String(item.end), quantity: String(item.quantity) } }])) }; delete next[id]; return next; });
      setSessionIds((ids) => ids.filter((x) => x !== id));
      setActiveBatch((b) => b && { ...b, ids: b.ids.filter((x) => x !== id) });
      if (p.id === id) { const next = remaining[0]; if (next) openProject(next, drafts[next.id]); else { setActiveBatch(null); openProject(newProject()); } setShowList(true); }
      flash("Kayıt silindi");
    } catch (error) { flash(error instanceof Error ? error.message : "Kayıt silinemedi"); }
  };
  const importLegacy = async () => {
    if (!userId) { setShowAccount(true); return; }
    setSaving(true);
    try {
      const existing = await listCloudProjects(userId);
      for (const item of legacy) {
        // Never overwrite a newer cloud revision with an older device backup.
        const cloud = existing.find((x) => x.id === item.id);
        if (!cloud || cloud.updatedAt < item.updatedAt) await saveCloudProject(item, userId);
      }
      await queryClient.invalidateQueries({ queryKey: ["collectors", userId] });
      localStorage.removeItem(KEY); setLegacy([]); flash("Eski kayıtlar buluta aktarıldı");
    } catch (error) { flash(error instanceof Error ? error.message : "Aktarım tamamlanamadı; eski kayıtlar korunuyor"); }
    finally { setSaving(false); }
  };
  const signOut = async () => {
    await queryClient.cancelQueries(); queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) flash("Çıkış yapılamadı. Tekrar deneyin.");
  };
  const addCollector = () => {
    if (saveLock.current) return;
    if (!ok) return flash("Önce hataları düzeltin");
    setDrafts((old) => ({ ...old, [p.id]: { project: parsed, nums: { ...nums } } }));
    const next = { ...newProject(), customerName: customerLabel(p.customerName), projectTitle: p.projectTitle, projectId: p.projectId, date: p.date };
    setSessionIds((ids) => [...new Set([...ids, p.id, next.id])]);
    openProject(next);
  };
  const cancelDesign = () => {
    if (saveLock.current) return;
    if (!window.confirm("Bu tasarımı silmek/iptal etmek istediğinize emin misiniz?")) return;
    const remaining = batch.filter((x) => x.id !== p.id);
    setDrafts((old) => { const next = { ...old }; delete next[p.id]; return next; });
    setSessionIds(remaining.map((x) => x.id));
    const next = remaining[0];
    openProject(next ?? newProject(), next ? drafts[next.id] : undefined);
    setShowList(true);
  };
  const createPdf = async (all = false, format: "PDF" | "PNG" = "PDF") => {
    if (!ok) return flash("Önce hataları düzeltin");
    const items = all ? batch : [parsed];
    if (items.some((x) => validate(x).length > 0)) return flash("Müşterinin kollektörlerindeki hataları düzeltin");
    setBusy(true);
    try {
      const { makePdf, deliverFile, downloadBlob } = await import("@/lib/pdf");
      const blob = format === "PDF" ? await makePdf(items) : await (await import("@/lib/png")).makePng(parsed);
      const base = (parsed.customerName.trim() || "kollektor-cizim").replace(/[\\/:*?"<>|]+/g, "-");
      setPdf({ blob, url: URL.createObjectURL(blob), name: `${base}.${format.toLowerCase()}`, format, deliver: deliverFile, download: downloadBlob });
    } catch (e) { console.error(e); flash(`${format} oluşturulamadı`); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-primary px-4 py-2 sm:gap-3 sm:px-5 sm:py-4 text-primary-foreground">
        <div className="flex items-center gap-3 sm:block">
          <img src={logoUrl} alt="Navraklılar Torna" className="h-auto w-40 max-w-[50%] shrink-0 object-contain sm:mb-2 sm:w-60 sm:max-w-full" />
          <h1 className="max-w-xl text-sm font-bold leading-tight sm:text-2xl">Gelişmiş Kollektör İmalat ve Çizim</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => { setShowList(true); if (userId) void projectsQuery.refetch(); }} className="h-auto border border-primary-foreground/30 px-2.5 py-1.5 text-sm font-semibold sm:px-3 sm:py-2.5 sm:text-base">Projeler</Button>
          {isAdmin && <Button asChild variant="ghost" className="h-auto border border-primary-foreground/30 px-2.5 py-1.5 text-sm font-semibold sm:px-3 sm:py-2.5 sm:text-base"><Link to="/admin">Yönetici</Link></Button>}
          <Button variant="ghost" disabled={saving} onClick={startNew} className="h-auto border border-primary-foreground/30 px-2.5 py-1.5 text-sm font-semibold sm:px-3 sm:py-2.5 sm:text-base">+ Yeni</Button>
          <Button variant="ghost" disabled={!ready || saving} onClick={() => user ? signOut() : setShowAccount(true)} className="h-auto border border-primary-foreground/30 px-2.5 py-1.5 text-sm font-semibold sm:px-3 sm:py-2.5 sm:text-base"><span key={user ? "out" : "in"}>{user ? "Çıkış yap" : "Giriş yap"}</span></Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 p-4">
        {user && <p className="break-all text-sm text-muted-foreground">Bulut hesabı: {user.email}</p>}
        {legacy.length > 0 && <div className="space-y-2 border-y border-border py-3"><p>Bu cihazda {legacy.length} eski kayıt var.</p><Button variant="outline" disabled={saving} onClick={importLegacy}>Eski kayıtları buluta aktar</Button></div>}
        <fieldset disabled={saving} className="min-w-0 space-y-4 border-b border-border py-5">
          <Field label="Müşteri adı (isteğe bağlı)">
            <input className={inputCls} list="customer-names" maxLength={45} placeholder="Örn. Ahmet Bey" value={p.customerName} onChange={(e) => setP({ ...p, customerName: e.target.value })} />
            <datalist id="customer-names">{Array.from(new Set(list.map((x) => x.customerName).filter(Boolean))).map((name) => <option key={name} value={name} />)}</datalist>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tarih">
              <input type="date" className={`${inputCls} appearance-none font-sans text-base [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left`} value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} />
            </Field>
            <Field label="Adet">
              <input className={inputCls} inputMode="numeric" value={nums.quantity} onFocus={selectAll} onChange={(e) => setNums({ ...nums, quantity: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ana boru (inç)">
              <select className={inputCls} value={p.mainSize} onChange={(e) => setP({ ...p, mainSize: e.target.value })}>
                {PIPE_SIZES.map((s) => <option key={s} value={s}>{inchFlat(s)}″</option>)}
              </select>
            </Field>
            {([["count", "Çıkış sayısı", "numeric"], ["start", "Başlangıç uzunluğu (cm)", "decimal"], ["end", p.thread === "cift" ? "Son uç uzunluğu (cm)" : "Kapalı uzunluk (cm)", "decimal"]] as const).map(([k, l, m]) => (
              <Field key={k} label={l}>
                <input className={inputCls} inputMode={m} value={nums[k]} onFocus={selectAll} onChange={(e) => setNums({ ...nums, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          <Group label="Çıkış düzeni"><Seg<Layout> value={p.layout} options={LAYOUT_LABELS} onChange={(layout) => { setP({ ...p, layout }); setNums((old) => ({ ...old, start: LAYOUT_START[layout] })); }} /></Group>
          <Field label="Kollektör tipi"><select className={`${inputCls} font-sans text-base`} value={bothEndsClosed ? "closed" : "configurable"} onChange={e => {
            const closed = e.target.value === "closed";
            setP({ ...p, mainEnds: {
              left: { ...mainEndSetting(p, "left"), kind: closed ? "closed" : "male" },
              right: { ...mainEndSetting(p, "right"), kind: "closed" },
            } });
            setPdf(null);
          }}><option value="closed">İki tarafı kapalı</option><option value="configurable">Bir tarafı açık</option></select></Field>
          {!bothEndsClosed && <MainEndEditor project={parsed} onChange={mainEnds => { setP({ ...p, mainEnds }); setPdf(null); }} />}
          <BranchEditor project={parsed} onChange={branches => setP({ ...p, branches })} />
          <AuxiliaryOutletEditor project={parsed} onChange={auxiliaryOutlets => { setP({ ...p, auxiliaryOutlets }); setPdf(null); }} />
          <Field label="Üretim notu">
            <textarea className={`${inputCls} h-28 resize-y font-sans text-base`} maxLength={180} placeholder="Örn. Çıkışlar kaynak sonrası kontrol edilecek." value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
          </Field>
          {errors.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-destructive/10 p-4 text-destructive">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>
          )}
        </fieldset>

        <section className="space-y-3 border-y border-border py-4">
          <h2 className="break-words text-lg font-bold">{customerLabel(p.customerName)} — Kollektörler ({batch.length})</h2>
          <div className="space-y-2">{batch.map((x, i) => <div key={x.id} className="flex items-center gap-2">
            <Button disabled={saving} variant={x.id === p.id ? "secondary" : "outline"} className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left" onClick={() => switchCollector(x)}>
              <span className="min-w-0 break-words">Kollektör {i + 1} · {x.count} çıkış · {x.quantity} adet · {fmt(computeLayout(x).total)} cm<span>{x.id === p.id ? " • Açık" : ""}</span></span>
            </Button>
            {x.id === p.id && <Button variant="outline" size="icon" disabled={saving || busy} className="h-11 w-11 shrink-0 border-destructive text-destructive" aria-label={`Kollektör ${i + 1} iptal et`} title="Kollektörü iptal et" onClick={cancelDesign}><X /></Button>}
          </div>)}</div>
          <Button variant="outline" className="h-12 w-full" disabled={saving} onClick={addCollector}>+ Kollektör Ekle</Button>
          <Button className="h-12 w-full" disabled={!ok || busy || Boolean(userId && (projectsQuery.isPending || projectsQuery.isError))} onClick={() => createPdf(true)}><FileText />Tümünü PDF Oluştur ({batch.reduce((sum,x) => sum + buildDrawingPages(x).length, 0)} sayfa)</Button>
        </section>

        <div className="flex items-center justify-between rounded-2xl bg-primary px-6 py-5 text-primary-foreground">
          <span className="text-lg">Toplam uzunluk</span>
          <span className="font-mono text-3xl font-bold text-accent">{total !== null ? `${fmt(total)} cm` : "—"}</span>
        </div>

        <section className="overflow-x-auto border border-border bg-card">
          <div className="min-w-[640px]">{ok && <Drawing project={parsed} />}</div>
        </section>
        <Button variant="outline" onClick={() => createPdf(false, "PNG")} disabled={busy || !ok} className="h-12 w-full"><Download />PNG resim olarak indir</Button>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 flex gap-3 border-t border-border bg-background/95 p-4 backdrop-blur">
        <Button onClick={() => save()} disabled={saving || !ready} className="h-auto flex-1 rounded-2xl py-4 text-lg font-bold"><span key={saving ? "s" : "i"}>{saving ? "Kaydediliyor…" : "Kaydet"}</span></Button>
        <Button onClick={() => createPdf()} disabled={busy} className="h-auto flex-[2] rounded-2xl bg-accent py-4 text-lg font-bold text-accent-foreground shadow-lg disabled:opacity-60">
          <span key={busy ? "b" : "i"}>{busy ? "Hazırlanıyor…" : "PDF Oluştur"}</span>
        </Button>
      </footer>

      {pdf && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-foreground/50 p-4 sm:items-center" onClick={() => setPdf(null)}>
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{pdf.format} hazır</h2>
            <p className="break-all text-sm text-muted-foreground">{pdf.name}</p>
            <Button asChild className="h-auto w-full rounded-xl bg-accent py-4 text-lg font-bold text-accent-foreground">
              <a href={pdf.url} target="_blank" rel="noopener noreferrer"><FileText />{pdf.format === "PDF" ? "PDF’yi Aç" : "Resmi Aç"}</a>
            </Button>
            <Button variant="outline" onClick={() => (pdf.format === "PDF" ? Promise.resolve(pdf.download(pdf.blob, pdf.name)) : pdf.deliver(pdf.blob, pdf.name)).catch(() => flash("Paylaşım tamamlanamadı; dosyayı açıp kaydedebilirsiniz."))} className="h-auto w-full rounded-xl py-3 font-semibold"><Download />{pdf.format === "PDF" ? "PDF’yi Dosyalar’a indir" : "PNG resim olarak indir"}</Button>
            <Button variant="outline" onClick={() => pdf.deliver(pdf.blob, pdf.name).catch(() => flash("Paylaşım tamamlanamadı; dosyayı açıp kaydedebilirsiniz."))} className="h-auto w-full rounded-xl py-3 font-semibold">Paylaş / Kaydet</Button>
            <Button variant="outline" onClick={() => setPdf(null)} className="h-auto w-full rounded-xl py-3 font-semibold">Kapat</Button>
          </div>
        </div>
      )}

      {showList && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-foreground/50 p-4 sm:items-center" onClick={() => setShowList(false)}>
          <div className="max-h-[80vh] w-full max-w-md space-y-2 overflow-y-auto rounded-2xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-bold">Kayıtlı projeler</h2>
            {!userId && <Button className="w-full" onClick={() => setShowAccount(true)}>Kayıtlarınızı görmek için giriş yapın</Button>}
            {userId && projectsQuery.isPending && <p role="status">Kayıtlar yükleniyor…</p>}
            {userId && projectsQuery.isError && <div role="alert"><p>Bulut kayıtları yüklenemedi.</p><Button variant="outline" onClick={() => projectsQuery.refetch()}>Tekrar dene</Button></div>}
            {userId && projectsQuery.isSuccess && list.length === 0 && <p className="text-muted-foreground">Henüz kayıtlı kollektör yok.</p>}
            <Accordion type="multiple" className="w-full">
              {customerGroups.map((group) => <AccordionItem key={group.key} value={group.key}>
                <AccordionTrigger className="gap-3 text-base">
                  <span className="flex min-w-0 items-center gap-2"><Folder className="h-5 w-5 shrink-0 text-accent" /><span className="break-words">{group.name}</span></span>
                  <span className="ml-auto shrink-0 text-sm text-muted-foreground">{group.projects.length} kollektör</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  {savedBatches(group.projects).map((record, recordIndex) => <div key={record.id} className="space-y-1 border-l-2 border-border pl-2">
                    <Button disabled={saving} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => openBatch(record.projects)}>
                      {`Kayıt ${recordIndex + 1}`} · {record.projects.length} Kollektör · {new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" }).format(new Date(record.savedAt))}
                    </Button>
                    {record.projects.map((x, i) => <div key={x.id} className="flex items-center gap-2">
                      <Button disabled={saving} variant="ghost" className="h-auto min-w-0 flex-1 flex-col items-start whitespace-normal text-left" onClick={() => openBatch(record.projects, x)}>
                        <span className="font-semibold">Kollektör {i + 1}</span>
                        <span className="text-xs text-muted-foreground">Ø{x.mainSize}″ • {x.count} çıkış • {x.quantity} adet • {LAYOUT_LABELS[x.layout]} • {x.date}</span>
                      </Button>
                      <Button disabled={saving} variant="ghost" size="icon" onClick={() => void remove(x.id)} aria-label={`Kollektör ${i + 1} sil`} title="Kollektörü sil" className="shrink-0 text-destructive"><X /></Button>
                    </div>)}
                  </div>)}
                </AccordionContent>
              </AccordionItem>)}
            </Accordion>
            <Button variant="outline" onClick={() => setShowList(false)} className="mt-2 h-auto w-full rounded-xl py-3 font-semibold">Kapat</Button>
          </div>
        </div>
      )}

      {showAccount && <AccountDialog onClose={() => setShowAccount(false)} />}
      {toast && <div role="status" className="fixed inset-x-4 bottom-28 z-40 mx-auto w-fit max-w-lg rounded-xl bg-primary px-4 py-2 text-primary-foreground">{toast}</div>}
    </div>
  );
}
