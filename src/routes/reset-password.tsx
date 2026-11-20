import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Şifre Yenile – Navraklılar Torna" },
    { name: "description", content: "Navraklılar Torna kollektör bulut hesabınızın şifresini yenileyin." },
    { property: "og:title", content: "Şifre Yenile – Navraklılar Torna" },
    { property: "og:description", content: "Kollektör bulut hesabınız için güvenli şifre yenileme." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});
function ResetPassword() {
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setRecovery(new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery");
    // Supabase bağlantıdaki parametreleri hemen temizleyebilir; bu olay yarışı önler.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setRecovery(true); });
    return () => subscription.unsubscribe();
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!recovery) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true); setMessage("Şifreniz yenilendi.");
    } catch { setMessage("Bağlantının süresi dolmuş olabilir. Yeni bir şifre yenileme bağlantısı isteyin."); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-md space-y-5 p-6">
    <h1 className="text-2xl font-bold">Şifre yenile</h1>
    {!recovery && <p>E-postanıza gelen şifre yenileme bağlantısını açın.</p>}
    {recovery && !done && <form onSubmit={submit} className="space-y-4"><label className="block space-y-2"><span>Yeni şifre</span><input type="password" autoComplete="new-password" required minLength={8} className="h-12 w-full rounded-lg border border-input bg-card px-3" value={password} onChange={(e) => setPassword(e.target.value)} /></label><Button disabled={busy} type="submit">{busy ? "Bekleyin…" : "Şifreyi yenile"}</Button></form>}
    {message && <p role="status">{message}</p>}<Button asChild variant="outline"><Link to="/">Kollektör çizimine dön</Link></Button>
  </main>;
}