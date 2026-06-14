-- Migration: Cria biomarkers_log (registro genérico de biomarcadores) + RLS
-- Spec: 012-diabetes-t2-support Fase C · ADR-060
-- Created: 2026-06-14
--
-- Modelo genérico (ADR-060): um shape serve glicemia/peso/pressão_arterial/batimentos e cresce
-- p/ HealthSync futuro (source) SEM migração. Por isso `type` e `source` NÃO têm CHECK — a
-- extensibilidade é a decisão-mãe do ADR-060; o enum v1 vive no Zod (biomarkerLogSchema).
-- `context` É enum fechado (FR-012) → CHECK sincronizado com o Zod (R-082/R-271).
-- `value_secondary` (nullable) = 2º componente de medida composta (PA: sistólica=value,
-- diastólica=value_secondary; NULL p/ glicemia/peso/batimentos) — decisão PO 2026-06-10.
-- Sem FK rígido com dose_instances (ADR-060): correlação é só temporal na timeline.
-- Sem meta/alvo armazenado (linha SaMD, ADR-062).

CREATE TABLE IF NOT EXISTS public.biomarkers_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'glicemia',
  value numeric NOT NULL,
  value_secondary numeric,
  unit text NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  context text CHECK (
    context IS NULL OR context IN ('jejum', 'pre_refeicao', 'pos_refeicao', 'ao_deitar', 'outro')
  ),
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice p/ leitura por usuário ordenada por instante (timeline + hub)
CREATE INDEX IF NOT EXISTS idx_biomarkers_log_user_measured
  ON public.biomarkers_log (user_id, measured_at DESC);

-- Habilitar RLS
ALTER TABLE public.biomarkers_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS — usuário só acessa as próprias linhas (Health Data Safety, Const. I)
CREATE POLICY "Users can select own biomarkers" ON public.biomarkers_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own biomarkers" ON public.biomarkers_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own biomarkers" ON public.biomarkers_log
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own biomarkers" ON public.biomarkers_log
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Grants (template CLAUDE.md): anon sem acesso (dado clínico sensível)
REVOKE ALL ON public.biomarkers_log FROM anon;
REVOKE ALL ON public.biomarkers_log FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biomarkers_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biomarkers_log TO service_role;
