import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const AccountContext = createContext<{ user: User | null; ready: boolean }>({ user: null, ready: false });
export const useAccount = () => useContext(AccountContext);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = async () => {
      const version = ++generation;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (active && version === generation) { setUser(error ? null : data.user); setReady(true); }
      } catch { if (active && version === generation) { setUser(null); setReady(true); } }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      if (event === "SIGNED_OUT") {
        ++generation;
        setUser(null);
        setReady(true);
        void queryClient.cancelQueries();
        queryClient.clear();
      } else {
        // Defer auth calls until this callback releases the auth lock.
        setTimeout(() => { if (active) { void refresh(); void queryClient.invalidateQueries(); } }, 0);
      }
      void router.invalidate();
    });
    void refresh();
    return () => { active = false; subscription.unsubscribe(); };
  }, [queryClient, router]);
  return <AccountContext.Provider value={{ user, ready }}>{children}</AccountContext.Provider>;
}