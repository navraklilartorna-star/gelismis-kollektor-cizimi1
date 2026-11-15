import { Button } from "@/components/ui/button";
import { PIPE_SIZES, defaultAuxiliaryOutlet, inchFlat, type AuxiliaryOutlets, type Project } from "@/lib/collector";

const control = "h-11 w-full min-w-0 rounded-md border border-input bg-card px-2 font-mono text-base";
export function AuxiliaryOutletEditor({ project, onChange }: { project: Project; onChange: (value: AuxiliaryOutlets) => void }) {
  const values = project.auxiliaryOutlets ?? {};
  return <section className="space-y-4 border-b border-border py-4">
    <h2 className="text-lg font-bold">Ek çıkışlar</h2>
    {(["drain", "gauge"] as const).map(kind => {
      const title = kind === "drain" ? "Boşaltma çıkışı" : "Manometre çıkışı";
      const value = values[kind];
      const update = (patch: Partial<NonNullable<typeof value>>) => onChange({ ...values, [kind]: { ...(value ?? defaultAuxiliaryOutlet(kind)), ...patch } });
      return <div key={kind} className="space-y-3">
        <div className="flex items-center justify-between gap-3 font-semibold"><span>{title}</span><Button type="button" role="switch" aria-label={title} aria-checked={Boolean(value)} variant="ghost" className={`relative h-6 w-11 shrink-0 rounded-full p-0 focus-visible:ring-2 ${value ? "bg-primary hover:bg-primary" : "bg-input hover:bg-input"}`} onClick={() => { const next = { ...values }; if (!value) next[kind] = defaultAuxiliaryOutlet(kind); else delete next[kind]; onChange(next); }}><span className={`pointer-events-none absolute top-1 h-4 w-4 rounded-full bg-background transition-transform motion-reduce:transition-none ${value ? "left-1 translate-x-5" : "left-1 translate-x-0"}`} /></Button></div>
        {value && <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="min-w-0 text-sm">Konum<select aria-label={`${title} konum`} className={control} value={value.position} onChange={e => update({ position: e.target.value as NonNullable<typeof value>["position"] })}><option value="left">{kind === "drain" ? "Alt" : "Üst"} / Sol</option><option value="right">{kind === "drain" ? "Alt" : "Üst"} / Sağ</option>{kind === "drain" ? <><option value="center-top">Orta üst</option><option value="center-bottom">Orta alt</option></> : <><option value="bottom-left">Alt / Sol</option><option value="bottom-right">Alt / Sağ</option></>}</select></label>
          <label className="min-w-0 text-sm">Çap (inç)<select aria-label={`${title} çap`} className={control} value={value.size} onChange={e => update({ size: e.target.value })}>{PIPE_SIZES.map(size => <option key={size} value={size}>{inchFlat(size)}″</option>)}</select></label>
          <label className="min-w-0 text-sm">Boy (cm)<input aria-label={`${title} boy`} className={control} type="number" min="0.1" step="any" value={Number.isNaN(value.length) ? "" : value.length} onFocus={e => e.target.select()} onChange={e => update({ length: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>
          {!value.position.startsWith("center-") && <label className="min-w-0 text-sm">Seçilen uçtan aks (cm)<input aria-label={`${title} uçtan aks`} className={control} type="number" min="0.1" step="any" value={Number.isNaN(value.offset) ? "" : value.offset} onFocus={e => e.target.select()} onChange={e => update({ offset: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>}
        </div>}
      </div>;
    })}
  </section>;
}