export const PIPE_SIZES = ["1/2", "3/4", "1", "1 1/4", "1 1/2", "2", "2 1/2", "3", "4", "5", "6"] as const;

export type Layout = "tek" | "karsilikli" | "capraz";
export type Thread = "acik" | "kapali" | "cift";
export type MainEndType = "open-open" | "closed-closed" | "open-closed" | "closed-flanged" | "flanged-flanged" | "open-flanged";
export const MAIN_END_LABELS: Record<MainEndType, string> = { "open-open": "İki Tarafı Açık", "closed-closed": "İki Tarafı Kapalı", "open-closed": "Bir Tarafı Açık Bir Tarafı Kapalı", "closed-flanged": "Bir Tarafı Kapalı Bir Tarafı Flanşlı", "flanged-flanged": "İki Tarafı Flanşlı", "open-flanged": "Bir Tarafı Açık Bir Tarafı Flanşlı" };
export interface MainEndSetting { size: string; connection: "male" | "socket" }
export type MainEnds = { left?: MainEndSetting; right?: MainEndSetting };
export const mainEndType = (p: Project): MainEndType => p.mainEndType ?? (p.thread === "cift" ? "open-open" : "open-closed");
export const mainEndSetting = (p: Project, side: "left" | "right"): MainEndSetting => p.mainEnds?.[side] ?? { size: p.mainSize, connection: "male" };
export const pipeDiameterMm = (size: string): number => ({ "1/2": 21.3, "3/4": 26.9, "1": 33.7, "1 1/4": 42.4, "1 1/2": 48.3, "2": 60.3, "2 1/2": 76.1, "3": 88.9, "4": 114.3, "5": 139.7, "6": 168.3 }[size] ?? 60.3);
export interface Branch { size: string; length: number; spacing: number; connection: "male" | "flanged" | "socket" }
export interface AuxiliaryOutlet { position: "left" | "right" | "center-top" | "center-bottom" | "bottom-left" | "bottom-right"; size: string; length: number; offset: number }
export type AuxiliaryOutlets = { drain?: AuxiliaryOutlet; gauge?: AuxiliaryOutlet };
export function defaultAuxiliaryOutlet(kind: "drain" | "gauge"): AuxiliaryOutlet {
  return { position: "right", size: kind === "gauge" ? "1/2" : "3/4", length: 5, offset: 2 };
}
export function branchSettings(p: Project): Branch[] {
  return Array.from({ length: Math.min(60, Math.max(1, Math.floor(p.count) || 1)) }, (_, i) => p.branches?.[i] ?? { size: p.outSize, length: 10, spacing: p.spacing, connection: "male" });
}

export const LAYOUT_LABELS: Record<Layout, string> = { tek: "Tek sıra", karsilikli: "Karşılıklı", capraz: "Çapraz" };
export const THREAD_LABELS: Record<Thread, string> = { acik: "Açık tek", kapali: "Kapalı tek", cift: "Çift tarafı dişli" };
export const THREAD_HINTS: Record<Thread, string> = {
  acik: "Fazla (tek) çıkış dişli giriş ucu tarafında, son uç kapalı",
  kapali: "Fazla (tek) çıkış kapalı uç tarafında, giriş ucu dişli",
  cift: "Ana borunun iki ucu da dişli, fazla (tek) çıkış sağ uçta",
};

export interface Project {
  id: string;
  name: string;
  customerName: string;
  notes: string;
  mainSize: string;
  outSize: string;
  count: number;
  spacing: number;
  start: number;
  end: number;
  layout: Layout;
  thread: Thread;
  date: string;
  quantity: number;
  updatedAt: number;
  batchId?: string;
  batchSavedAt?: number;
  batchPosition?: number;
  projectId?: string | undefined;
  projectTitle?: string | undefined;
  mainEndType?: MainEndType | undefined;
  mainEnds?: MainEnds | undefined;
  branches?: Branch[] | undefined;
  auxiliaryOutlets?: AuxiliaryOutlets | undefined;
}

export const DEFAULT_NAME = "İsimsiz proje";
export const DEFAULT_CUSTOMER = "İsimsiz Müşteri";

export const customerLabel = (name: string) => name.trim() || DEFAULT_CUSTOMER;
const customerKey = (name: string) => customerLabel(name).toLocaleLowerCase("tr-TR");

export function groupCustomerProjects(projects: Project[]) {
  const groups = new Map<string, { key: string; name: string; projects: Project[] }>();
  for (const project of projects) {
    const name = customerLabel(normalizeProject(project).customerName);
    const key = customerKey(name);
    const group = groups.get(key);
    if (group) group.projects.push(project);
    else groups.set(key, { key, name, projects: [project] });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
}

export function todayDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Legacy records have no reliable save-group history: keep each isolated. */
export function savedBatches(projects: Project[]) {
  const groups = new Map<string, { id: string; savedAt: number; projects: Project[] }>();
  for (const project of projects) {
    const id = project.projectId ?? project.batchId ?? `legacy:${project.id}`;
    const group = groups.get(id);
    if (group) group.projects.push(project);
    else groups.set(id, { id, savedAt: project.batchSavedAt ?? project.updatedAt, projects: [project] });
  }
  return [...groups.values()].map((group) => ({ ...group, projects: group.projects.sort((a, b) => (a.batchPosition ?? 0) - (b.batchPosition ?? 0)) }))
    .sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id));
}

