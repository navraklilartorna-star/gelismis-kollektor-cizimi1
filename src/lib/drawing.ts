import { computeLayout, fmt, inchFlat, LAYOUT_LABELS, THREAD_LABELS, MAIN_END_LABELS, branchSettings, manufacturingRows, normalizeProject, noteLines, type Project, type MainEndType } from "./collector";

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
  /* Retained legacy drawing reference.
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
  return out; */
}

export function buildDrawingPages(p: Project): Prim[][] {
  return advancedDrawingPages(normalizeProject(p));
}

function advancedDrawingPages(p: Project): Prim[][] {
  p = normalizeProject(p);
  const rows = manufacturingRows(p);
  const { total } = computeLayout(p);
  const ends: MainEndType = p.mainEndType ?? (p.thread === "cift" ? "open-open" : "open-closed");
  const header = (): Prim[] => [
    { t: "rect", x: 8, y: 8, w: W - 16, h: H - 16, stroke: INK, sw: 2 },
    { t: "text", x: 30, y: 39, s: 23, text: p.customerName.trim() || "İsimsiz Müşteri", bold: true, c: INK },
    { t: "text", x: 30, y: 68, s: 19, text: p.projectTitle?.trim() || "Kollektör projesi", bold: true, c: INK },
    { t: "text", x: 30, y: 94, s: 14, text: `${LAYOUT_LABELS[p.layout]} • ${MAIN_END_LABELS[ends]} • ${p.count} branşman`, c: INK },
    { t: "text", x: 970, y: 39, s: 17, text: "NAVRAKLILAR TORNA", bold: true, c: INK, anchor: "end" },
    { t: "text", x: 970, y: 67, s: 14, text: `Tarih: ${p.date} • cm / inç`, c: INK, anchor: "end" },
    { t: "text", x: 970, y: 100, s: 27, text: `ADET: ${p.quantity}`, bold: true, c: INK, anchor: "end" },
  ];
  const out = header();
  const line = (x1: number, y1: number, x2: number, y2: number, c = INK, w = 1.5) => out.push({ t: "line", x1, y1, x2, y2, c, w });
  const text = (x: number, y: number, value: string, s = 16, c = INK) => out.push({ t: "text", x, y, text: value, s, c, anchor: "middle" });
  const arrow = (x: number, y: number, dir: number) => out.push({ t: "poly", pts: [[x,y],[x+dir*6,y-3],[x+dir*6,y+3]], fill: DIM });
  const longest = Math.max(1, ...rows.map(b => b.length));
  const scale = Math.min(740 / Math.max(total, 1), 62 / longest);
  const x0 = (W - total * scale) / 2, x1 = x0 + total * scale, y = 233, ph = 36;
  out.push({ t: "rect", x: x0, y: y-ph/2, w: x1-x0, h: ph, fill: PIPE, stroke: INK, sw: 2 });
  line(x0,y,x1,y,INK,0.6);
  ends.split("-").forEach((kind,i) => {
    const x = i === 0 ? x0 : x1;
    if (kind === "closed") out.push({ t: "rect", x:x-3,y:y-ph/2-3,w:6,h:ph+6,fill:INK });
    if (kind === "flanged") { out.push({ t:"rect",x:x-5,y:y-ph,w:10,h:ph*2,fill:PIPE,stroke:INK,sw:2 }); line(x-5,y-ph+8,x+5,y-ph+8); line(x-5,y+ph-8,x+5,y+ph-8); }
    if (kind === "open") { line(x-3,y-ph/2+4,x+3,y-ph/2+4); line(x-3,y+ph/2-4,x+3,y+ph/2-4); }
    text(x,125,kind === "closed" ? "KAPALI" : kind === "flanged" ? "FLANŞLI" : "AÇIK",12);
  });
  for (const side of ["top","bottom"]) {
    const sideRows = rows.filter(r => r.side === side).sort((a,b) => a.position-b.position);
    sideRows.forEach((b,index) => {
      const x=x0+b.position*scale, dir=side === "top" ? -1 : 1;
      const base=y+dir*ph/2, tip=base+dir*b.length*scale;
      const size=b.size.split(" ").reduce((sum,part) => {const [a,d]=part.split("/").map(Number);return sum+(a??0)/(d??1);},0);
      const width=Math.max(5,Math.min(24,size*8));
      out.push({t:"rect",x:x-width/2,y:Math.min(base,tip),w:width,h:Math.abs(tip-base),fill:PIPE,stroke:INK,sw:1.5});
      if (b.connection === "flanged") out.push({t:"rect",x:x-width,y:tip-3,w:width*2,h:6,fill:PIPE,stroke:INK,sw:1.5});
      else for(let k=2;k<Math.min(12,b.length*scale);k+=4) line(x-width/2,tip-dir*k,x+width/2,tip-dir*(k+2),THREAD,1);
      const labelX=sideRows.length === 1 ? 500 : 95+index*810/(sideRows.length-1), labelY=side === "top" ? 146 : 337;
      line(x,tip,labelX,labelY+(dir === -1 ? 5 : -12),DIM,0.5);
      text(labelX,labelY,b.id,sideRows.length>20 ? 9 : 13,DIM);
      if(sideRows.length<=8) text(labelX,labelY+14,`${inchLabel(b.size)} / ${fmt(b.length)} cm`,11,DIM);
    });
  }
  const mainLabel=`ANA BORU ${inchLabel(p.mainSize)}`;
  out.push({t:"rect",x:500-mainLabel.length*5.5,y:y-13,w:mainLabel.length*11,h:26,fill:"#ffffff"});
  text(500,y+6,mainLabel,19);
  const positions=[...new Set([0,...rows.map(r=>r.position),total])].sort((a,b)=>a-b), dimY=373;
  positions.forEach(cm=>{const x=x0+cm*scale;line(x,355,x,dimY+5,DIM,0.5);});
  positions.slice(1).forEach((cm,i)=>{const prev=positions[i];if(prev===undefined || cm<=prev)return;const a=x0+prev*scale,z=x0+cm*scale;line(a,dimY,z,dimY,DIM,1);if(z-a>18){arrow(a,dimY,1);arrow(z,dimY,-1);text((a+z)/2,dimY-7,fmt(cm-prev),12,DIM);}});
  line(x0,402,x1,402,DIM,1.2);arrow(x0,402,1);arrow(x1,402,-1);
  text(500,396,`TOPLAM ${fmt(total)} cm`,19,DIM);
  const columns=[30,195,320,440,570,790], edges=[22,185,310,430,560,780,978];
  const schedule=(sheet:Prim[],items:typeof rows,top:number) => {
    sheet.push({t:"text",x:30,y:top,s:18,text:"BRANŞMAN İMALAT LİSTESİ",bold:true,c:INK});
    sheet.push({t:"rect",x:22,y:top+9,w:956,h:25,fill:PIPE});
    ["Çıkış","Çap (inç)","Boy (cm)","Aks (cm)","Konum / Sol uçtan (cm)","Bağlantı"].forEach((v,i)=>sheet.push({t:"text",x:columns[i]??30,y:top+27,s:13,text:v,bold:true,c:INK}));
    items.forEach((b,j)=>{
      const yy=top+52+j*24;
      const label=b.id === "B1" ? "B1 Boşaltma" : b.id === "M1" ? "M1 Manometre" : b.id;
      [label,inchLabel(b.size),fmt(b.length),fmt(b.axis),`${b.side === "top" ? "Üst" : "Alt"}${b.end ? b.end === "left" ? " / Sol" : " / Sağ" : ""} / ${fmt(b.position)}`,b.connection === "flanged" ? "Flanşlı" : "Dişli / Erkek"].forEach((v,i)=>sheet.push({t:"text",x:columns[i]??30,y:yy,s:13,text:v,c:INK}));
    });
    const bottom=top+34+items.length*24;
    for(let j=0;j<=items.length;j++)sheet.push({t:"line",x1:22,y1:top+34+j*24,x2:978,y2:top+34+j*24,w:0.5,c:INK});
    edges.forEach(x=>sheet.push({t:"line",x1:x,y1:top+9,x2:x,y2:bottom,w:0.5,c:INK}));
  };
  schedule(out,rows.slice(0,8),428);
  const pages=[out];
  for(let offset=8;offset<rows.length;offset+=20){const sheet=header();schedule(sheet,rows.slice(offset,offset+20),140);pages.push(sheet);}
  pages.forEach((sheet,i)=>{
    sheet.push({t:"text",x:30,y:665,s:11,text:"Aks: ilk branşmanda başlangıç; diğerlerinde aynı taraftaki önceki branşmandan. B1/M1: seçilen uçtan.",c:INK});
    sheet.push({t:"text",x:970,y:687,s:11,text:`Pafta ${i+1} / ${pages.length}`,c:INK,anchor:"end"});
    noteLines(p.notes).forEach((value,j)=>sheet.push({t:"text",x:30,y:678+j*0,s:9,text:j===0 ? `Not: ${p.notes.replace(/\s+/g," ").slice(0,180)}` : "",c:INK}));
  });
  return pages;
}
