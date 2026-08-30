import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// The Supabase anon/publishable key is safe to ship in client code: it is
// designed to be public, and access control is enforced by Postgres RLS
// policies, not by keeping this key secret. The fallbacks below let the app
// run out of the box even where NEXT_PUBLIC_SUPABASE_* env vars aren't set.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://kwlydqelkovmopyjymyz.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bHlkcWVsa292bW9weWp5bXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5ODc1NDcsImV4cCI6MjEwMzU2MzU0N30.B63Q4-8RfFi4cNdpS8IGbst3jOAQhHzdqYx_p-q00_M";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const POST_IMAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "sns-post-images";
