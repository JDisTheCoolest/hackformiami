import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Keep the public landing page available even if auth has not been configured.
// Dummy settings are NEVER intended to authenticate a user.
export const supabase = createClient(supabaseUrl || "https://unconfigured.invalid", supabaseAnonKey || "unconfigured", {
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
