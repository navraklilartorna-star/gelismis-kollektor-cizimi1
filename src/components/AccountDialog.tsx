import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage("Şifre yenileme bağlantısı için e-postanızı kontrol edin.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) onClose();
        else setMessage("Hesabınızı doğrulamak için e-postanıza gelen bağlantıya tıklayın, ardından giriş yapın.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      }
    } catch { setMessage(mode === "login" ? "Giriş yapılamadı. E-posta, şifre ve e-posta doğrulamasını kontrol edin." : "İşlem tamamlanamadı. Bilgilerinizi kontrol edip tekrar deneyin."); }
    finally { setBusy(false); }
  };
  const social = async () => {
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
      });
      if (error) throw error;
    } catch { setMessage("Google ile giriş tamamlanamadı. Supabase Google OAuth ayarlarını kontrol edin."); }
    finally { setBusy(false); }
  };
  const field = "h-12 w-full rounded-lg border border-input bg-background px-3 text-foreground";
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="account-title" className="max-h-[90vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-lg bg-card p-5">
      <div className="flex items-center justify-between"><h2 id="account-title" className="text-xl font-bold">{mode === "signup" ? "Hesap oluştur" : mode === "forgot" ? "Şifremi unuttum" : "Bulut hesabına giriş"}</h2><Button variant="ghost" size="icon" aria-label="Kapat" onClick={onClose}><X /></Button></div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1"><span>E-posta</span><input className={field} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== "forgot" && <label className="block space-y-1"><span>Şifre</span><input className={field} type="password" minLength={8} required autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
        <Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? "Bekleyin…" : mode === "signup" ? "Hesap oluştur" : mode === "forgot" ? "Yenileme bağlantısı gönder" : "Giriş yap"}</Button>
      </form>
      {message && <p role="status" className="text-sm text-foreground">{message}</p>}
      {mode !== "forgot" && <div className="space-y-2 border-t border-border pt-4">
        <Button variant="outline" className="h-12 w-full" disabled={busy} onClick={() => social()}>Google ile devam et</Button>
      </div>}
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="link" disabled={busy} onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMessage(""); }}>{mode === "signup" ? "Zaten hesabım var" : "Hesap oluştur"}</Button>
        <Button variant="link" disabled={busy} onClick={() => { setMode(mode === "forgot" ? "login" : "forgot"); setMessage(""); }}>{mode === "forgot" ? "Girişe dön" : "Şifremi unuttum"}</Button>
      </div>
    </div>
  </div>;
}