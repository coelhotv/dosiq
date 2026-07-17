-- 029 F3.1 — T017a (CHECK anti-zumbi) + T017f (DROP do vestígio da migração)
-- Data: 2026-07-17 · Spec: plans/specs/029-treatment-level-titration (local-only)
-- Preflight R-270 contra prod em BEGIN..ROLLBACK: 8/8 PASS.
-- ✅ APLICADA EM PROD em 2026-07-17 (autorizada pelo PO; via MCP `apply_migration`).
--    Estado reconfirmado imediatamente antes: titrations=0, titration_steps=0 (0 linhas violariam
--    o CHECK, 0 perderiam dado no DROP). Prova pós-aplicação contra o banco real (BEGIN..ROLLBACK):
--      INSERT zumbi (current + started_at NULL) ....... REJEITADO (23514)  PASS
--      INSERT ativação legítima (F4/T019a) ............ ACEITO (1 linha)   PASS
--      UPDATE zumbificando etapa já ativa ............. REJEITADO (23514)  PASS
--    `database.types.ts` regenerado no MESMO PR (R-289): -10 linhas, diff EXCLUSIVAMENTE
--    `migrated_from_protocol_id` (Row/Insert/Update + bloco da FK); 35 tabelas antes e depois;
--    `supabase:types:check` limpo.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- T017a — A TRAVA QUE FALTOU DESDE O INÍCIO (AP-301)
--
-- A titulação N1 nunca funcionou em produção, em 6 meses. O motivo não foi um bug isolado: era
-- um estado CONTRADITÓRIO que o banco aceitava representar. `titration_status='titulando'` dizia
-- que a escada estava ligada; `stage_started_at` era o relógio que a fazia andar. O caminho real
-- do usuário (criar o tratamento e DEPOIS editar para somar a escada) gravava o status e deixava
-- o relógio NULL. O motor ignora etapa sem t₀ — corretamente, não dá para calcular vencimento sem
-- âncora. Resultado: status "ligado", relógio parado, nada acontecia. Sem erro, sem log.
--
-- Nenhum CHECK proibia a contradição. O modelo N2 herdou a MESMA forma (`status='current'` +
-- `started_at` nullable) e reproduziria o zumbi no primeiro slice de UI (F4).
--
-- Este CHECK torna o estado IRREPRESENTÁVEL — em INSERT e em UPDATE. A partir daqui, esquecer de
-- setar o relógio é um erro 23514 na cara do desenvolvedor, não uma feature morta em silêncio.
--
-- JANELA: o banco está VAZIO (titrations=0, titration_steps=0 — o dado de teste do PO foi apagado
-- no pivô de 2026-07-16). O CHECK entra sem violar linha nenhuma. Depois do F4 já haveria dado.
--
-- O QUE ESTE CHECK NÃO É: não exige que a escada tenha uma etapa `current`. "Escada sem vigente"
-- é estado LEGÍTIMO — alvo atingido (a última etapa finita encerra e nenhuma outra assume) e
-- escada pausada. Transformar isso em trava quebraria o motor do F3 (CON-032 §2).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.titration_steps
  ADD CONSTRAINT titration_steps_current_exige_started_check
  CHECK (status <> 'current' OR started_at IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- T017f — `migrated_from_protocol_id`: vestígio de uma migração que não existe mais
--
-- A coluna existia para rastrear a origem N1 de cada escada migrada. O pivô da 029 (2026-07-16)
-- eliminou a migração inteira: a feature tinha ZERO usuários, o único dado era o protocolo de
-- teste do PO, e a migração sequer convertia multi-med direito (perdia `requires_new_medicine`).
-- Não há origem a rastrear. A FK `titrations_migrated_from_protocol_id_fkey` cai junto.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.titrations
  DROP COLUMN migrated_from_protocol_id;
