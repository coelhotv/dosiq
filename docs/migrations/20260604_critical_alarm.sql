-- Migration: 010 — Alarme Nativo v2
-- Adiciona critical_alarm a protocols (intenção) e dose_instances (materializado por-dose).
-- ADR-055 accepted 2026-06-03.
-- Ambas as colunas nascem false — nenhum tratamento/dose existente vira crítico sem ação do usuário.

-- 1. Intenção do usuário (editável no form de tratamento)
ALTER TABLE public.protocols
  ADD COLUMN IF NOT EXISTS critical_alarm boolean NOT NULL DEFAULT false;

-- 2. Bit materializado por-dose (fonte primária do dispatcher e do agendador)
ALTER TABLE public.dose_instances
  ADD COLUMN IF NOT EXISTS critical_alarm boolean NOT NULL DEFAULT false;

-- Grants (CLAUDE.md — obrigatório para novas colunas a partir de 30/10/2026)
-- protocols já tem grants; dose_instances já tem grants; ADD COLUMN herda — sem grant extra necessário.
-- Confirmar RLS já ativo nas tabelas:
-- protocols: RLS habilitado (user_id = auth.uid())
-- dose_instances: RLS habilitado (user_id = auth.uid())

-- Verificação pós-migração:
-- SELECT count(*) FROM public.protocols WHERE critical_alarm = true;     -- deve ser 0
-- SELECT count(*) FROM public.dose_instances WHERE critical_alarm = true; -- deve ser 0