/** Without existingBatchId: new immutable save with fresh IDs. With it: overwrite that save group, keeping member IDs. */
export function saveSnapshot(projects: Project[], customerName: string, savedAt = Date.now(), existingBatchId?: string): Project[] {
  const batchId = existingBatchId ?? crypto.randomUUID();
  return projects.map((project, batchPosition) => ({ ...project, id: existingBatchId ? project.id : crypto.randomUUID(), customerName: customerLabel(customerName), batchId, batchSavedAt: savedAt, batchPosition, updatedAt: savedAt }));
}

export function normalizeProject(p: Project): Project {
  return { ...p, customerName: p.customerName ?? "", notes: p.notes ?? "", quantity: p.quantity ?? 1, date: p.date ?? todayDate(new Date(p.updatedAt)) };
}

export function newProject(): Project {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: "",
    customerName: "",
    notes: "",
    mainSize: "2",
    outSize: "3/4",
    count: 4,
    spacing: 20,
    start: 10,
    end: 4,
    layout: "karsilikli",
    thread: "kapali",
    date: todayDate(),
    quantity: 1,
    updatedAt: Date.now(),
  };
}

export interface Outlet {
  /** distance in cm from the first outlet position (position 0) */
  pos: number;
  side: "top" | "bottom";
}

/**
 * Outlet placement. Positions are counted from the first outlet axis.
 * - tek: N positions, all on top
 * - capraz: N positions alternating bottom/top (staggered)
 * - karsilikli: ceil(N/2) positions with pairs; an odd extra outlet sits alone
 *   at the threaded inlet end (acik) or at the far end (kapali / cift).
 * Total length = start + (positions - 1) * spacing + end  (each cm counted once).
 */
export function computeLayout(p: Pick<Project, "count" | "spacing" | "start" | "end" | "layout" | "thread" | "branches"> & { auxiliaryOutlets?: AuxiliaryOutlets | undefined }) {
  const n = Math.max(1, Math.floor(p.count));
  const s = p.spacing;
  const outlets: Outlet[] = [];
  let positions: number;
  if (p.layout === "tek") {
    positions = n;
    for (let i = 0; i < n; i++) outlets.push({ pos: i * s, side: "top" });
  } else if (p.layout === "capraz") {
    positions = n;
    for (let i = 0; i < n; i++) outlets.push({ pos: i * s, side: i % 2 === 0 ? "bottom" : "top" });
  } else {
    positions = Math.ceil(n / 2);
    const odd = n % 2 === 1;
    const singleAt = odd ? (p.thread === "acik" ? 0 : positions - 1) : -1;
    for (let i = 0; i < positions; i++) {
      if (i !== singleAt) outlets.push({ pos: i * s, side: "top" });
      outlets.push({ pos: i * s, side: "bottom" });
    }
  }
  if (p.branches) {
    // Branch numbering is left-to-right, top before bottom; each side has its own axis chain.
    outlets.sort((a, b) => a.pos - b.pos || (a.side === "top" ? -1 : 1));
    const previous: Record<Outlet["side"], number | undefined> = { top: undefined, bottom: undefined };
    outlets.forEach((o, i) => { const prev = previous[o.side]; o.pos = prev === undefined ? 0 : prev + (p.branches?.[i]?.spacing ?? s); previous[o.side] = o.pos; });
  }
  const extent = p.branches ? Math.max(0, ...outlets.map((o) => o.pos)) : (positions - 1) * s;
  // End fittings sit outside the numbered outlets: left ones before C1, right ones after the last outlet.
  const aux = Object.values(p.auxiliaryOutlets ?? {}).filter((o): o is AuxiliaryOutlet => Boolean(o));
  const extra = (side: "left" | "right") => Math.max(0, ...aux.filter(o => o.position === side || o.position === `bottom-${side}`).map(o => Number.isFinite(o.offset) ? o.offset : 0));
  const leftExtra = extra("left"), rightExtra = extra("right");
  const total = leftExtra + p.start + extent + p.end + rightExtra;
  return { outlets, positions, leftExtra, total: Math.round(total * 100) / 100 };
}

