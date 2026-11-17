import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { buildDrawingPages, partWidth, textsWidth, W, H } from "./drawing";
import type { Project } from "./collector";

let fontCache: Promise<[ArrayBuffer, ArrayBuffer]> | null = null;
export function preloadFonts() {
  fontCache ??= Promise.all([
    fetch(`${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf`).then((r) => r.arrayBuffer()),
    fetch(`${import.meta.env.BASE_URL}fonts/DejaVuSans-Bold.ttf`).then((r) => r.arrayBuffer()),
  ]);
  return fontCache;
}

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

export async function makePdf(input: Project | Project[]): Promise<Blob> {
  const projects = Array.isArray(input) ? input : [input];
  if (projects.length === 0) throw new Error("PDF için en az bir kollektör gerekli.");
  const [reg, bold] = await preloadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fR = await doc.embedFont(reg, { subset: true });
  const fB = await doc.embedFont(bold, { subset: true });
  const images = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();
  for (const project of projects) for (const pr of buildDrawingPages(project).flat()) {
    if (pr.t === "image" && !images.has(pr.src)) {
      const response = await fetch(pr.src);
      if (!response.ok) throw new Error("Logo yüklenemedi");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes[0] === 137 && bytes[1] === 80) images.set(pr.src, await doc.embedPng(bytes));
      else {
        const url = URL.createObjectURL(new Blob([bytes], { type: response.headers.get("content-type") ?? "image/webp" }));
        try {
          const image = new Image(); image.src = url; await image.decode();
          const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Logo hazırlanamadı"); ctx.drawImage(image, 0, 0);
          const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Logo hazırlanamadı")), "image/png"));
          images.set(pr.src, await doc.embedPng(await png.arrayBuffer()));
        } finally { URL.revokeObjectURL(url); }
      }
    }
  }
  const PW = 842, PH = 595, m = 20;
  const k = Math.min((PW - 2 * m) / W, (PH - 2 * m) / H);
  const ox = (PW - W * k) / 2, oy = (PH - H * k) / 2;
  const tx = (x: number) => ox + x * k;
  const ty = (y: number) => PH - (oy + y * k);

  for (const p of projects) {
  for (const primitives of buildDrawingPages(p)) {
  const page = doc.addPage([PW, PH]);
  for (const pr of primitives) {
    if (pr.t === "image") {
      const image = images.get(pr.src);
      if (image) page.drawImage(image, { x: tx(pr.x), y: ty(pr.y + pr.h), width: pr.w * k, height: pr.h * k });
    } else if (pr.t === "line") {
      page.drawLine({ start: { x: tx(pr.x1), y: ty(pr.y1) }, end: { x: tx(pr.x2), y: ty(pr.y2) }, thickness: pr.w * k, color: hex(pr.c), ...(pr.dash ? { dashArray: pr.dash.map((d) => d * k) } : {}) });
    } else if (pr.t === "rect") {
      page.drawRectangle({ x: tx(pr.x), y: ty(pr.y + pr.h), width: pr.w * k, height: pr.h * k, ...(pr.fill ? { color: hex(pr.fill) } : {}), ...(pr.stroke ? { borderColor: hex(pr.stroke) } : {}), borderWidth: pr.stroke ? (pr.sw ?? 1) * k : 0 });
    } else if (pr.t === "poly") {
      const [a, ...rest] = pr.pts as [[number, number], ...[number, number][]];
      const path = `M ${tx(a[0])} ${PH - ty(a[1])} ` + rest.map(([x, y]) => `L ${tx(x)} ${PH - ty(y)}`).join(" ") + " Z";
      page.drawSvgPath(path, { x: 0, y: PH, color: hex(pr.fill) });
    } else if (pr.t === "texts") {
      const total = textsWidth(pr.parts) * k;
      let x = pr.anchor === "middle" ? tx(pr.x) - total / 2 : pr.anchor === "end" ? tx(pr.x) - total : tx(pr.x);
      for (const part of pr.parts) {
        const f: PDFFont = part.bold ? fB : fR;
        const size = part.s * k;
        const w = partWidth(part) * k;
        if ("frac" in part) {
          const cx = x + w / 2;
          page.drawText(part.frac[0], { x: cx - f.widthOfTextAtSize(part.frac[0], size) / 2, y: ty(pr.y) + part.s * 0.75 * k, size, font: f, color: hex(pr.c) });
          page.drawText(part.frac[1], { x: cx - f.widthOfTextAtSize(part.frac[1], size) / 2, y: ty(pr.y) - part.s * 0.85 * k, size, font: f, color: hex(pr.c) });
          page.drawLine({ start: { x: x + w * 0.12, y: ty(pr.y) - part.s * 0.08 * k }, end: { x: x + w * 0.88, y: ty(pr.y) - part.s * 0.08 * k }, thickness: Math.max(0.6, part.s * 0.07 * k), color: hex(pr.c) });
        } else {
          page.drawText(part.text, { x, y: ty(pr.y), size, font: f, color: hex(pr.c) });
        }
        x += w;
      }
    } else {
      const f: PDFFont = pr.bold ? fB : fR;
      const size = pr.s * k;
      const w = f.widthOfTextAtSize(pr.text, size);
      const x = pr.anchor === "middle" ? tx(pr.x) - w / 2 : pr.anchor === "end" ? tx(pr.x) - w : tx(pr.x);
      page.drawText(pr.text, { x, y: ty(pr.y), size, font: f, color: hex(pr.c) });
    }
  }
  }
  }
  const first = projects[0];
  doc.setTitle(first?.customerName.trim() || "Kollektör çizimi");
  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deliverFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if ((e as DOMException).name === "AbortError") return; }
  }
  downloadBlob(blob, filename);
}
