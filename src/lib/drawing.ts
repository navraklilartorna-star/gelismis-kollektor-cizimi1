import { computeLayout, fmt, inchFlat, LAYOUT_LABELS, MAIN_END_LABELS, manufacturingRows, normalizeProject, type Project, type MainEndType } from "./collector";

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
  return advancedDrawingPages(p)[0] ?? [];
}

export function buildDrawingPages(p: Project): Prim[][] {
  return advancedDrawingPages(normalizeProject(p));
}

function advancedDrawingPages(p: Project): Prim[][] {
  p = normalizeProject(p);
  const rows = manufacturingRows(p);
  const { total } = computeLayout(p);
  const ends: MainEndType = p.mainEndType ?? (p.thread === "cift" ? "open-open" : "open-closed");
  const out: Prim[] = [
    { t: "rect", x: 8, y: 8, w: W - 16, h: H - 16, stroke: INK, sw: 2 },
    { t: "text", x: 30, y: 40, s: Math.min(24, 550 / Math.max(1, p.customerName.length * 0.65)), text: p.customerName.trim() || "İsimsiz Müşteri", bold: true, c: INK },
    { t: "text", x: 30, y: 64, s: 14, text: `${LAYOUT_LABELS[p.layout]} • ${MAIN_END_LABELS[ends]} • ${p.count} çıkış`, bold: true, c: INK },
    { t: "text", x: 970, y: 36, s: 17, text: "NAVRAKLILAR TORNA", bold: true, c: INK, anchor: "end" },
    { t: "text", x: 970, y: 54, s: 13, text: `Tarih: ${p.date} • cm / inç`, bold: true, c: INK, anchor: "end" },
    { t: "text", x: 970, y: 78, s: 22, text: `ADET: ${p.quantity}`, bold: true, c: INK, anchor: "end" },
  ];
  const line = (x1: number, y1: number, x2: number, y2: number, c = INK, w = 1.5) => out.push({ t: "line", x1, y1, x2, y2, c, w });
  const text = (x: number, y: number, value: string, s = 14, c = INK, anchor: "start" | "middle" | "end" = "middle") => out.push({ t: "text", x, y, text: value, s, c, anchor, bold: true });
  const arrow = (x: number, y: number, dir: number) => out.push({ t: "poly", pts: [[x,y],[x+dir*7,y-3.5],[x+dir*7,y+3.5]], fill: DIM });
  const longest = Math.max(1, ...rows.map(b => b.length));
  const scale = 720 / Math.max(total, 1), lengthScale = Math.min(scale, 45 / longest);
  const x0 = (W - total * scale) / 2, x1 = x0 + total * scale, ph = 30, y = 205;
  out.push({ t: "rect", x: x0, y: y-ph/2, w: x1-x0, h: ph, fill: PIPE, stroke: INK, sw: 2.2 });
  ends.split("-").forEach((kind,i) => {
    const x = i === 0 ? x0 : x1, dir = i === 0 ? 1 : -1;
    if (kind === "closed") out.push({ t: "rect", x:x-3,y:y-ph/2-3,w:6,h:ph+6,fill:INK });
    if (kind === "flanged") { out.push({ t:"rect",x:x-5,y:y-ph,w:10,h:ph*2,fill:PIPE,stroke:INK,sw:2 }); line(x-5,y-ph+8,x+5,y-ph+8); line(x-5,y+ph-8,x+5,y+ph-8); }
    if (kind === "open") for (let k = 3; k <= 21; k += 4) line(x+dir*k, y-ph/2, x+dir*(k+4), y+ph/2, THREAD, 1.4);
    const label = kind === "closed" ? "KAPALI" : kind === "flanged" ? "FLANŞLI" : "AÇIK (DİŞLİ)";
    text(x - dir*(kind === "flanged" ? 10 : 6), y+5, label, 12, INK, i === 0 ? "end" : "start");
  });
  let bottomEdge = y + ph/2;
  for (const side of ["top","bottom"] as const) {
    const sideRows = rows.filter(r => r.side === side).sort((a,b) => a.position-b.position);
    const xs = sideRows.map(b => x0 + b.position*scale);
    const minGap = Math.min(999, ...xs.slice(1).map((x,i) => x - (xs[i] ?? 0)));
    const lanes = minGap >= 64 ? 1 : minGap >= 34 ? 2 : 3;
    const fs = lanes === 3 ? 10 : lanes === 2 ? 12 : 14, lh = fs + 2, laneH = lh*2 + 4;
    const dir = side === "top" ? -1 : 1, base = y + dir*ph/2;
    const tipLimit = base + dir*45;
    sideRows.forEach((b,index) => {
      const x = xs[index] ?? x0, tip = base + dir*b.length*lengthScale;
      const size = b.size.split(" ").reduce((sum,part) => {const [a,d]=part.split("/").map(Number);return sum+(a??0)/(d??1);},0);
      const width = Math.max(5,Math.min(22,size*8));
      out.push({t:"rect",x:x-width/2,y:Math.min(base,tip),w:width,h:Math.abs(tip-base),fill:PIPE,stroke:INK,sw:1.6});
      if (b.connection === "flanged") out.push({t:"rect",x:x-width,y:tip-3,w:width*2,h:6,fill:PIPE,stroke:INK,sw:1.6});
      else for(let k=2;k<Math.min(12,b.length*lengthScale);k+=4) line(x-width/2,tip-dir*k,x+width/2,tip-dir*(k+2),THREAD,1.2);
      const lane = index % lanes;
      const near = tipLimit + dir*(8 + lane*laneH);
      const y1 = side === "top" ? near - lh : near + fs, y2 = side === "top" ? near : near + fs + lh;
      line(x, tip + dir*(b.connection === "flanged" ? 3 : 0), x, side === "top" ? y2 + 3 : y1 - fs - 2, DIM, 0.6);
      const lx = Math.min(950, Math.max(50, x));
      text(lx, y1, `${b.id} ${inchLabel(b.size)}`, fs, side === "top" ? INK : INK);
      text(lx, y2, `B${fmt(b.length)} A${fmt(b.axis)}`, fs, DIM);
      if (side === "bottom") bottomEdge = Math.max(bottomEdge, y2 + 4);
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
  // Manufacturing list: always one sheet; long lists flow into side-by-side blocks.
  const top = totY + 26, bottomLimit = 648, header = 22;
  out.push({t:"text",x:30,y:top,s:16,text:"ÇIKIŞ İMALAT LİSTESİ",bold:true,c:INK});
  const avail = bottomLimit - (top + 8 + header);
  const blocks = Math.max(1, Math.ceil(rows.length / Math.max(1, Math.floor(avail / 20))));
  const per = Math.ceil(rows.length / blocks), rh = Math.min(22, avail / Math.max(1, per)), fs = Math.min(13, rh * 0.68);
  const bw = 956 / blocks, cols = [0, 0.27, 0.46, 0.63, 0.8];
  const heads = ["Çıkış","Çap (inç)","Boy (cm)","Aks (cm)","Bağlantı"];
  for (let k = 0; k < blocks; k++) {
    const items = rows.slice(k*per, (k+1)*per); if (!items.length) break;
    const bx = 22 + k*bw, t0 = top + 8;
    out.push({t:"rect",x:bx,y:t0,w:bw,h:header,fill:PIPE});
    heads.forEach((v,i)=>out.push({t:"text",x:bx+6+(cols[i]??0)*bw,y:t0+15,s:Math.min(12, bw/heads.length/6.2),text:v,bold:true,c:INK}));
    items.forEach((b,j)=>{
      const yy = t0 + header + j*rh + rh*0.7;
      const label = b.id === "B1" ? "B1 Boşaltma" : b.id === "M1" ? "M1 Manometre" : b.id;
      [label,inchLabel(b.size),fmt(b.length),fmt(b.axis),b.connection === "flanged" ? "Flanşlı" : "Dişli"].forEach((v,i)=>out.push({t:"text",x:bx+6+(cols[i]??0)*bw,y:yy,s:Math.min(fs, bw/heads.length/(i===0?6:4.5)),text:v,bold:true,c:INK}));
    });
    const bottom = t0 + header + items.length*rh;
    for (let j=0;j<=items.length;j++) out.push({t:"line",x1:bx,y1:t0+header+j*rh,x2:bx+bw,y2:t0+header+j*rh,w:0.5,c:INK});
    out.push({t:"line",x1:bx,y1:t0,x2:bx+bw,y2:t0,w:0.5,c:INK});
    [...cols.map(c=>bx+c*bw), bx+bw].forEach(x=>out.push({t:"line",x1:x,y1:t0,x2:x,y2:bottom,w:0.5,c:INK}));
  }
  out.push({t:"text",x:30,y:668,s:11,text:"B: boy, A: aks. İlk çıkışın aksı başlangıçtan, diğerleri aynı taraftaki önceki çıkıştan. B1/M1: seçilen uçtan.",bold:true,c:INK});
  if (p.notes.trim()) out.push({t:"text",x:30,y:686,s:10,text:`Not: ${p.notes.replace(/\s+/g," ").slice(0,180)}`,bold:true,c:INK});
  return [out];
}
