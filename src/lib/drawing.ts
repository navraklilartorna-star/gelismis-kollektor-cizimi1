import { computeLayout, fmt, inchFlat, LAYOUT_LABELS, manufacturingRows, normalizeProject, type Project, mainEndKind, mainEndSetting, pipeDiameterMm } from "./collector";
import logo from "@/assets/navraklilar-logo.png.asset.json";

export const W = 1000;
export const H = 707;

export type TextPart = { text: string; s: number; bold?: boolean } | { frac: [string, string]; s: number; bold?: boolean };

export type Prim =
  | { t: "image"; x: number; y: number; w: number; h: number; src: string }
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
const THREAD = INK;
const PIPE = "#ffffff";
const METAL = "#c5cbd1";
const EDGE = "#65717b";

export function buildDrawing(p: Project): Prim[] {
  return advancedDrawingPages(p)[0] ?? [];
}

export function buildDrawingPages(p: Project): Prim[][] {
  return advancedDrawingPages(normalizeProject(p));
}

function advancedDrawingPages(p: Project): Prim[][] {
  p = normalizeProject(p);
  const rows = manufacturingRows(p);
  const { total } = computeLayout(p);
  const out: Prim[] = [
    { t: "rect", x: 8, y: 8, w: W - 16, h: H - 16, stroke: INK, sw: 2 },
    { t: "text", x: 30, y: 40, s: Math.min(24, 550 / Math.max(1, p.customerName.length * 0.65)), text: p.customerName.trim() || "İsimsiz Müşteri", bold: true, c: INK },
    { t: "text", x: 30, y: 64, s: 12, text: `${LAYOUT_LABELS[p.layout]} • ${p.count} çıkış`, bold: true, c: INK },
    { t: "image", x: 700, y: 20, w: 270, h: 90, src: logo.url },
    { t: "text", x: 30, y: 88, s: 14, text: `Tarih: ${p.date} • cm / inç • ADET: ${p.quantity}`, bold: true, c: INK },
  ];
  const line = (x1: number, y1: number, x2: number, y2: number, c = INK, w = 1.5) => out.push({ t: "line", x1, y1, x2, y2, c, w });
  const text = (x: number, y: number, value: string, s = 14, c = INK, anchor: "start" | "middle" | "end" = "middle") => out.push({ t: "text", x, y, text: value, s, c, anchor, bold: true });
  const arrow = (x: number, y: number, dir: number) => out.push({ t: "poly", pts: [[x,y],[x+dir*7,y-3.5],[x+dir*7,y+3.5]], fill: DIM });
  const longest = Math.max(1, ...rows.map(b => b.length));
  const scale = 720 / Math.max(total, 1), lengthScale = 115 / longest;
  const maxDiameter = Math.max(pipeDiameterMm(p.mainSize), ...rows.map(b => pipeDiameterMm(b.size)), ...["left", "right"].map(side => pipeDiameterMm(mainEndSetting(p, side as "left" | "right").size)));
  let diameterScale = 70 / maxDiameter;
  for (const side of ["top", "bottom"] as const) {
    const sameSide = rows.filter(r => r.side === side).sort((a, b) => a.position - b.position);
    sameSide.slice(1).forEach((row, i) => {
      const previous = sameSide[i];
      if (!previous || row.position <= previous.position) return;
      const diameterSum = pipeDiameterMm(row.size) + pipeDiameterMm(previous.size);
      diameterScale = Math.min(diameterScale, (row.position - previous.position) * scale * 1.4 / diameterSum);
    });
  }
  const x0 = (W - total * scale) / 2, x1 = x0 + total * scale, ph = pipeDiameterMm(p.mainSize) * diameterScale, y = 350;
  const pipe = (x: number, yy: number, w: number, h: number, vertical = false) => {
    out.push({ t: "rect", x, y: yy, w, h, fill: PIPE, stroke: INK, sw: 1.8 });
    const edge = Math.min(3, (vertical ? w : h) * 0.12);
    if (vertical) {
      out.push({ t: "rect", x: x + 1, y: yy + 1, w: edge, h: Math.max(0, h - 2), fill: METAL });
      line(x + w - edge, yy + 1, x + w - edge, yy + h - 1, EDGE, 0.6);
    } else {
      out.push({ t: "rect", x: x + 1, y: yy + h - edge - 1, w: Math.max(0, w - 2), h: edge, fill: METAL });
      line(x + 1, yy + 3, x + w - 1, yy + 3, EDGE, 0.6);
    }
  };
  const thread = (x: number, yy: number, w: number, h: number, vertical: boolean) => {
    const span = vertical ? h : w;
    for (let k = 1; k < span; k += 2.4) {
      if (vertical) line(x, yy + k, x + w, yy + Math.min(span, k + 0.8), THREAD, 0.85);
      else line(x + k, yy, x + Math.min(span, k + 0.8), yy + h, THREAD, 0.85);
    }
  };
  pipe(x0, y-ph/2, x1-x0, ph);
  (["left", "right"] as const).forEach((side,i) => {
    const kind = mainEndKind(p, side);
    const x = i === 0 ? x0 : x1;
    const setting = mainEndSetting(p, side);
    const diameter = pipeDiameterMm(kind === "closed" || kind === "open" ? p.mainSize : setting.size) * diameterScale;
    if (kind === "closed") out.push({ t: "rect", x:x-3,y:y-ph/2-3,w:6,h:ph+6,fill:INK });
    if (kind === "flanged") { out.push({ t:"rect",x:x-5,y:y-diameter,w:10,h:diameter*2,fill:PIPE,stroke:INK,sw:2 }); line(x-5,y-diameter+8,x+5,y-diameter+8); line(x-5,y+diameter-8,x+5,y+diameter-8); }
    if (kind === "male" || kind === "socket") {
      const length = 25, sx = i === 0 ? x - length : x;
      pipe(sx, y - diameter / 2, length, diameter);
      if (kind === "socket") {
        pipe(sx - 2, y - diameter * 0.65, length + 4, diameter * 1.3);
        line(sx + 3, y - diameter * 0.65, sx + 3, y + diameter * 0.65, EDGE);
        line(sx + length - 3, y - diameter * 0.65, sx + length - 3, y + diameter * 0.65, EDGE);
      } else thread(sx, y - diameter / 2, length, diameter, false);
    }
    if (kind !== "open" && kind !== "closed") text(x, y - Math.max(ph, diameter * 2) / 2 - 18, inchLabel(setting.size), 16, INK, i === 0 ? "end" : "start");
    const label = kind === "closed" ? "KAPALI" : i === 0 ? "GİRİŞ" : "ÇIKIŞ";
    text(x, y + Math.max(ph / 2, kind === "flanged" ? diameter : diameter * 0.65, 20) + 28, label, 19, INK, i === 0 ? "end" : "start");
  });
  let bottomEdge = y + ph/2;
  for (const side of ["top","bottom"] as const) {
    const sideRows = rows.filter(r => r.side === side).sort((a,b) => a.position-b.position);
    const xs = sideRows.map(b => x0 + b.position*scale);
    const minGap = Math.min(999, ...xs.slice(1).map((x,i) => x - (xs[i] ?? 0)));
    const lanes = minGap >= 64 ? 1 : minGap >= 34 ? 2 : 3;
    const fs = lanes === 3 ? 10 : lanes === 2 ? 13 : 17, lh = fs + 2, laneH = lh + 4;
    const dir = side === "top" ? -1 : 1, base = y + dir*ph/2;
    const tipLimit = base + dir*115;
    sideRows.forEach((b,index) => {
      const x = xs[index] ?? x0, tip = base + dir*b.length*lengthScale;
      const width = pipeDiameterMm(b.size) * diameterScale;
      pipe(x-width/2, Math.min(base,tip), width, Math.abs(tip-base), true);
      // A white weld collar removes the seam at the branch/main junction.
      out.push({t:"rect",x:x-width/2+1,y:base-2,w:Math.max(0,width-2),h:4,fill:PIPE});
      if (b.connection === "flanged") pipe(x-width,tip-3,width*2,6);
      else if (b.connection === "socket") {
        const socketH = Math.min(30, Math.abs(tip-base));
        const sy = side === "top" ? base - socketH : base;
        pipe(x-width*0.65,sy,width*1.3,socketH,true);
        out.push({t:"rect",x:x-width*0.65+1,y:base-2,w:Math.max(0,width*1.3-2),h:4,fill:PIPE});
        line(x-width*0.65,sy+2,x+width*0.65,sy+2,EDGE,0.8);
        line(x-width*0.65,sy+socketH-2,x+width*0.65,sy+socketH-2,EDGE,0.8);
      } else {
        const threadH = Math.min(14,Math.abs(tip-base));
        thread(x-width/2, side === "top" ? tip : tip-threadH, width, threadH, true);
      }
      const lane = index % lanes;
      const near = tipLimit + dir*(8 + lane*laneH);
      const y1 = side === "top" ? near : near + fs;
      line(x, tip + dir*(b.connection === "flanged" ? 3 : 0), x, side === "top" ? y1 + 3 : y1 - fs - 2, INK, 0.6);
      const lx = Math.min(950, Math.max(50, x));
      text(lx, y1, `${b.id} ${inchLabel(b.size)}`, fs, side === "top" ? INK : INK);
      if (side === "bottom") bottomEdge = Math.max(bottomEdge, y1 + 4);
    });
  }
  const mainLabel = `ANA BORU ${inchLabel(p.mainSize)}`;
  out.push({t:"rect",x:500-mainLabel.length*5,y:y-11,w:mainLabel.length*10,h:22,fill:"#ffffff"});
  text(500,y+6,mainLabel,17);
  const positions=[...new Set([0,...rows.map(r=>r.position),total])].sort((a,b)=>a-b), dimY = bottomEdge + 16, totY = dimY + 24;
  positions.forEach(cm=>{const x=x0+cm*scale;line(x,dimY-8,x,totY+4,DIM,0.6);});
  positions.slice(1).forEach((cm,i)=>{const prev=positions[i];if(prev===undefined || cm<=prev)return;const a=x0+prev*scale,z=x0+cm*scale;line(a,dimY,z,dimY,DIM,1.2);if(z-a>16){arrow(a,dimY,1);arrow(z,dimY,-1);text((a+z)/2,dimY-4,fmt(cm-prev),z-a>28?12:9,DIM);}});
  line(x0,totY,x1,totY,DIM,1.4);arrow(x0,totY,1);arrow(x1,totY,-1);
  out.push({t:"rect",x:430,y:totY-13,w:140,h:17,fill:"#ffffff"});
  text(500,totY+1,`TOPLAM ${fmt(total)} cm`,15,DIM);
  if (p.notes.trim()) out.push({t:"text",x:30,y:686,s:10,text:`Not: ${p.notes.replace(/\s+/g," ").slice(0,180)}`,bold:true,c:INK});
  return [out];
}
