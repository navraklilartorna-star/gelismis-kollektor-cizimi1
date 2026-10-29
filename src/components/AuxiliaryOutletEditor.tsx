import { Switch } from "@/components/ui/switch";
import { PIPE_SIZES, defaultAuxiliaryOutlet, inchFlat, type AuxiliaryOutlets, type Project } from "@/lib/collector";

const control = "h-11 w-full min-w-0 rounded-md border border-input bg-card px-2 font-mono text-base";
export function AuxiliaryOutletEditor({ project, onChange }: { project: Project; onChange: (value: AuxiliaryOutlets) => void }) {
  const values = project.auxiliaryOutlets ?? {};
  return <section className="space-y-4 border-b border-border py-4">
    <h2 className="text-lg font-bold">Ek çıkışlar</h2>
    {(["drain", "gauge"] as const).map(kind => {
      const title = kind === "drain" ? "Boşaltma çıkışı" : "Manometre çıkışı (1/2″)";
      const value = values[kind];
      const update = (patch: Partial<NonNullable<typeof value>>) => onChange({ ...values, [kind]: { ...(value ?? defaultAuxiliaryOutlet(kind)), ...patch } });
      return <div key={kind} className="space-y-3">
        <label className="flex items-center justify-between gap-3 font-semibold">{title}<Switch aria-label={title} checked={Boolean(value)} onCheckedChange={checked => { const next = { ...values }; if (checked) next[kind] = defaultAuxiliaryOutlet(kind); else delete next[kind]; onChange(next); }} /></label>
        {value && <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="min-w-0 text-sm">Konum<select aria-label={`${title} konum`} className={control} value={value.position} onChange={e => update({ position: e.target.value as "left" | "right" })}><option value="left">{kind === "drain" ? "Alt" : "Üst"} / Sol</option><option value="right">{kind === "drain" ? "Alt" : "Üst"} / Sağ</option></select></label>
          <label className="min-w-0 text-sm">Çap (inç)<select aria-label={`${title} çap`} disabled={kind === "gauge"} className={control} value={value.size} onChange={e => update({ size: e.target.value })}>{(kind === "gauge" ? ["1/2"] : PIPE_SIZES).map(size => <option key={size} value={size}>{inchFlat(size)}″</option>)}</select></label>
          <label className="min-w-0 text-sm">Boy (cm)<input aria-label={`${title} boy`} className={control} type="number" min="0.1" step="any" value={Number.isNaN(value.length) ? "" : value.length} onFocus={e => e.target.select()} onChange={e => update({ length: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>
          <label className="min-w-0 text-sm">Seçilen uçtan aks (cm)<input aria-label={`${title} uçtan aks`} className={control} type="number" min="0.1" step="any" value={Number.isNaN(value.offset) ? "" : value.offset} onFocus={e => e.target.select()} onChange={e => update({ offset: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>
        </div>}
      </div>;
    })}
  </section>;
}