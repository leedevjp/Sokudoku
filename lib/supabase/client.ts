import type { Database } from '@/lib/supabase/database.types';
import { createBrowserClient } from '@supabase/ssr';
export function createClient() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key) throw new Error('Supabase configuration is missing.');
 return createBrowserClient<Database>(url, key);
}
