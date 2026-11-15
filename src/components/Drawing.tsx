import { buildDrawingPages, partWidth, textsWidth, W, H } from "@/lib/drawing";
import type { Project } from "@/lib/collector";

export function Drawing({ project }: { project: Project }) {
  const pages = buildDrawingPages(project);
  return (
    <div>{pages.map((prims, page) => <svg key={page} aria-label={page === 0 ? "Kollektör teknik çizimi" : `Branşman imalat listesi ${page}`} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full bg-card" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {prims.map((p, i) => {
        if (p.t === "image") return <image key={i} x={p.x} y={p.y} width={p.w} height={p.h} href={p.src} preserveAspectRatio="xMidYMid meet" />;
        if (p.t === "line") return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.c} strokeWidth={p.w} strokeDasharray={p.dash?.join(" ")} />;
        if (p.t === "rect") return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill ?? "none"} stroke={p.stroke ?? "none"} strokeWidth={p.sw ?? 0} />;
        if (p.t === "poly") return <polygon key={i} points={p.pts.map((q) => q.join(",")).join(" ")} fill={p.fill} />;
        if (p.t === "texts") {
          const total = textsWidth(p.parts);
          let x = p.anchor === "middle" ? p.x - total / 2 : p.anchor === "end" ? p.x - total : p.x;
          return (
            <g key={i}>
              {p.parts.map((part, j) => {
                const w = partWidth(part);
                const el = "frac" in part ? (
                  <g key={j}>
                    <text x={x + w / 2} y={p.y - part.s * 0.75} fontSize={part.s} fontWeight={part.bold ? 700 : 400} fill={p.c} textAnchor="middle">{part.frac[0]}</text>
                    <line x1={x + w * 0.12} y1={p.y + part.s * 0.08} x2={x + w * 0.88} y2={p.y + part.s * 0.08} stroke={p.c} strokeWidth={Math.max(1, part.s * 0.07)} />
                    <text x={x + w / 2} y={p.y + part.s * 0.85} fontSize={part.s} fontWeight={part.bold ? 700 : 400} fill={p.c} textAnchor="middle">{part.frac[1]}</text>
                  </g>
                ) : (
                  <text key={j} x={x} y={p.y} fontSize={part.s} fontWeight={part.bold ? 700 : 400} fill={p.c}>{part.text}</text>
                );
                x += w;
                return el;
              })}
            </g>
          );
        }
        return (
          <text key={i} x={p.x} y={p.y} fontSize={p.s} fontWeight={p.bold ? 700 : 400} fill={p.c} textAnchor={p.anchor ?? "start"}>
            {p.text}
          </text>
        );
      })}
    </svg>)}</div>
  );
}
