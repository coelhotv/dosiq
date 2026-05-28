-- Migration: dose_instances (schedule-anchored doses) — ADR-048 / Fase 2 PR-F2.1
-- Data: 2026-05-28
--
-- Materializa cada ocorrência agendada de dose como linha própria, ancorada ao
-- instante de schedule (`scheduled_for`, timestamptz absoluto). Substitui o modelo
-- inferencial atual (medicine_logs casado por janela ±2h sobre taken_at), que perde
-- a âncora ao cruzar a meia-noite (bug da dose 22:30).
--
-- Comportamento: ADITIVO. Nenhum código em produção lê estas tabelas/colunas ainda
-- (PR-F2.1 entrega schema + gerador + repository, sem wiring). Defaults preservam o
-- estado atual de protocols/medicine_logs. Segura de aplicar antes do merge.
--
-- Pré-requisito de tz: Fase 1 (ADR-049) — `scheduled_for` depende de
-- user_settings.timezone, gravado pelo motor de geração (PR-F2.2).

-- ============================================================================
-- 1. dose_instances — ocorrências materializadas
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.dose_instances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  protocol_id       uuid NOT NULL REFERENCES public.protocols(id) ON DELETE CASCADE,
  scheduled_for     timestamptz NOT NULL,           -- instante absoluto (UTC); tz do usuário governa só o wall-clock de origem
  expected_dose     numeric NOT NULL,               -- dosagem esperada congelada no momento da geração
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','taken','missed','skipped_paused','skipped_user')),
  medicine_log_id   uuid REFERENCES public.medicine_logs(id) ON DELETE SET NULL,  -- elo quando tomada
  tolerance_minutes int NOT NULL DEFAULT 120,        -- janela dinâmica (§6 MASTER_PLAN), computada na geração
  notified_at       timestamptz,                     -- idempotência de notificação
  snoozed_until     timestamptz,
  created_at        timestamptz DEFAULT now(),
  CONSTRAINT uq_dose_instance UNIQUE (protocol_id, scheduled_for)  -- habilita upsert idempotente (ON CONFLICT DO NOTHING)
);

COMMENT ON TABLE public.dose_instances IS 'Ocorrências de dose materializadas (schedule-anchored) — ADR-048. status: pending|taken|missed|skipped_paused|skipped_user (skipped_* são neutros para adesão).';
COMMENT ON COLUMN public.dose_instances.scheduled_for IS 'Instante absoluto (timestamptz UTC). O tz do usuário só governa o wall-clock de origem na geração; leitura/ordenação é tz-agnóstica.';
COMMENT ON COLUMN public.dose_instances.tolerance_minutes IS 'Janela de tolerância dinâmica: min(metade do menor intervalo adjacente, 120) para diário multi-dose; 120 para não-diário/dose-única.';

-- Índices de leitura (timeline por usuário; wipe/lifecycle por protocolo+status)
CREATE INDEX IF NOT EXISTS idx_dose_instances_user_scheduled
  ON public.dose_instances (user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_dose_instances_protocol_status
  ON public.dose_instances (protocol_id, status);

-- Grants obrigatórios (CLAUDE.md — pós 30/10/2026 novas tabelas não recebem grants automáticos)
-- anon negado explicitamente (defense-in-depth): dose_instances nunca tem dado público.
REVOKE ALL ON public.dose_instances FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_instances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_instances TO service_role;
ALTER TABLE public.dose_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dose_instances_owner ON public.dose_instances;
CREATE POLICY dose_instances_owner ON public.dose_instances
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 2. dose_adherence_monthly — rollup mensal (cold; agregados imutáveis)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.dose_adherence_monthly (
  user_id      uuid NOT NULL,
  protocol_id  uuid NOT NULL REFERENCES public.protocols(id) ON DELETE CASCADE,
  month        date NOT NULL CHECK (extract(day from month) = 1),  -- sempre o 1º dia do mês (evita linhas duplicadas do mesmo mês sob PKs distintas)
  expected     int NOT NULL,
  taken        int NOT NULL,
  missed       int NOT NULL,
  PRIMARY KEY (user_id, protocol_id, month)
);

COMMENT ON TABLE public.dose_adherence_monthly IS 'Rollup mensal de adesão (ADR-048 §7). Agregados imutáveis de meses fechados; permite podar dose_instances raw (>18 meses) sem perder histórico.';

REVOKE ALL ON public.dose_adherence_monthly FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_adherence_monthly TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_adherence_monthly TO service_role;
ALTER TABLE public.dose_adherence_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dose_adherence_monthly_owner ON public.dose_adherence_monthly;
CREATE POLICY dose_adherence_monthly_owner ON public.dose_adherence_monthly
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 3. medicine_logs — elo para a instância (nullable: avulsas/PRN ficam null)
-- ============================================================================
ALTER TABLE public.medicine_logs
  ADD COLUMN IF NOT EXISTS dose_instance_id uuid REFERENCES public.dose_instances(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.medicine_logs.dose_instance_id IS 'FK para dose_instances quando a tomada ancora num slot agendado. NULL para doses avulsas/PRN ou fora da janela de tolerância.';

-- ============================================================================
-- 4. protocols — high-water-mark de geração + marca de pausa
-- ============================================================================
ALTER TABLE public.protocols
  ADD COLUMN IF NOT EXISTS generated_through timestamptz;
ALTER TABLE public.protocols
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

COMMENT ON COLUMN public.protocols.generated_through IS 'High-water-mark: até quando dose_instances já foram materializadas para este protocolo (ADR-048). NULL = nada gerado ainda.';
COMMENT ON COLUMN public.protocols.paused_at IS 'Timestamp da última pausa (active=false). Cron detecta pausa > 1 dia para wipe das pendentes futuras.';
