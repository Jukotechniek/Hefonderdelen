import { createClient } from '@supabase/supabase-js';

// In a real environment, these come from your project settings.
// For this generated app, we assume they are configured in the environment.
const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || '';

// Logging removed for security - credentials should not be logged

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Using demo mode.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
