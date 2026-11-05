// Supabase is optional: every helper returns null when it isn't set up, so the
// app still builds and renders without environment variables.
export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

// The server-only config, for writing to tables the publishable key can't
// touch (the ai_calls log). SUPABASE_SECRET_KEY has no NEXT_PUBLIC_ prefix, so
// Next.js keeps it out of the browser bundle.
export function supabaseAdminConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}
