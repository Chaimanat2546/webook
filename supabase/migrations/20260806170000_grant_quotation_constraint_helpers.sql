-- Quotation writes execute through permission-scoped RPCs. PostgreSQL checks
-- the row constraints as the authenticated caller, so those callers also need
-- execute permission on the immutable validation helpers used by the checks.
grant usage on schema private to authenticated;

grant execute on function private.is_quotation_document_display(jsonb) to authenticated;
grant execute on function private.is_quotation_template(text) to authenticated;
grant execute on function private.is_quotation_layout(jsonb, text) to authenticated;
