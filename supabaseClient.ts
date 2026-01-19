
import { createClient } from '@supabase/supabase-js';

// In a real environment, these come from your project settings.
// For this generated app, we assume they are configured in the environment.
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
