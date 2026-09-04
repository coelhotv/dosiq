---
title: Modificar Dados Reais em Produção
summary: >-
  Alterar vigência, estoque ou horários de medicamentos em uma sessão ativa de usuário real para
  fins de teste de UI ou lógica.
layer: warm
status: active
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - modificar
    - dados
    - reais
    - produção
legacy_tags:
  - all
id: AP-H28
incident_count: 0
last_occurred: "2026-04-20"
tags:
  - process
  - testing
  - security
---

# AP-H28 — Modificar Dados Reais em Produção

## O Problema
O agente utiliza ferramentas de interação visual (browser) ou acesso direto ao DB para modificar registros de um usuário humano real na tentativa de reproduzir um cenário de teste ou validar um filtro.

## Por Que é um Problema
1.  **Risco de Saúde**: Em aplicativos médicos, alterar uma data de expiração ou dose pode confundir o paciente sobre seu tratamento real.
2.  **Integridade de Dados**: Corrompe o histórico de adesão e as métricas do usuário.
3.  **Privacidade**: Viola a fronteira entre ambiente de desenvolvimento e ambiente pessoal do usuário.

## Como Evitar (Remedy)
1.  **Use Mocks**: Intercepte as chamadas de rede ou prefira testes unitários com dados sintéticos.
2.  **Contas de Teste**: Crie usuários específicos (`test-user@example.com`) para validação visual.
3.  **Ambientes Isolados**: Verifique se o `.env` local não está apontando para o Supabase de Produção antes de rodar comandos de escrita.

## Exemplo do Mundo Real
Sessão 2026-04-20: O agente alterou a data do "Omega 3" do usuário para ontem para testar se o filtro de vigência estava funcionando, fazendo o medicamento sumir do dashboard real do usuário.
