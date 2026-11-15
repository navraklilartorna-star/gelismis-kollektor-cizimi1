import { PIPE_SIZES, inchFlat, mainEndType, mainEndSetting, type MainEnds, type Project } from "@/lib/collector";

const control = "h-11 w-full min-w-0 rounded-md border border-input bg-card px-2 text-base";
export function MainEndEditor({ project, onChange }: { project: Project; onChange: (value: MainEnds) => void }) {
  return <div className="space-y-3">{mainEndType(project).split("-").map((kind, i) => {
    if (kind !== "open") return null;
    const side = i === 0 ? "left" : "right";
    const title = i === 0 ? "Sol açık uç" : "Sağ açık uç";
    const value = mainEndSetting(project, side);
    const update = (patch: Partial<typeof value>) => onChange({ ...project.mainEnds, [side]: { ...value, ...patch } });
    return <fieldset key={side} className="grid min-w-0 grid-cols-2 gap-3 border-b border-border pb-3">
      <legend className="mb-2 font-semibold">{title}</legend>
      <label className="min-w-0 text-sm">Çap (inç)<select aria-label={`${title} çap`} className={control} value={value.size} onChange={e => update({ size: e.target.value })}>{PIPE_SIZES.map(s => <option key={s} value={s}>{inchFlat(s)}″</option>)}</select></label>
      <label className="min-w-0 text-sm">Bağlantı<select aria-label={`${title} bağlantı`} className={control} value={value.connection} onChange={e => update({ connection: e.target.value as typeof value.connection })}><option value="male">Dişli</option><option value="socket">Maşonlu</option></select></label>
    </fieldset>;
  })}</div>;
}