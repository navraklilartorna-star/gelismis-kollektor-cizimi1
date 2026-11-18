import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "@/components/AccountProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Yönetici Paneli – Navraklılar Torna" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Firm = { firm_id: string; email: string; provider: string; created_at: string; last_sign_in_at: string | null; confirmed: boolean; banned: boolean; project_count: number; collector_count: number; firm_is_admin: boolean };
type Rec = { id: string; customer_name: string; project_title: string; main_size: string; out_size: string; outlet_count: number; quantity: number; production_date: string; updated_at: number };

const date = (v: string | number | null) => v ? new Date(v).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—";

function AdminPage() {
  const { user, ready } = useAccount();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<Firm | null>(null);
  const [error, setError] = useState("");
  // Yetki kararı veritabanından gelir (is_admin); arayüz yalnızca sonucu gösterir.
  const admin = useQuery({ queryKey: ["is-admin", user?.id], enabled: Boolean(user), retry: 1, queryFn: async () => { const { data, error } = await supabase.rpc("is_admin"); if (error) throw error; return data === true; } });
  const isAdmin = admin.data === true;
  const firms = useQuery({ queryKey: ["admin-firms"], enabled: isAdmin, queryFn: async () => { const { data, error } = await supabase.rpc("admin_list_firms"); if (error) throw error; return data as Firm[]; } });
  const records = useQuery({ queryKey: ["admin-records", open?.firm_id], enabled: isAdmin && Boolean(open), queryFn: async () => {
    const { data, error } = await supabase.from("collector_projects").select("id,customer_name,project_title,main_size,out_size,outlet_count,quantity,production_date,updated_at").eq("user_id", open!.firm_id).order("updated_at", { ascending: false });
    if (error) throw error; return data as Rec[];
  } });
  const remove = async (r: Rec) => {
    if (!open || !window.confirm(`“${r.customer_name}” kaydı ${open.email} hesabından kalıcı olarak silinsin mi?`)) return;
    setError("");
    const { error: e } = await supabase.from("collector_projects").delete().eq("user_id", open.firm_id).eq("id", r.id);
    if (e) { setError("Kayıt silinemedi."); return; }
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin-records", open.firm_id] }), queryClient.invalidateQueries({ queryKey: ["admin-firms"] })]);
  };
  const back = <Button asChild variant="outline"><Link to="/">Çizim ekranına dön</Link></Button>;
  if (!ready || (user && admin.isPending)) return <main className="mx-auto max-w-3xl p-6"><p role="status">Yükleniyor…</p></main>;
  if (!user) return <main className="mx-auto max-w-3xl space-y-4 p-6"><p>Yönetici paneli için giriş yapın.</p>{back}</main>;
  if (!isAdmin) return <main className="mx-auto max-w-3xl space-y-4 p-6"><p>Bu sayfayı görüntüleme yetkiniz yok.</p>{back}</main>;
  return <main className="mx-auto max-w-4xl space-y-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">Yönetici Paneli</h1>{back}</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!open ? <section className="space-y-2">
      <h2 className="text-lg font-semibold">Firmalar ({firms.data?.length ?? 0})</h2>
      {firms.isPending && <p role="status">Firmalar yükleniyor…</p>}
      {firms.isError && <p role="alert">Firma listesi yüklenemedi.</p>}
      <ul className="space-y-2">{firms.data?.map((f) => <li key={f.firm_id} className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0"><p className="break-all font-semibold">{f.email}{f.firm_is_admin ? " · Yönetici" : ""}</p>
            <p className="text-xs text-muted-foreground">{f.provider} · {f.confirmed ? "doğrulandı" : "doğrulanmadı"}{f.banned ? " · engelli" : ""} · son giriş {date(f.last_sign_in_at)}</p></div>
          <div className="flex items-center gap-3"><span className="text-sm font-semibold">{f.collector_count} kayıt</span><Button variant="outline" onClick={() => { setOpen(f); setError(""); }}>Kayıtları gör</Button></div>
        </div></li>)}</ul>
    </section> : <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="break-all text-lg font-semibold">{open.email} – kayıtlar</h2><Button variant="outline" onClick={() => setOpen(null)}>Firma listesine dön</Button></div>
      {records.isPending && <p role="status">Kayıtlar yükleniyor…</p>}
      {records.isError && <p role="alert">Kayıtlar yüklenemedi.</p>}
      {records.isSuccess && records.data.length === 0 && <p className="text-muted-foreground">Bu firmanın kaydı yok.</p>}
      <ul className="space-y-2">{records.data?.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
        <div className="min-w-0"><p className="break-words font-semibold">{r.customer_name}{r.project_title ? ` – ${r.project_title}` : ""}</p>
          <p className="text-xs text-muted-foreground">{r.main_size}" ana boru · {r.outlet_count} çıkış ({r.out_size}) · {r.quantity} adet · {r.production_date || "tarihsiz"} · güncelleme {date(r.updated_at)}</p></div>
        <Button variant="outline" onClick={() => remove(r)}>Sil</Button></li>)}</ul>
    </section>}
  </main>;
}
