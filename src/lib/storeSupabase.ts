import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_STORE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_STORE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Store Supabase environment variables are missing.");
}

export const storeSupabase = createClient(
  supabaseUrl,
  supabaseKey
);
