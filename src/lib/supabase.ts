import { createClient } from '@supabase/supabase-js';

/**
 * Lazy-initialized Supabase client.
 * This prevents build-time errors if environment variables are not present.
 */
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const getSupabase = () => {
    if (supabaseInstance) return supabaseInstance;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        // Silent during build/prerender to avoid console noise
        return null;
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
};
