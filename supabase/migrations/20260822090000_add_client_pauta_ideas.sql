CREATE TABLE public.client_pauta_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  reference_link text NOT NULL DEFAULT '',
  internal_comment text NOT NULL DEFAULT '',
  image_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'converted')),
  converted_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_pauta_ideas_client_updated ON public.client_pauta_ideas (client_id, updated_at DESC);

ALTER TABLE public.client_pauta_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client pauta ideas"
ON public.client_pauta_ideas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team manage assigned client pauta ideas"
ON public.client_pauta_ideas FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND client_id IN (SELECT public.get_user_client_ids(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND client_id IN (SELECT public.get_user_client_ids(auth.uid()))
);

CREATE TRIGGER update_client_pauta_ideas_updated_at
BEFORE UPDATE ON public.client_pauta_ideas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
