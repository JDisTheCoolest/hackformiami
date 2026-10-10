import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase configuration is missing.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // The callback page owns URL parsing to avoid duplicate confirmation handling.
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

export function safeRedirectPath(value: string | null, fallback = "/app/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
