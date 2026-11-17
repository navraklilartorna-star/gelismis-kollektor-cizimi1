import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  SUPABASE_URL as DEFAULT_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY as DEFAULT_SUPABASE_PUBLISHABLE_KEY,
} from "./config";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
