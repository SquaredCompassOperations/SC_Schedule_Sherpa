BEGIN;

CREATE TYPE public.automation_module AS ENUM (
  'sba_status',
  'market_validation',
  'sca_lcat_confirmation',
  'pricing_workbook'
);

CREATE TYPE public.automation_run_status AS ENUM (
  'running',
  'completed',
  'failed',
  'needs_review'
);

CREATE TABLE public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  module public.automation_module NOT NULL,
  status public.automation_run_status NOT NULL DEFAULT 'running',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  error_message TEXT,
  client_visible BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sba_certification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  uei TEXT NOT NULL,
  cage_code TEXT,
  certification_program TEXT NOT NULL,
  certification_status TEXT NOT NULL,
  expiration_date TEXT,
  source_url TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('sba_profile', 'screenshot')),
  confidence INTEGER NOT NULL DEFAULT 100 CHECK (confidence >= 0 AND confidence <= 100),
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.market_validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  sin TEXT NOT NULL,
  client_lcat TEXT,
  labor_category TEXT NOT NULL,
  unit_of_issue TEXT,
  gsa_net_price TEXT,
  contractor TEXT,
  contract_number TEXT,
  source_url TEXT NOT NULL,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sca_lcat_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  client_lcat TEXT NOT NULL,
  client_description TEXT,
  match_status TEXT NOT NULL CHECK (match_status IN ('matched', 'no_equivalent', 'needs_review')),
  sca_code TEXT,
  sca_title TEXT,
  sca_family TEXT,
  confidence INTEGER CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
  rationale TEXT,
  source_url TEXT,
  wage_determination_table TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pricing_workbook_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  template_kind TEXT NOT NULL CHECK (template_kind IN ('fcp-product', 'fcp-services-plus')),
  template_refresh TEXT NOT NULL,
  filename TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  source_template_url TEXT,
  output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX automation_runs_offer_id_created_at_idx
  ON public.automation_runs (offer_id, created_at DESC);
CREATE INDEX automation_runs_module_status_idx
  ON public.automation_runs (module, status);
CREATE INDEX sba_certification_results_offer_id_idx
  ON public.sba_certification_results (offer_id);
CREATE INDEX sba_certification_results_run_id_idx
  ON public.sba_certification_results (run_id);
CREATE INDEX market_validation_results_offer_id_idx
  ON public.market_validation_results (offer_id);
CREATE INDEX market_validation_results_run_id_idx
  ON public.market_validation_results (run_id);
CREATE INDEX market_validation_results_sin_lcat_idx
  ON public.market_validation_results (sin, lower(client_lcat));
CREATE INDEX sca_lcat_matches_offer_id_idx
  ON public.sca_lcat_matches (offer_id);
CREATE INDEX sca_lcat_matches_run_id_idx
  ON public.sca_lcat_matches (run_id);
CREATE INDEX pricing_workbook_outputs_offer_id_idx
  ON public.pricing_workbook_outputs (offer_id);
CREATE INDEX pricing_workbook_outputs_run_id_idx
  ON public.pricing_workbook_outputs (run_id);

CREATE TRIGGER automation_runs_updated_at
  BEFORE UPDATE ON public.automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sba_certification_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_validation_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sca_lcat_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_workbook_outputs TO authenticated;

GRANT ALL ON public.automation_runs TO service_role;
GRANT ALL ON public.sba_certification_results TO service_role;
GRANT ALL ON public.market_validation_results TO service_role;
GRANT ALL ON public.sca_lcat_matches TO service_role;
GRANT ALL ON public.pricing_workbook_outputs TO service_role;

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sba_certification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sca_lcat_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_workbook_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view automation runs"
  ON public.automation_runs FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Clients view released automation runs"
  ON public.automation_runs FOR SELECT
  TO authenticated
  USING (client_visible AND public.is_offer_member(offer_id));

CREATE POLICY "Admins insert automation runs"
  ON public.automation_runs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update automation runs"
  ON public.automation_runs FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete automation runs"
  ON public.automation_runs FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins view SBA results"
  ON public.sba_certification_results FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Clients view released SBA results"
  ON public.sba_certification_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.automation_runs ar
      WHERE ar.id = run_id
        AND ar.offer_id = sba_certification_results.offer_id
        AND ar.client_visible
        AND public.is_offer_member(ar.offer_id)
    )
  );

CREATE POLICY "Admins insert SBA results"
  ON public.sba_certification_results FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update SBA results"
  ON public.sba_certification_results FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete SBA results"
  ON public.sba_certification_results FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins view market validation results"
  ON public.market_validation_results FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Clients view released market validation results"
  ON public.market_validation_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.automation_runs ar
      WHERE ar.id = run_id
        AND ar.offer_id = market_validation_results.offer_id
        AND ar.client_visible
        AND public.is_offer_member(ar.offer_id)
    )
  );

CREATE POLICY "Admins insert market validation results"
  ON public.market_validation_results FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update market validation results"
  ON public.market_validation_results FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete market validation results"
  ON public.market_validation_results FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins view SCA matches"
  ON public.sca_lcat_matches FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Clients view released SCA matches"
  ON public.sca_lcat_matches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.automation_runs ar
      WHERE ar.id = run_id
        AND ar.offer_id = sca_lcat_matches.offer_id
        AND ar.client_visible
        AND public.is_offer_member(ar.offer_id)
    )
  );

CREATE POLICY "Admins insert SCA matches"
  ON public.sca_lcat_matches FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update SCA matches"
  ON public.sca_lcat_matches FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete SCA matches"
  ON public.sca_lcat_matches FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins view pricing workbook outputs"
  ON public.pricing_workbook_outputs FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Clients view released pricing workbook outputs"
  ON public.pricing_workbook_outputs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.automation_runs ar
      WHERE ar.id = run_id
        AND ar.offer_id = pricing_workbook_outputs.offer_id
        AND ar.client_visible
        AND public.is_offer_member(ar.offer_id)
    )
  );

CREATE POLICY "Admins insert pricing workbook outputs"
  ON public.pricing_workbook_outputs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update pricing workbook outputs"
  ON public.pricing_workbook_outputs FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete pricing workbook outputs"
  ON public.pricing_workbook_outputs FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMIT;