export function validate(p: Project): string[] {
  const e: string[] = [];
  for (const [kind, outlet] of Object.entries(p.auxiliaryOutlets ?? {})) {
    if (!outlet) continue;
    const allowed = kind === "gauge" ? ["left", "right", "bottom-left", "bottom-right"] : ["left", "right", "center-top", "center-bottom"];
    const centered = outlet.position.startsWith("center-");
    if (!allowed.includes(outlet.position) || !PIPE_SIZES.includes(outlet.size as typeof PIPE_SIZES[number]) || !Number.isFinite(outlet.length) || outlet.length <= 0 || (!centered && (!Number.isFinite(outlet.offset) || outlet.offset <= 0 || outlet.offset >= computeLayout(p).total))) e.push(`${kind === "gauge" ? "Manometre" : "Boşaltma"} çıkışı: çap, boy ve uçtan aks ölçüsünü kontrol edin.`);
  }
  mainEndType(p).split("-").forEach((kind, i) => {
    const setting = mainEndSetting(p, i === 0 ? "left" : "right");
    if (kind === "open" && (!PIPE_SIZES.includes(setting.size as typeof PIPE_SIZES[number]) || !["male", "socket"].includes(setting.connection))) e.push(`${i === 0 ? "Sol" : "Sağ"} açık uç: çap ve bağlantıyı kontrol edin.`);
  });
  if (p.mainEndType && !(p.mainEndType in MAIN_END_LABELS)) e.push("Ana boru uç tipi geçersiz.");
  if (!PIPE_SIZES.includes(p.mainSize as typeof PIPE_SIZES[number])) e.push("Ana boru çapı geçersiz.");
  if (p.branches) branchSettings(p).forEach((b, i) => {
    if (!PIPE_SIZES.includes(b.size as typeof PIPE_SIZES[number]) || !Number.isFinite(b.length) || b.length <= 0 || !Number.isFinite(b.spacing) || b.spacing <= 0 || !["male", "flanged", "socket"].includes(b.connection)) e.push(`C${i + 1}: çap, boy, aks aralığı ve bağlantıyı kontrol edin.`);
  });
  if (!Number.isSafeInteger(p.quantity) || p.quantity < 1) e.push("Adet 1 veya daha büyük bir tam sayı olmalı.");
  if (p.date && (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || Number.isNaN(Date.parse(p.date)) || new Date(p.date).toISOString().slice(0, 10) !== p.date)) e.push("Tarih geçersiz.");
  if (!Number.isFinite(p.count) || p.count < 1 || p.count > 60 || !Number.isInteger(p.count)) e.push("Çıkış sayısı 1 ile 60 arasında tam sayı olmalı.");
  if (!Number.isFinite(p.spacing) || p.spacing <= 0) e.push("Çıkışlar arası mesafe 0'dan büyük olmalı.");
  if (!Number.isFinite(p.start) || p.start < 0) e.push("Başlangıç uzunluğu geçersiz.");
  if (!Number.isFinite(p.end) || p.end < 0) e.push("Kapalı uzunluk geçersiz.");
  return e;
}

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/** One ordered production schedule for drawing, PDF and fitting placement. */
export function manufacturingRows(p: Project) {
  const layout = computeLayout(p);
  const outlets = p.branches ? layout.outlets : [...layout.outlets].sort((a, b) => a.pos - b.pos || (a.side === "top" ? -1 : 1));
  const branches = branchSettings(p);
  const seen = new Set<string>();
  const rows = outlets.map((o, i) => {
    const b = branches[i] ?? { size: p.outSize, length: 10, spacing: p.spacing, connection: "male" as const };
    const first = !seen.has(o.side); seen.add(o.side);
    return { id: `C${i + 1}`, size: b.size, length: b.length, axis: first ? p.start : b.spacing, side: o.side, position: layout.leftExtra + p.start + o.pos, connection: b.connection, end: undefined as "left" | "right" | undefined };
  });
  for (const kind of ["drain", "gauge"] as const) {
    const o = p.auxiliaryOutlets?.[kind];
    if (o) {
      const centered = o.position.startsWith("center-");
      const end = centered ? undefined : o.position === "left" || o.position === "bottom-left" ? "left" as const : "right" as const;
      const side = o.position === "center-top" ? "top" : o.position === "center-bottom" || o.position.startsWith("bottom-") || kind === "drain" ? "bottom" : "top";
      rows.push({ id: kind === "drain" ? "B1" : "M1", size: o.size, length: o.length, axis: centered ? layout.total / 2 : o.offset, side, position: centered ? layout.total / 2 : end === "left" ? o.offset : layout.total - o.offset, connection: "male", end });
    }
  }
  return rows;
}

const VULGAR: Record<string, string> = { "1/4": "¼", "1/2": "½", "3/4": "¾" };
/** Mixed inch sizes ("1 1/2") render as "1½"; plain fractions ("3/4") stay as-is. */
export const inchFlat = (size: string) => size.trim().replace(/^(\d+)\s+(\d\/\d)$/, (_, whole: string, frac: string) => `${whole}${VULGAR[frac] ?? frac}`);

/** Include the current edit once, and only other collectors belonging to this customer. */
export function customerProjects(current: Project, saved: Project[]): Project[] {
  const key = customerKey(current.customerName);
  const siblings = saved.filter((x) => x.id === current.id || customerKey(normalizeProject(x).customerName) === key);
  return siblings.some((x) => x.id === current.id)
    ? siblings.map((x) => x.id === current.id ? current : x)
    : [...siblings, current];
}

export function noteLines(notes: string): string[] {
  let remaining = notes.replace(/\s+/g, " ").trim().slice(0, 180);
  const lines: string[] = [];
  while (remaining) {
    const space = remaining.lastIndexOf(" ", 64);
    const cut = remaining.length <= 64 ? remaining.length : space >= 48 ? space : 64;
    lines.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return lines;
}
