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
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const redirectBase = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const switchMode = (next: "login" | "signup" | "forgot") => { setMode(next); setMessage(""); setNeedsConfirm(false); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(""); setNeedsConfirm(false);
    const address = email.trim();
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${redirectBase}reset-password` });
        if (error) throw error;
        setMessage("Bu e-posta adresiyle kayıtlı bir hesap varsa şifre yenileme bağlantısı gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: redirectBase } });
        if (error) throw error;
        if (data.session) onClose();
        else { setNeedsConfirm(true); setMessage("Hesabınız oluşturuldu. E-postanıza gelen doğrulama bağlantısına tıklayın; ardından giriş yapabilirsiniz. Gelmezse spam klasörünü kontrol edin."); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        onClose();
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message.toLowerCase() : "";
      if (mode === "login" && detail.includes("not confirmed")) { setNeedsConfirm(true); setMessage("E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzdaki doğrulama bağlantısına tıklayın veya aşağıdan yeniden gönderin."); }
      else if (mode === "login") setMessage("Giriş yapılamadı. E-posta ve şifrenizi kontrol edin. Google ile kaydolduysanız “Google ile devam et” düğmesini kullanın.");
      else if (detail.includes("rate limit")) setMessage("Çok sık denendi. Birkaç dakika bekleyip tekrar deneyin.");
      else setMessage("İşlem tamamlanamadı. Bilgilerinizi kontrol edip tekrar deneyin.");
    } finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: redirectBase } });
      if (error) throw error;
      setMessage("Doğrulama e-postası yeniden gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.");
    } catch { setMessage("E-posta şimdi gönderilemedi. Birkaç dakika sonra tekrar deneyin."); }
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
  const field = "h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground";
  const tab = (active: boolean) => `h-10 flex-1 rounded-md text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"}`;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="account-title" className="max-h-[90vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-lg bg-card p-5">
      <div className="flex items-center justify-between"><h2 id="account-title" className="text-xl font-bold">{mode === "forgot" ? "Şifremi unuttum" : "Bulut hesabına giriş"}</h2><Button variant="ghost" size="icon" aria-label="Kapat" onClick={onClose}><X /></Button></div>
      {mode !== "forgot" && <>
        <Button variant="outline" className="h-12 w-full" disabled={busy} onClick={() => social()}>Google ile devam et</Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />veya e-posta ile<span className="h-px flex-1 bg-border" /></div>
        <div role="tablist" className="flex gap-1 rounded-lg border border-border p-1">
          <button type="button" role="tab" aria-selected={mode === "login"} disabled={busy} className={tab(mode === "login")} onClick={() => switchMode("login")}>Giriş yap</button>
          <button type="button" role="tab" aria-selected={mode === "signup"} disabled={busy} className={tab(mode === "signup")} onClick={() => switchMode("signup")}>Kayıt ol</button>
        </div>
      </>}
      {mode === "forgot" && <p className="text-sm text-muted-foreground">Hesabınızın e-posta adresini yazın; şifre yenileme bağlantısını size gönderelim.</p>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1"><span>E-posta</span><input className={field} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== "forgot" && <label className="block space-y-1"><span>Şifre{mode === "signup" ? " (en az 8 karakter)" : ""}</span><input className={field} type="password" minLength={8} required autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
        <Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? "Bekleyin…" : mode === "signup" ? "Kayıt ol" : mode === "forgot" ? "Yenileme bağlantısı gönder" : "Giriş yap"}</Button>
      </form>
      {message && <p role="status" className="text-sm text-foreground">{message}</p>}
      {needsConfirm && email.trim() && <Button type="button" variant="outline" className="h-10 w-full" disabled={busy} onClick={resend}>Doğrulama e-postasını yeniden gönder</Button>}
      <div className="flex justify-center">
        {mode === "forgot"
          ? <Button variant="link" disabled={busy} onClick={() => switchMode("login")}>Girişe dön</Button>
          : <Button variant="link" disabled={busy} onClick={() => switchMode("forgot")}>Şifremi unuttum</Button>}
      </div>
    </div>
  </div>;
}
