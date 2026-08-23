ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'pt',
  ADD COLUMN IF NOT EXISTS recipient_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recipient_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recipient_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recipient_country text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recipient_tax_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_fixed_amount boolean NOT NULL DEFAULT true;

UPDATE public.invoices i
SET
  currency_code = COALESCE(NULLIF(i.currency_code, ''), c.billing_currency, 'BRL'),
  locale = COALESCE(NULLIF(i.locale, ''), c.locale, 'pt'),
  recipient_name = COALESCE(NULLIF(i.recipient_name, ''), c.name, ''),
  recipient_address = COALESCE(NULLIF(i.recipient_address, ''), c.address, ''),
  recipient_country = COALESCE(NULLIF(i.recipient_country, ''), c.country, ''),
  recipient_tax_id = COALESCE(NULLIF(i.recipient_tax_id, ''), c.tax_id, ''),
  is_recurring = COALESCE(i.is_recurring, false),
  recurring_fixed_amount = COALESCE(i.recurring_fixed_amount, true)
FROM public.clients c
WHERE c.id = i.client_id;
