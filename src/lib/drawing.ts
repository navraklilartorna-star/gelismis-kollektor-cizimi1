import { computeLayout, fmt, inchFlat, LAYOUT_LABELS, manufacturingRows, normalizeProject, type Project, mainEndKind, mainEndSetting, pipeDiameterMm, END_LABELS } from "./collector";
import { logoUrl } from "@/assets/logo";

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
const THREAD = "#d96a1e";
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
    { t: "image", x: 700, y: 20, w: 270, h: 90, src: logoUrl },
    { t: "text", x: 30, y: 88, s: 14, text: `Tarih: ${p.date} • cm / inç`, bold: true, c: INK },
    { t: "text", x: 835, y: 152, s: 40, text: `ADET: ${p.quantity}`, bold: true, c: INK, anchor: "middle" },
  ];
  const headerCount = out.length;
  const line = (x1: number, y1: number, x2: number, y2: number, c = INK, w = 1.5) => out.push({ t: "line", x1, y1, x2, y2, c, w });
  const text = (x: number, y: number, value: string, s = 14, c = INK, anchor: "start" | "middle" | "end" = "middle") => out.push({ t: "text", x, y, text: value, s, c, anchor, bold: true });
  const arrow = (x: number, y: number, dir: number) => out.push({ t: "poly", pts: [[x,y],[x+dir*7,y-3.5],[x+dir*7,y+3.5]], fill: DIM });
  const longest = Math.max(1, ...rows.map(b => b.length));
   // Compress the visual length only; production lengths and axes remain untouched.
   const scale = 720 / Math.max(total, 1), lengthScale = 70 / longest;
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
  // Internal threads are confined to the two inside walls, leaving the bore clear.
  const socketThread = (x: number, yy: number, w: number, h: number, vertical: boolean) => {
    const span = vertical ? h : w;
    const wall = (vertical ? w : h) * 0.22;
    // Short internal thread near the opening; the socket body length is untouched.
    for (let k = 3; k < Math.min(span - 2, 14); k += 3) {
      if (vertical) {
        line(x + 1, yy + k, x + wall, yy + k - 1, THREAD, 1);
        line(x + w - wall, yy + k - 1, x + w - 1, yy + k, THREAD, 1);
      } else {
        line(x + k, yy + 1, x + k - 1, yy + wall, THREAD, 1);
        line(x + k - 1, yy + h - wall, x + k, yy + h - 1, THREAD, 1);
      }
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
      const sameSize = kind === "socket" && setting.size === p.mainSize;
      if (kind === "socket") {
        // Ana boruyla aynı ölçüde maşon: dış çap ana boruyla birebir eşit; farklı ölçüde mevcut büyütme (1.3x) korunur.
        const k = sameSize ? 0.5 : 0.65;
        pipe(sx - 2, y - diameter * k, length + 4, diameter * k * 2);
        line(sx + 3, y - diameter * k, sx + 3, y + diameter * k, EDGE);
        line(sx + length - 3, y - diameter * k, sx + length - 3, y + diameter * k, EDGE);
        socketThread(sx - 2, y - diameter * k, length + 4, diameter * k * 2, false);
      } else thread(sx, y - diameter / 2, length, diameter, false);
    }
    // Bağlantı bilgisi (ölçü + tür) ucun hemen yanında tek satırda: örn. 4 ″ MAŞONLU. Yukarı çıkışların yanına ölçü yazılmaz.
    const typeLabel = END_LABELS[kind].replace(/\s*\(.*\)\s*$/, "").toLocaleUpperCase("tr-TR");
    const info = kind === "closed" ? typeLabel : `${inchLabel(kind === "open" ? p.mainSize : setting.size)} ${typeLabel}`;
    // Bağlantının hemen üstünde, ucun dışına doğru uzanır (çıkışlarla çakışmaz).
    const topEdge = Math.max(ph / 2 + 3, kind === "flanged" ? diameter : kind === "socket" ? diameter * (setting.size === p.mainSize ? 0.5 : 0.65) : diameter / 2);
    const room = i === 0 ? x - 4 - 14 : W - 14 - (x + 4);
    const fsEnd = Math.max(10, Math.min(17, room / (info.length * 0.74)));
    text(i === 0 ? x - 4 : x + 4, y - topEdge - 12, info, fsEnd, INK, i === 0 ? "end" : "start");
  });
  let bottomEdge = y + ph/2;
  for (const side of ["top","bottom"] as const) {
    const sideRows = rows.filter(r => r.side === side).sort((a,b) => a.position-b.position);
    const xs = sideRows.map(b => x0 + b.position*scale);
    const minGap = Math.min(999, ...xs.slice(1).map((x,i) => x - (xs[i] ?? 0)));
    const fs = minGap >= 90 ? 26 : minGap >= 45 ? 22 : 18;
    const widestLabel = Math.max(1, ...sideRows.map(b => `${b.id} ${inchLabel(b.size)}`.length)) * fs * CHAR_W + 12;
    const lanes = Math.min(6, Math.max(1, Math.ceil(widestLabel / Math.max(1, minGap))));
    const laneH = fs + 10;
    const dir = side === "top" ? -1 : 1, base = y + dir*ph/2;
     const tipLimit = base + dir*70;
    sideRows.forEach((b,index) => {
      const x = xs[index] ?? x0, tip = base + dir*b.length*lengthScale;
      const width = pipeDiameterMm(b.size) * diameterScale;
       if (b.connection === "socket") {
         // The socket is the complete outlet body, seated on the main pipe.
         // Do not draw a narrower extension above it to match threaded outlets.
         const socketH = Math.abs(tip-base);
         const sy = Math.min(base,tip);
        pipe(x-width*0.65,sy,width*1.3,socketH,true);
        out.push({t:"rect",x:x-width*0.65+1,y:base-2,w:Math.max(0,width*1.3-2),h:4,fill:PIPE});
        line(x-width*0.65,sy+2,x+width*0.65,sy+2,EDGE,0.8);
        line(x-width*0.65,sy+socketH-2,x+width*0.65,sy+socketH-2,EDGE,0.8);
        socketThread(x-width*0.65,sy,width*1.3,socketH,true);
      } else {
         pipe(x-width/2, Math.min(base,tip), width, Math.abs(tip-base), true);
         out.push({t:"rect",x:x-width/2+1,y:base-2,w:Math.max(0,width-2),h:4,fill:PIPE});
         if (b.connection === "flanged") pipe(x-width,tip-3,width*2,6);
         else {
           const threadH = Math.min(14,Math.abs(tip-base));
           thread(x-width/2, side === "top" ? tip : tip-threadH, width, threadH, true);
         }
      }
      const lane = index % lanes;
      // Reserve space for the connection callout above the tip before the size labels.
      const near = tipLimit + dir*(44 + lane*laneH);
      const y1 = side === "top" ? near : near + fs;
      line(x, tip + dir*(b.connection === "flanged" ? 3 : 0), x, side === "top" ? y1 + 3 : y1 - fs - 2, INK, 0.6);
      // Connection-type callout above the outlet with an arrow pointing up to it.
      const connLabel = b.connection === "socket" ? "MAŞON" : b.connection === "flanged" ? "FLANŞ" : "ERKEK";
      const cy = tip + dir*(b.connection === "flanged" ? 26 : 22);
      const ay = tip + dir*(b.connection === "flanged" ? 8 : 6);
      line(x, ay, x, cy - dir*4, INK, 1);
      out.push({ t: "poly", pts: [[x, cy - dir*2], [x - 3.5, cy - dir*8], [x + 3.5, cy - dir*8]], fill: INK });
      text(x, cy + (side === "top" ? -2 : 12), connLabel, 16, INK);
      const labelHalfWidth = `${b.id} ${inchLabel(b.size)}`.length * fs * CHAR_W / 2;
      const lx = Math.min(W - 24 - labelHalfWidth, Math.max(24 + labelHalfWidth, x));
      text(lx, y1, `${b.id} ${inchLabel(b.size)}`, fs, side === "top" ? INK : INK);
      if (side === "bottom") bottomEdge = Math.max(bottomEdge, y1 + 4);
    });
  }
  const mainLabel = `ANA BORU ${inchLabel(p.mainSize)}`;
  const mainLabelWidth = mainLabel.length * 28 * CHAR_W + 16;
  out.push({t:"rect",x:500-mainLabelWidth/2,y:y-18,w:mainLabelWidth,h:36,fill:PIPE});
  text(500,y+10,mainLabel,28);
  // Başlangıç ölçüsünün referansı: soldaki bağlantının (erkek diş / maşon / flanş) en dış ucu. Çıkış konumları ve aralıklar değişmez.
  const outerReach = (kind: ReturnType<typeof mainEndKind>) => kind === "male" ? 25 : kind === "socket" ? 27 : kind === "flanged" ? 5 : kind === "closed" ? 3 : 0;
  // Sol ve sağ aynı mantık: ölçü, seçilen bağlantının en dış ucundan ilk/son çıkış merkezine alınır.
  const refX = x0 - outerReach(mainEndKind(p, "left")), refR = x1 + outerReach(mainEndKind(p, "right"));
  const dimX = (cm: number) => cm === 0 ? refX : cm === total ? refR : x0 + cm * scale;
  const positions=[...new Set([0,...rows.map(r=>r.position),total])].sort((a,b)=>a-b), dimY = bottomEdge + 16, totY = dimY + 24;
  positions.forEach(cm=>{const x=dimX(cm);line(x,dimY-8,x,totY+4,DIM,0.6);});
  positions.slice(1).forEach((cm,i)=>{const prev=positions[i];if(prev===undefined || cm<=prev)return;const a=dimX(prev),z=dimX(cm);line(a,dimY,z,dimY,DIM,1.2);if(z-a>16){arrow(a,dimY,1);arrow(z,dimY,-1);}if(z-a>16||i===0||i===positions.length-2)text((a+z)/2,dimY-4,fmt(cm-prev),z-a>28?12:9,DIM);});
  line(refX,totY,refR,totY,DIM,1.4);arrow(refX,totY,1);arrow(refR,totY,-1);
  out.push({t:"rect",x:430,y:totY-13,w:140,h:17,fill:"#ffffff"});
  text(500,totY+1,`TOPLAM ${fmt(total)} cm`,15,DIM);
  // Çizimin tamamı (yalnızca dikey konum) biraz aşağı alınır: ADET yazısıyla çakışmaz, alt boşluk dengelenir.
  // Oranlar, ölçüler ve hesaplar değişmez; her öğe aynı miktarda kaydırılır.
  const extent = (pr: Prim): [number, number] => {
    if (pr.t === "line") return [Math.min(pr.y1, pr.y2), Math.max(pr.y1, pr.y2)];
    if (pr.t === "rect" || pr.t === "image") return [pr.y, pr.y + pr.h];
    if (pr.t === "poly") { const ys = pr.pts.map((q) => q[1]); return [Math.min(...ys), Math.max(...ys)]; }
    if (pr.t === "texts") { const sz = Math.max(...pr.parts.map((q) => q.s)); return [pr.y - sz * 1.6, pr.y + sz * 1.1]; }
    return [pr.y - pr.s * 0.8, pr.y + pr.s * 0.25];
  };
  const content = out.slice(headerCount).map(extent);
  const top = Math.min(...content.map((e) => e[0])), bottom = Math.max(...content.map((e) => e[1]));
  const minTop = 172, maxBottom = 672;
  const dy = Math.max(0, Math.min(Math.max(minTop - top, Math.min(0.6 * ((minTop + maxBottom) / 2 - (top + bottom) / 2), 90)), maxBottom - bottom));
  if (dy > 0) for (let k = headerCount; k < out.length; k++) {
    const pr = out[k]!;
    out[k] = pr.t === "line" ? { ...pr, y1: pr.y1 + dy, y2: pr.y2 + dy } : pr.t === "poly" ? { ...pr, pts: pr.pts.map(([qx, qy]): [number, number] => [qx, qy + dy]) } : { ...pr, y: pr.y + dy };
  }
  if (p.notes.trim()) out.push({t:"text",x:30,y:686,s:10,text:`Not: ${p.notes.replace(/\s+/g," ").slice(0,180)}`,bold:true,c:INK});
  return [out];
}
