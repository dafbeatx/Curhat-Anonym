import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Lazy-initialized Supabase client.
 * This prevents build-time errors if environment variables are not present.
 */
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const getSupabase = () => {
    if (supabaseInstance) return supabaseInstance;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn("Supabase credentials missing. Returning null client.");
        return null;
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
};
