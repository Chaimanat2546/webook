-- M05 Public Docs: old document routes may be resolved by visitors only while
-- their linked canonical document remains public. This never exposes arbitrary
-- redirects or route history of draft, archived, hidden, or deleted documents.

grant select on public.doc_route_redirects to anon;
-- Replace the former admin-only SELECT policy so authenticated visitors and
-- administrators each evaluate exactly one permissive SELECT policy.
drop policy "Docs administrators read redirects" on public.doc_route_redirects;
create policy "Public document redirects are readable by guests"
on public.doc_route_redirects for select to anon
using (
  document_id is not null
  and (select doc_private.doc_document_is_public(document_id))
);
create policy "Public document redirects or administrators are readable"
on public.doc_route_redirects for select to authenticated
using (
  (document_id is not null and (select doc_private.doc_document_is_public(document_id)))
  or (select doc_private.doc_is_admin())
);
