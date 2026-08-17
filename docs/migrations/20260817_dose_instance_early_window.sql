-- 20260817_dose_instance_early_window.sql — spec 067 Slice A2 (T012)
--
-- OBJETIVO
--   `dose_instances` ganha o PISO da janela de dose (`early_window_minutes`), irmão de
--   `tolerance_minutes`. Hoje a guarda de janela do client é UNILATERAL (só teto): um alarme que
--   dispara 3h37 ADIANTADO promove o takeover e o "Pular" destrói a dose real (incidente
--   2026-08-14). O piso é o lado que faltava.
--
-- POR QUE COLUNA, E NÃO CÁLCULO NO CLIENT (Decisão 6 / RC3-F1)
--   `computeTolerances` (packages/core/src/utils/doseInstanceGenerator.ts:126) JÁ deriva a janela
--   por slot a partir do `time_schedule`, com wrap-around de meia-noite. No instante do alarme o
--   client NÃO tem o `time_schedule` (o payload da notificação leva `toleranceMinutes`, não a
--   grade) — então recalcular exigiria uma segunda cópia da regra, no caminho mais frágil do app
--   (headless/cold start). O piso nasce na materialização, junto do teto, e o client só LÊ.
--
-- FORMA: `INTEGER NOT NULL DEFAULT 120` (espelha `tolerance_minutes`, verificado em prod
--   2026-08-17 via information_schema). Fast default (PG11+) preenche TODA linha já materializada
--   no próprio DDL ⇒ **não existe estado com piso nulo** e a guarda nunca nasce desligada
--   (resolve RC-SEC/S-5 por construção, não por COALESCE no banco). Pior caso possível: janela mais
--   larga que a ideal — nunca mais estreita, nunca ausente.
--
-- ⚠️ O `COALESCE(early_window_minutes, 120)` continua existindo NO CLIENT (FR-032): lá a ausência
--   é real — uma notificação já agendada por app antigo chega sem o campo no `data`.
--
-- BACKFILL: NÃO ACONTECE AQUI, E NÃO TOCA O PASSADO (Decisão 11, 2026-08-17).
--   Só `pending` FUTURAS recebem valor calculado (1.319 de 7.107 linhas, medido), pelo caminho
--   canônico de regeneração do gerador — não por `UPDATE ... CASE` aqui.
--   Refinar o passado exigiria derivar o piso histórico do `time_schedule` ATUAL do protocolo, e a
--   instância é FATO DATADO enquanto o protocolo é ENTIDADE VIVA (R-299): um protocolo 6/6h editado
--   para 12/12h receberia 120 onde o correto era 90; o inverso receberia 90 onde era 120 ⇒ recusa de
--   registro legítimo em dado histórico. Como o piso governa REGISTRO e dose `taken`/`missed` nunca é
--   registrada de novo, piso em linha resolvida é campo morto: fica no DEFAULT 120.
--   Evidência viva: protocolo 1be66ade… ("Dipirona Monoidratada") está hoje `quando_necessário` com
--   12 instâncias que nasceram DIÁRIAS 6/6h — histórico legítimo, preservado de propósito.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                  | Análise / mitigação                                   |
-- |---------------------------------------|-------------------------------------------------------|
-- | coluna NULL em linha existente        | IMPOSSÍVEL: NOT NULL + fast default preenche no DDL. É o ponto da forma escolhida (S-5). |
-- | piso = 0                              | ACEITO pelo CHECK (range 0..120 exigido pela FR-032). Com gap < 4 min o gerador produziria 0 e o lado adiantado ficaria desligado NAQUELA dose. Nenhum protocolo de prod chega perto: menor gap medido = 285 min (piso 71). Registrado como risco MEDIUM no plan; apertar o range é decisão do PO, não desta migração. |
-- | piso > 120                            | 23514 do CHECK. Teto é regra de produto (Decisão 5: apertar no futuro baixa a FRAÇÃO, nunca o teto). |
-- | piso > tolerance_minutes              | POSSÍVEL e legítimo: são janelas de lados diferentes (piso=adiantado, teto=atrasado) e a spec aceita assimetria de propósito (Decisão 5). Nenhum CHECK cruzado — inventaria acoplamento que a regra não tem. |
-- | tolerance_minutes alterado por engano | Esta migração NÃO escreve em tolerance_minutes. Guard da PO-13: SELECT de controle antes/depois. |
-- | cliente antigo (frota) lendo a tabela | Coluna NOVA é aditiva: `SELECT` de app antigo não a pede e não quebra (o inverso — DROP — é que exigiria o gate ADR-088/fleet-versions.sh). |
-- | rollback                              | `DROP COLUMN` puro; nenhum dado derivado depende dela ainda no momento da aplicação (o código que a lê entra no mesmo PR, depois). |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- GRANTS/RLS: `dose_instances` já existe com RLS (`dose_instances_owner`) e grants — apenas coluna
-- nova, sem CREATE TABLE ⇒ nada a conceder (a coluna herda o privilégio de tabela).
--
-- Aplicar via Supabase MCP (apply_migration), após BEGIN..ROLLBACK do arquivo
-- `20260817_dose_instance_early_window.test.sql`.

ALTER TABLE public.dose_instances
  ADD COLUMN IF NOT EXISTS early_window_minutes INTEGER NOT NULL DEFAULT 120;

ALTER TABLE public.dose_instances
  DROP CONSTRAINT IF EXISTS dose_instances_early_window_minutes_check;

ALTER TABLE public.dose_instances
  ADD CONSTRAINT dose_instances_early_window_minutes_check
  CHECK (early_window_minutes BETWEEN 0 AND 120);

COMMENT ON COLUMN public.dose_instances.early_window_minutes IS
  'Spec 067 A2: PISO da janela de dose em minutos — min(0.25 x menor gap adjacente, 120), derivado '
  'na materializacao por computeTolerances (mesmo lugar de tolerance_minutes). Guarda o lado '
  'ADIANTADO: registro/alarme com now() < scheduled_for - este piso e recusado. NOT NULL DEFAULT '
  '120 = fail-closed por construcao (RC-SEC/S-5). Passado fica em 120 de proposito (Decisao 11 / '
  'R-299): so pending futura recebe valor calculado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificação pós-aplicação
--   1. Forma da coluna (esperado: integer / NO / 120):
--      SELECT column_name, data_type, is_nullable, column_default
--        FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='dose_instances'
--         AND column_name='early_window_minutes';
--   2. CHECK presente:
--      SELECT pg_get_constraintdef(oid) FROM pg_constraint
--       WHERE conname='dose_instances_early_window_minutes_check';
--   3. Zero linha com piso nulo (esperado 0 — garantido pelo NOT NULL, medido por honestidade):
--      SELECT count(*) FROM public.dose_instances WHERE early_window_minutes IS NULL;
--   4. Gate de saída R-295 — o select do app EXECUTADO contra o PostgREST real:
--      curl "$SUPABASE_URL/rest/v1/dose_instances?select=id,scheduled_for,tolerance_minutes,early_window_minutes&limit=1" \
--           -H "apikey: $KEY" -H "Authorization: Bearer $KEY"      # 200 = contrato honrado
--   5. `npm run supabase:types` (R-289) — regen de database.types.ts no MESMO PR.
--
-- Rollback
--   ALTER TABLE public.dose_instances DROP CONSTRAINT IF EXISTS dose_instances_early_window_minutes_check;
--   ALTER TABLE public.dose_instances DROP COLUMN IF EXISTS early_window_minutes;
