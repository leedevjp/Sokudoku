import type { Database } from '@/lib/supabase/database.types';
import { createBrowserClient } from '@supabase/ssr';
export function createClient() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key) throw new Error('Supabase configuration is missing.');
 // Confirmation links are handled explicitly; opening a link in a different
 // browser must not replace that browser's existing logged-in account.
 return createBrowserClient<Database>(url, key, { auth: { detectSessionInUrl: false } });
}
