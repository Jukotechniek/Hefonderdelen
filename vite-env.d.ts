/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SHOPIFY_STORE_URL?: string;
  readonly VITE_SHOPIFY_ACCESS_TOKEN?: string;
  readonly VITE_SUPABASE_EDGE_FUNCTION_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
