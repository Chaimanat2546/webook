-- Supabase's existing default privileges explicitly grant public-schema
-- functions to anon. Keep this RPC accessible only to authenticated callers.
revoke all on function public.doc_is_admin() from public, anon, authenticated,
  service_role;
grant execute on function public.doc_is_admin() to authenticated;
