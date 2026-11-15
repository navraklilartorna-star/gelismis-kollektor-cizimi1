import { PIPE_SIZES, branchSettings, inchFlat, type Project, type Branch } from "@/lib/collector";

const control = "h-11 w-full min-w-0 rounded-md border border-input bg-card px-2 font-mono text-base";
export function BranchEditor({ project, onChange }: { project: Project; onChange: (branches: Branch[]) => void }) {
  const branches = branchSettings(project);
  const change = (i: number, values: Partial<Branch>) => onChange(branches.map((b, j) => j === i ? { ...b, ...values } : b));
  return <section className="space-y-3 border-y border-border py-4">
    <h2 className="text-lg font-bold">Çıkış ayarları</h2>
    <div className="space-y-3">{branches.map((b, i) => <fieldset key={i} className="grid min-w-0 grid-cols-2 gap-3 border-b border-border pb-3 sm:grid-cols-4">
      <legend className="mb-2 font-mono font-bold text-accent">C{i + 1}</legend>
      <label className="min-w-0 text-sm">Çap (inç)<select aria-label={`C${i + 1} çap`} className={control} value={b.size} onChange={e => change(i, { size: e.target.value })}>{PIPE_SIZES.map(s => <option key={s} value={s}>{inchFlat(s)}″</option>)}</select></label>
      <label className="min-w-0 text-sm">Boy (cm)<input aria-label={`C${i + 1} boy`} type="number" min="0.1" step="any" className={control} value={Number.isNaN(b.length) ? "" : b.length} onFocus={e => e.target.select()} onChange={e => change(i, { length: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>
      <label className="min-w-0 text-sm">Aks aralığı (cm)<input aria-label={`C${i + 1} aks aralığı`} type="number" min="0.1" step="any" className={control} value={Number.isNaN(b.spacing) ? "" : b.spacing} onFocus={e => e.target.select()} onChange={e => change(i, { spacing: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>
      <label className="min-w-0 text-sm">Bağlantı<select aria-label={`C${i + 1} bağlantı`} className={control} value={b.connection} onChange={e => change(i, { connection: e.target.value as Branch["connection"] })}><option value="male">Dişli / Erkek</option><option value="socket">Maşonlu</option><option value="flanged">Flanşlı</option></select></label>
    </fieldset>)}</div>
  </section>;
}