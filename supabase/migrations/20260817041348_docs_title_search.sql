create extension if not exists pg_trgm with schema extensions;
create index doc_documents_published_title_trgm_idx
  on public.doc_documents
  using gin (title extensions.gin_trgm_ops)
  where status = 'published';
