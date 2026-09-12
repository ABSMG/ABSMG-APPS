import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_STORE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_STORE_SUPABASE_ANON_KEY;

export const storeSupabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;
