-- 20260817_backfill_early_window_pending.sql — spec 067 Slice A2 (T016 / PO-13)
--
-- ESCOPO: SÓ `pending` FUTURAS. O passado permanece no `DEFAULT 120` (Decisão 11, 2026-08-17).
--
-- POR QUE O PASSADO NÃO É REFINADO
--   Refinar exigiria derivar o piso histórico do `time_schedule` ATUAL do protocolo — e a instância
--   é FATO DATADO enquanto o protocolo é ENTIDADE VIVA ([[R-299]]). Um protocolo 6/6h editado para
--   12/12h receberia 120 onde o correto era 90 (janela mais larga que a materialização produziria);
--   o inverso receberia 90 onde era 120, e aí a guarda RECUSARIA um registro legítimo em dado
--   histórico. Como o piso governa REGISTRO e dose `taken`/`missed` nunca é registrada de novo, piso
--   em linha resolvida é campo morto.
--   Evidência viva do risco: protocolo 1be66ade… ("Dipirona Monoidratada", kcarolinne4@) está hoje
--   `quando_necessário` com 12 instâncias que NASCERAM diárias 6/6h.
--
-- POR QUE OS VALORES SÃO LITERAIS AQUI (e não um CASE que recalcula)
--   A FR-024 proíbe uma segunda cópia da derivação. Os 78 pares (protocolo, slot) foram computados
--   pelo CÓDIGO CANÔNICO — `generateInstances`/`computeTolerances` do `@dosiq/core`, bundlado com
--   esbuild e executado sobre os protocolos reais de prod. Este SQL carrega apenas o RESULTADO:
--   nenhuma aritmética de wrap-around vive aqui, e portanto nada aqui pode divergir do core.
--   Só 5 dos 78 pares ficaram abaixo de 120 (os demais já estavam corretos pelo DEFAULT).
--
-- ⚠️ A leitura das instâncias para essa derivação foi PAGINADA (`Range`): o primeiro fetch devolveu
--   exatamente 1000 linhas — o teto silencioso do PostgREST ([[AP-186]]). Sem paginar, o backfill
--   teria operado sobre um subconjunto e ninguém notaria.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                 | Análise / mitigação                                    |
-- |--------------------------------------|--------------------------------------------------------|
-- | `tolerance_minutes` alterado          | GUARD: soma de controle antes/depois — 368520 == 368520 (medido). O UPDATE só toca `early_window_minutes`. |
-- | passado alterado                      | GUARD: `status='pending' AND scheduled_for >= now()` no WHERE + verificação pós (0 linhas fora disso). |
-- | fuso errado no match do slot          | O `to_char(... AT TIME ZONE v.tz)` usa o tz do DONO (vindo de `user_settings`, fallback SP), não o do servidor. Havia 4 fusos em jogo (SP, Fortaleza, Belém, Araguaína). |
-- | slot não encontrado (nenhum match)    | UPDATE afeta 0 linhas para aquele par — inócuo: a linha fica no DEFAULT 120 (fail-closed, janela mais larga). Nunca resulta em piso 0. |
-- | instância materializada DEPOIS deste backfill | Nasce já com o piso correto pelo gerador (mesmo PR). O backfill é one-shot p/ o estoque existente. |
-- | valor fora de 0..120                  | Barrado pelo CHECK da migração irmã (23514). Os valores aplicados são 71/75/90. |
-- | idempotência                          | Re-rodar é seguro: escreve o mesmo valor nas mesmas linhas. |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- RESULTADO APLICADO EM PROD (2026-08-17):
--   1.308 pending futuras · 77 refinadas · 0 linha do passado tocada · 0 piso nulo
--   piso mínimo 71 · máximo 90 (as demais seguem em 120)
--   dry-run em BEGIN..ROLLBACK antes do apply: mesmos 77, `tolerance_minutes` e `status` intactos

UPDATE public.dose_instances di
   SET early_window_minutes = v.ew
  FROM (VALUES
  -- protocolo 07:15/12:00/17:00 (gaps 285/285/300 → 0,25× = 71/71/75)
  ('246ead5b-feda-47a6-8502-78e0eaecb559'::uuid,'07:15','America/Sao_Paulo',71),
  ('246ead5b-feda-47a6-8502-78e0eaecb559'::uuid,'12:00','America/Sao_Paulo',71),
  ('246ead5b-feda-47a6-8502-78e0eaecb559'::uuid,'17:00','America/Sao_Paulo',75),
  -- protocolo 07:00/13:00 (gap 360 → 90)
  ('e1ff97e4-b716-4af7-8272-32d3f4cbdf29'::uuid,'07:00','America/Sao_Paulo',90),
  ('e1ff97e4-b716-4af7-8272-32d3f4cbdf29'::uuid,'13:00','America/Sao_Paulo',90)
) AS v(protocol_id, slot, tz, ew)
 WHERE di.protocol_id = v.protocol_id
   AND di.status = 'pending'
   AND di.scheduled_for >= now()
   AND to_char(di.scheduled_for AT TIME ZONE v.tz, 'HH24:MI') = v.slot;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificação (PO-13)
--   SELECT count(*) AS refinadas_total,
--          count(*) FILTER (WHERE status <> 'pending' OR scheduled_for < now()) AS passado_tocado,
--          min(early_window_minutes), max(early_window_minutes)
--     FROM public.dose_instances WHERE early_window_minutes <> 120;
--   -- esperado: 77 / 0 / 71 / 90
--
--   SELECT sum(tolerance_minutes) FROM public.dose_instances
--    WHERE status='pending' AND scheduled_for >= now();   -- esperado: idêntico ao de antes (368520)
--
-- Rollback
--   UPDATE public.dose_instances SET early_window_minutes = 120
--    WHERE status='pending' AND scheduled_for >= now() AND early_window_minutes <> 120;
--   (volta ao DEFAULT — fail-closed, janela mais larga; nunca desliga a guarda)
