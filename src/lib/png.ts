import { buildDrawingPages, W, H, textsWidth, partWidth } from "./drawing";
import type { Project } from "./collector";

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] ?? c));
const dataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
export async function makePng(project: Project): Promise<Blob> {
  const fonts = await Promise.all(["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map(async name => {
    const r = await fetch(`/fonts/${name}`); if (!r.ok) throw new Error("Yazı tipi yüklenemedi"); return dataUrl(await r.blob());
  }));
  const primitives = buildDrawingPages(project)[0] ?? [];
  const images = new Map<string, string>();
  for (const pr of primitives) if (pr.t === "image") {
    const r = await fetch(pr.src); if (!r.ok) throw new Error("Logo yüklenemedi"); images.set(pr.src, await dataUrl(await r.blob()));
  }
  const body = primitives.map(pr => {
    if (pr.t === "image") return `<image x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${pr.h}" href="${images.get(pr.src)}"/>`;
    if (pr.t === "line") return `<line x1="${pr.x1}" y1="${pr.y1}" x2="${pr.x2}" y2="${pr.y2}" stroke="${pr.c}" stroke-width="${pr.w}" ${pr.dash ? `stroke-dasharray="${pr.dash.join(' ')}"` : ''}/>`;
    if (pr.t === "rect") return `<rect x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${pr.h}" fill="${pr.fill ?? 'none'}" stroke="${pr.stroke ?? 'none'}" stroke-width="${pr.sw ?? 0}"/>`;
    if (pr.t === "poly") return `<polygon points="${pr.pts.map(p => p.join(',')).join(' ')}" fill="${pr.fill}"/>`;
    if (pr.t === "text") return `<text x="${pr.x}" y="${pr.y}" font-size="${pr.s}" font-weight="${pr.bold ? 700 : 400}" fill="${pr.c}" text-anchor="${pr.anchor ?? 'start'}">${escape(pr.text)}</text>`;
    let x = pr.x - (pr.anchor === "middle" ? textsWidth(pr.parts) / 2 : pr.anchor === "end" ? textsWidth(pr.parts) : 0);
    return pr.parts.map(part => { const markup = `<text x="${x}" y="${pr.y}" font-size="${part.s}" font-weight="${part.bold ? 700 : 400}" fill="${pr.c}">${escape('text' in part ? part.text : part.frac.join('/'))}</text>`; x += partWidth(part); return markup; }).join('');
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 4}" height="${H * 4}" viewBox="0 0 ${W} ${H}"><style>@font-face{font-family:Export;src:url(${fonts[0]})} @font-face{font-family:Export;src:url(${fonts[1]});font-weight:700} text{font-family:Export}</style>${body}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = W * 4; canvas.height = H * 4;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Resim oluşturulamadı");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Resim oluşturulamadı")), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}