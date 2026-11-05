// The Supabase client for writes the browser must never be able to make: the
// ai_calls cost log. It carries the secret key, which bypasses row level
// security, so only import this from server code. Returns null when the secret
// key isn't set, so logging falls back to printing instead of crashing.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminConfig } from "@/lib/supabase/config";

/**
 * A Supabase client that can write to tables with no public policy. Returns
 * null if the secret key isn't set.
 * Example: const supabase = createAdminClient(); if (!supabase) return;
 */
export function createAdminClient() {
  const config = supabaseAdminConfig();
  return config
    ? createSupabaseClient(config.url, config.key, {
        auth: { persistSession: false },
      })
    : null;
}
