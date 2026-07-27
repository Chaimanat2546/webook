-- Upgrade defaults left by the earlier seven-flag document display draft.
alter table public.quotation_company_profiles
  alter column document_display_defaults set default '{
    "certificationDate": true, "certificationName": true, "certificationQr": true,
    "discount": true, "notes": true, "preTax": true, "reference": true,
    "tax": true, "unit": true, "withholdingTax": true
  }'::jsonb;

alter table public.quotations
  alter column document_display_snapshot set default '{
    "certificationDate": true, "certificationName": true, "certificationQr": true,
    "discount": true, "notes": true, "preTax": true, "reference": true,
    "tax": true, "unit": true, "withholdingTax": true
  }'::jsonb;
