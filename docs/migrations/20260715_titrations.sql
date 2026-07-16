-- 20260715_titrations.sql — 029 Slice F1 / T001 (modelo da Evolução do tratamento / titulação N2)
--
-- PROPÓSITO: dar entidade de primeira classe à ESCADA de titulação (ADR-080) — o orquestrador
-- `titrations` sobre os executores `protocols`. Cada etapa (`titration_steps`) referencia
-- medicamento + dose + unidade + duração, e é o que permite a escada SALTAR de medicamento
-- (caso GLP-1: 0,25 → 0,5 → 1 mg, cada força um cadastro distinto) — o que o jsonb N1
-- intra-protocolo não faz por design.
--
-- ESCOPO DESTE SLICE: SOMENTE as duas tabelas + RLS + grants + CHECK. NENHUMA função nova
-- (a RPC `confirm_titration_switch` é F3), NENHUM motor, NENHUM adapter, NENHUMA migração de
-- dados N1→N2 (F2). O jsonb N1 dos `protocols` fica INTACTO e vivo.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- AS DECISÕES DE MODELO QUE EXPLICAM O RESTO (ADR-080)
-- ─────────────────────────────────────────────────────────────────────────────
-- 1) DADO CLÍNICO DO TITULAR → CASCADE (R-287 / AP-272 / LGPD art. 16). `user_id` NOT NULL com
--    FK `auth.users ON DELETE CASCADE` nas DUAS tabelas. A escada é regime de medicação: some
--    com a conta. A FK cobre a exclusão SOZINHA — não depende de a RPC `delete_user_account`
--    lembrar de listar estas tabelas (é justamente o erro que o AP-272 descreve). `user_id` é
--    denormalizado em `titration_steps` (além do `titration_id`) para a RLS ser direta por linha.
--
-- 2) TIPO DE TRANSIÇÃO É DERIVADO, NÃO COLUNA (ADR-080 §2). `dose_change` vs `medicine_switch`
--    sai da comparação do `medicine_id` da etapa N com a N-1 — zero enum a manter em dois lugares.
--    Materializa só no evento de auditoria (F3). Por isso NÃO existe coluna `transition_type` aqui.
--
-- 3) `medicine_id` é NOT NULL e usa NO ACTION (o default), não RESTRICT nem CASCADE:
--    - bloqueia o DELETE avulso de um medicamento ainda referenciado (o app também barra no fluxo
--      de delete — spec §Edge "exclusão de medicamento referenciado");
--    - NO ACTION difere a checagem para o fim do statement, então a exclusão de CONTA (que
--      cascateia `titration_steps` por `user_id` E `medicines` por `user_id` no mesmo comando)
--      não colide: a etapa referenciadora já foi apagada quando a checagem roda. RESTRICT
--      (imediato) poderia falhar por ordem de cascade; NO ACTION não.
--    - arquivamento de medicamento NÃO é delete → a linha sobrevive, FK intacta, e a UI mostra
--      o card de "escada quebrada" (F5) sem precisar de `medicine_id` nullable.
--
-- 4) `duration_days` NULL = ETAPA CONTÍNUA (substitui o `requires_new_medicine` implícito do N1).
--    Não é dado ausente: é o estado "alvo atingido / dose de manutenção sem fim previsto".
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                      | Análise / mitigação                                  |
-- |-------------------------------------------|------------------------------------------------------|
-- | user_id NULL                              | NOT NULL nas duas tabelas. Só a exclusão da conta remove linha (CASCADE), nunca a deixa órfã. |
-- | dose = 0 ou negativa                      | CHECK (dose > 0). Dose de titulação é sempre positiva; 0 seria "não tomar", que é ausência de etapa. |
-- | duration_days = 0 ou negativa             | CHECK (duration_days IS NULL OR duration_days > 0). NULL é contínua (intencional); 0 seria etapa de duração nula (bug). |
-- | position duplicada na mesma escada        | UNIQUE (titration_id, position). Duas etapas na mesma posição = ordem ambígua = escada corrompida. |
-- | position negativa                         | CHECK (position >= 0). |
-- | intake_unit fora do domínio               | CHECK IN ('gotas','ml','UI','mg','cp') — espelha INTAKE_UNITS do core + 'cp' (R-271/R-270). Valor novo exige migração. |
-- | status fora do domínio                    | CHECK IN ('upcoming','current','pending_confirmation','completed'). Sync com TITRATION_STEP_STATUSES (R-271). |
-- | medicine_id de outro usuário              | FK garante existência; a RLS (user_id=auth.uid()) impede inserir etapa cuja titration não é sua. O F2/F3 valida que o medicine_id também é do dono (aqui não há RPC ainda). |
-- | grant automático de anon/authenticated    | AP-275: prod TEM default privileges legados. REVOKE ALL FROM PUBLIC, anon, authenticated ANTES do GRANT explícito + verificação live. |
-- | migração re-executada                     | IF NOT EXISTS / DROP POLICY IF EXISTS em tudo. Idempotente. |
-- | account delete não limpa (AP-272)         | Coberto pela FK user_id→auth.users ON DELETE CASCADE — sem tocar delete_user_account. |
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. titrations — a escada (orquestrador)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.titrations (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dado clínico do titular: CASCADE (decisão 1 no cabeçalho). NÃO trocar por SET NULL.
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Agrupamento visual opcional num plano de tratamento. O plano não sabe/muda nada (NC-1).
  -- SET NULL: apagar o plano não deve derrubar a escada, só desagrupá-la.
  treatment_plan_id        uuid REFERENCES public.treatment_plans(id) ON DELETE SET NULL,

  -- Auditoria da migração N1→N2 (F2): de qual protocol com titration_schedule esta escada nasceu.
  -- SET NULL: se o protocol de origem sumir, o vínculo de auditoria se perde mas a escada fica.
  migrated_from_protocol_id uuid REFERENCES public.protocols(id) ON DELETE SET NULL,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  -- Alvo da FK composta de titration_steps (review Gemini #746): garante que uma etapa só
  -- referencie uma escada do MESMO dono. `id` já é PK (único); esta UNIQUE existe só para ser
  -- referenciável pela FK (titration_id, user_id) — fecha o IDOR descrito no titration_steps.
  CONSTRAINT titrations_id_user_id_key UNIQUE (id, user_id)
);

COMMENT ON TABLE public.titrations IS
  'Escada de titulação (Evolução do tratamento, spec 029 / ADR-080). Orquestrador sobre '
  'protocols (executores). user_id CASCADE = dado clínico do titular (R-287). treatment_plan_id '
  'opcional. Escrita direta do dono via RLS (não há RPC neste modelo — a de confirmação é F3).';

CREATE INDEX IF NOT EXISTS idx_titrations_user
  ON public.titrations (user_id);
CREATE INDEX IF NOT EXISTS idx_titrations_treatment_plan
  ON public.titrations (treatment_plan_id);

ALTER TABLE public.titrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS titrations_select_own ON public.titrations;
CREATE POLICY titrations_select_own ON public.titrations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS titrations_insert_own ON public.titrations;
CREATE POLICY titrations_insert_own ON public.titrations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS titrations_update_own ON public.titrations;
CREATE POLICY titrations_update_own ON public.titrations
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS titrations_delete_own ON public.titrations;
CREATE POLICY titrations_delete_own ON public.titrations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- AP-275: não confiar na nota "tabelas novas não recebem grant". REVOKE tudo antes do GRANT.
REVOKE ALL ON public.titrations FROM PUBLIC;
REVOKE ALL ON public.titrations FROM anon;
REVOKE ALL ON public.titrations FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titrations TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. titration_steps — as etapas da escada
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.titration_steps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  titration_id   uuid NOT NULL,

  -- Denormalizado p/ RLS direta por linha (decisão 1). CASCADE = mesmo motivo da titração.
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Ordem da etapa na escada. UNIQUE(titration_id, position) impede posições ambíguas.
  position       integer NOT NULL CHECK (position >= 0),

  -- NO ACTION (default): bloqueia delete avulso do medicamento, mas não colide com a exclusão
  -- de conta (checagem diferida) — ver decisão 3 no cabeçalho.
  medicine_id    uuid NOT NULL REFERENCES public.medicines(id),

  dose           numeric NOT NULL CHECK (dose > 0),

  -- Espelha INTAKE_UNITS (@dosiq/core) + 'cp' (comprimido). Sync R-271/R-270.
  intake_unit    text NOT NULL CHECK (intake_unit IN ('gotas', 'ml', 'UI', 'mg', 'cp')),

  -- NULL = etapa contínua (dose de manutenção sem fim previsto). > 0 quando definida.
  duration_days  integer CHECK (duration_days IS NULL OR duration_days > 0),

  status         text NOT NULL DEFAULT 'upcoming'
                   CHECK (status IN ('upcoming', 'current', 'pending_confirmation', 'completed')),

  -- Protocol que esta etapa ativou (executor). NULL até a etapa entrar em curso (F3).
  -- SET NULL: pausar/apagar o protocol não deve apagar a etapa (histórico da escada).
  protocol_id    uuid REFERENCES public.protocols(id) ON DELETE SET NULL,

  started_at     timestamptz,
  ended_at       timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT titration_steps_position_unique UNIQUE (titration_id, position),

  -- FK COMPOSTA (review Gemini #746 — IDOR). Referencia (id, user_id) da titração, não só o id:
  -- torna IMPOSSÍVEL uma etapa apontar p/ escada de outro dono, mesmo com user_id spoofado no
  -- INSERT (a RLS `user_id=auth.uid()` sozinha deixava passar `titration_id` alheio). CASCADE
  -- pela titração; a exclusão de conta também cascateia por user_id→auth.users.
  CONSTRAINT titration_steps_titration_user_fkey
    FOREIGN KEY (titration_id, user_id) REFERENCES public.titrations(id, user_id) ON DELETE CASCADE,

  -- Uma etapa não termina antes de começar (review Gemini #746). NULL-safe: só vincula com ambos.
  CONSTRAINT titration_steps_dates_check
    CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

COMMENT ON TABLE public.titration_steps IS
  'Etapas da escada (spec 029 / ADR-080): medicine_id + dose + intake_unit + duration_days '
  '(NULL = contínua) + position + status. medicine_id NOT NULL NO ACTION (bloqueia delete avulso, '
  'cascade-safe na exclusão de conta). Tipo de transição é DERIVADO (medicine_id N vs N-1), sem coluna.';
COMMENT ON COLUMN public.titration_steps.duration_days IS
  'NULL = etapa contínua (dose de manutenção, substitui o requires_new_medicine implícito do N1).';

-- (sem índice em (titration_id, position): a UNIQUE titration_steps_position_unique já cria um —
--  review Gemini #746, índice redundante removido.)
CREATE INDEX IF NOT EXISTS idx_titration_steps_user
  ON public.titration_steps (user_id);
CREATE INDEX IF NOT EXISTS idx_titration_steps_protocol
  ON public.titration_steps (protocol_id);

ALTER TABLE public.titration_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS titration_steps_select_own ON public.titration_steps;
CREATE POLICY titration_steps_select_own ON public.titration_steps
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS titration_steps_insert_own ON public.titration_steps;
CREATE POLICY titration_steps_insert_own ON public.titration_steps
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS titration_steps_update_own ON public.titration_steps;
CREATE POLICY titration_steps_update_own ON public.titration_steps
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS titration_steps_delete_own ON public.titration_steps;
CREATE POLICY titration_steps_delete_own ON public.titration_steps
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.titration_steps FROM PUBLIC;
REVOKE ALL ON public.titration_steps FROM anon;
REVOKE ALL ON public.titration_steps FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titration_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titration_steps TO service_role;
