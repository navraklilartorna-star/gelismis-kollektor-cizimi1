import { computeLayout, fmt, inchFlat, LAYOUT_LABELS, THREAD_LABELS, normalizeProject, noteLines, type Project } from "./collector";

export const W = 1000;
export const H = 707;

export type TextPart = { text: string; s: number; bold?: boolean } | { frac: [string, string]; s: number; bold?: boolean };

export type Prim =
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; w: number; c: string; dash?: number[] }
  | { t: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number }
  | { t: "poly"; pts: [number, number][]; fill: string }
  | { t: "text"; x: number; y: number; s: number; text: string; bold?: boolean; c: string; anchor?: "start" | "middle" | "end" }
  | { t: "texts"; x: number; y: number; c: string; anchor?: "start" | "middle" | "end"; parts: TextPart[] };

const CHAR_W = 0.62;
export const partWidth = (part: TextPart) =>
  "frac" in part ? Math.max(part.frac[0].length, part.frac[1].length) * part.s * CHAR_W + part.s * 0.35 : part.text.length * part.s * CHAR_W;
export const textsWidth = (parts: TextPart[]) => parts.reduce((sum, part) => sum + partWidth(part), 0);

/** Mixed inch sizes ("1 1/2") become a normal integer plus a small stacked fraction; plain fractions stay flat. */
export function inchParts(size: string, s: number, bold = true): TextPart[] {
  return [{ text: inchFlat(size), s, bold }];
}

/** Flat inch label with a clear space before the inch mark, e.g. "1¼ ″". */
export const inchLabel = (size: string) => `${inchFlat(size)} ″`;

const INK = "#111827";
const DIM = "#1d4ed8";
const THREAD = "#c2410c";
const PIPE = "#eef0f3";

