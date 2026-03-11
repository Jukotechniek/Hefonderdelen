import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function assertServerSupabaseConfig(requireServiceRole: boolean) {
  if (!supabaseUrl) {
    throw new Error(
      'Supabase URL ontbreekt. Zet NEXT_PUBLIC_SUPABASE_URL in je environment.'
    );
  }

  if (requireServiceRole && !supabaseServiceRoleKey) {
    throw new Error(
      'Supabase service credentials ontbreken. Zet SUPABASE_SERVICE_ROLE_KEY in je environment of gebruik een request met Authorization header.'
    );
  }

  if (!supabaseServiceRoleKey && !supabaseAnonKey) {
    throw new Error(
      'Supabase sleutel ontbreekt. Zet SUPABASE_SERVICE_ROLE_KEY of NEXT_PUBLIC_SUPABASE_ANON_KEY in je environment.'
    );
  }
}

type CreateServerSupabaseClientOptions = {
  authHeader?: string | null;
  requireServiceRole?: boolean;
};

export function createServerSupabaseClient(options: CreateServerSupabaseClientOptions = {}) {
  const { authHeader = null, requireServiceRole = false } = options;
  assertServerSupabaseConfig(requireServiceRole);

  const selectedKey = supabaseServiceRoleKey || supabaseAnonKey;

  return createClient(supabaseUrl, selectedKey, {
    global: {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function hasServiceRoleKey() {
  return Boolean(supabaseServiceRoleKey);
}