export function buildDrawing(p: Project): Prim[] {
  p = normalizeProject(p);
  const { outlets, total } = computeLayout(p);
  const out: Prim[] = [];
  const name = p.customerName.trim() || "Kollektör çizimi";
  const th = p.thread;

  // frame + header
  out.push({ t: "rect", x: 8, y: 8, w: W - 16, h: H - 16, stroke: INK, sw: 2 });
  out.push({ t: "text", x: 30, y: 48, s: Math.min(28, 560 / Math.max(1, name.length * 0.65)), text: name, bold: true, c: INK });
  out.push({ t: "text", x: 30, y: 78, s: 17, text: `Düzen: ${LAYOUT_LABELS[p.layout]}  •  Bağlantı: ${THREAD_LABELS[th]}  •  Çıkış: ${p.count}`, c: INK });
  out.push({ t: "text", x: W - 30, y: 44, s: 17, text: "NAVRAKLILAR TORNA", bold: true, c: INK, anchor: "end" });
  out.push({ t: "text", x: W - 30, y: 70, s: 14, text: "Ölçüler: cm  •  Çaplar: inç", c: INK, anchor: "end" });
  out.push({ t: "text", x: 30, y: 119, s: 22, text: `TARİH: ${p.date ? p.date.split("-").reverse().join(".") : "—"}`, bold: true, c: INK });
  out.push({ t: "text", x: W - 30, y: 135, s: 46, text: `ADET: ${p.quantity}`, bold: true, c: INK, anchor: "end" });

  const hasTop = outlets.some((o) => o.side === "top");
  const hasBottom = outlets.some((o) => o.side === "bottom");
  const x0 = 140;
  const x1 = W - 150;
  const sc = (x1 - x0) / total;
  const ph = 50;
  const ol = 80;
  const pipeY = hasBottom ? 290 : 330;
  const top = pipeY - ph / 2;
  const bot = pipeY + ph / 2;
  const X = (cm: number) => x0 + cm * sc;
  const midX = (x0 + x1) / 2;
  const ow = Math.max(10, Math.min(22, sc * 4));
  const posX = (pos: number) => X(p.start + pos);

  // main pipe
  out.push({ t: "rect", x: x0, y: top, w: x1 - x0, h: ph, fill: PIPE, stroke: INK, sw: 2.5 });
  out.push({ t: "line", x1: x0 - 50, y1: pipeY, x2: x1 + 10, y2: pipeY, w: 0.8, c: INK, dash: [14, 4, 3, 4] });

  const threaded = (xa: number, dir: 1 | -1, tw: number) => {
    const rx = dir === 1 ? xa : xa - tw; // thread sits inside the pipe length, measured from its outer edge
    out.push({ t: "rect", x: rx, y: top + 4, w: tw, h: ph - 8, fill: "#fff7ed", stroke: INK, sw: 2 });
    for (let k = 6; k < tw; k += 7) out.push({ t: "line", x1: rx + k, y1: top + 6, x2: rx + k - 5, y2: bot - 6, w: 1.6, c: THREAD });
  };
  // inlet side (left) always threaded
  const twL = Math.max(14, Math.min(44, p.start * sc - ow / 2 - 4));
  threaded(x0 + twL, -1, twL);
  out.push({ t: "line", x1: x0 - 110, y1: pipeY, x2: x0 - 12, y2: pipeY, w: 2, c: INK });
  out.push({ t: "poly", pts: [[x0 - 4, pipeY], [x0 - 16, pipeY - 6], [x0 - 16, pipeY + 6]], fill: INK });
  out.push({ t: "text", x: x0 - 118, y: top - 12, s: 16, text: "GİRİŞ (DİŞLİ)", bold: true, c: INK });
  if (th === "cift") {
    const twR = Math.max(14, Math.min(44, p.end * sc - ow / 2 - 4));
    threaded(x1 - twR, 1, twR);
    out.push({ t: "text", x: x1 + 12, y: pipeY + 6, s: 16, text: "DİŞLİ", bold: true, c: INK });
  } else {
    out.push({ t: "rect", x: x1 - 3, y: top - 4, w: 10, h: ph + 8, fill: INK });
    out.push({ t: "text", x: x1 + 16, y: pipeY + 6, s: 16, text: "KAPALI UÇ", bold: true, c: INK });
  }

  // outlets
    const sorted = [...outlets].sort((a, b) => a.pos - b.pos || (a.side === "top" ? -1 : 1));
  let diamLabelDone = false;
  sorted.forEach((o, i) => {
    const cx = posX(o.pos);
    const y = o.side === "top" ? top - ol : bot;
    out.push({ t: "rect", x: cx - ow / 2, y, w: ow, h: ol, fill: PIPE, stroke: INK, sw: 2 });
    out.push({ t: "line", x1: cx, y1: y - 6, x2: cx, y2: y + ol + 6, w: 0.7, c: INK, dash: [6, 3] });
    const ly = o.side === "top" ? top - ol - 12 : bot + ol + 22;
    out.push({ t: "text", x: cx, y: ly, s: 18, text: `Ç${i + 1}`, bold: true, c: INK, anchor: "middle" });
    if (!diamLabelDone) {
      diamLabelDone = true;
      const dy = o.side === "top" ? top - ol / 2 : bot + ol / 2 + 6;
      out.push({ t: "text", x: cx + ow / 2 + 8, y: dy, s: 26, text: inchLabel(p.outSize), bold: true, c: INK });
    }
  });

  // main pipe diameter — prominent label inside the pipe
    const mainLabel = `ANA BORU  ${inchLabel(p.mainSize)}`;
  const gaps = [0, ...Array.from(new Set(outlets.map((o) => o.pos))).sort((a, b) => a - b).map((q) => p.start + q), total];
  let lx = midX, best = -1;
  for (let i = 0; i < gaps.length - 1; i++) { const a = gaps[i], b = gaps[i + 1]; if (a === undefined || b === undefined) continue; const g = b - a; if (g > best) { best = g; lx = X((a + b) / 2); } }
  const lw = mainLabel.length * 30 * 0.64 + 24;
  lx = Math.min(Math.max(lx, x0 + twL + lw / 2 + 6), x1 - (th === "cift" ? 44 : 0) - lw / 2 - 6);
  out.push({ t: "rect", x: lx - lw / 2, y: pipeY - 23, w: lw, h: 46, fill: "#ffffff", stroke: INK, sw: 1.5 });
  out.push({ t: "text", x: lx, y: pipeY + 10, s: 30, text: mainLabel, bold: true, c: INK, anchor: "middle" });

  // dimension chain
  const positions = Array.from(new Set(outlets.map((o) => o.pos))).sort((a, b) => a - b);
  const pts = [0, ...positions.map((q) => p.start + q), total];
  const dimY = (hasBottom ? bot + ol + 60 : bot + 60);
  const totY = dimY + 62;
  const arrow = (x: number, y: number, dir: 1 | -1) =>
    out.push({ t: "poly", pts: [[x, y], [x + dir * 10, y - 4], [x + dir * 10, y + 4]], fill: DIM });
  pts.forEach((cm) => {
    const x = X(cm);
    out.push({ t: "line", x1: x, y1: bot + 4, x2: x, y2: totY + 8, w: 0.7, c: DIM });
  });
  for (let i = 0; i < pts.length - 1; i++) {
    const left = pts[i], right = pts[i + 1];
    if (left === undefined || right === undefined) continue;
    const a = X(left);
    const b = X(right);
    const len = right - left;
    if (len <= 0) continue;
    out.push({ t: "line", x1: a, y1: dimY, x2: b, y2: dimY, w: 1.2, c: DIM });
    if (b - a > 22) { arrow(a, dimY, 1); arrow(b, dimY, -1); }
    out.push({ t: "text", x: (a + b) / 2, y: dimY - 8, s: 21, text: fmt(len), bold: true, c: DIM, anchor: "middle" });
  }
  out.push({ t: "line", x1: x0, y1: totY, x2: x1, y2: totY, w: 1.4, c: DIM });
  arrow(x0, totY, 1);
  arrow(x1, totY, -1);
  out.push({ t: "text", x: midX, y: totY - 9, s: 26, text: `TOPLAM ${fmt(total)} cm`, bold: true, c: DIM, anchor: "middle" });

  // Production notes remain above the footer and below the overall dimension.
  if (p.notes.trim()) {
    out.push({ t: "text", x: 30, y: 555, s: 19, text: "NOT:", bold: true, c: INK });
    noteLines(p.notes).forEach((text, i) => out.push({ t: "text", x: 100, y: 555 + i * 19, s: 19, text, bold: true, c: INK }));
  }

  // footer
  out.push({ t: "line", x1: 8, y1: H - 92, x2: W - 8, y2: H - 92, w: 1.2, c: INK });
  out.push({ t: "text", x: 30, y: H - 56, s: 24, bold: true, c: INK,
    text: `Ana boru: ${inchLabel(p.mainSize)}   •   Çıkış çapı: ${inchLabel(p.outSize)}   •   Toplam: ${fmt(total)} cm` });
  out.push({
    t: "text", x: 30, y: H - 24, s: 19, bold: true, c: INK,
    text: `Başlangıç: ${fmt(p.start)} cm  •  Çıkışlar arası: ${fmt(p.spacing)} cm  •  ${th === "cift" ? "Son uç" : "Kapalı"}: ${fmt(p.end)} cm`,
  });
  return out;
}
