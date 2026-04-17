# Exec Spec: Native App UX Sprint Plan

> **Status:** Sprint plan executavel
> **Base obrigatoria:** `plans/native_app_ux_revamp/MASTER_PLAN_NATIVE_UX_REVAMP.md`
> **Objetivo:** decompor o revamp UX em sprints pequenos o suficiente para caber em contexto limitado e operacao semanal real

---

## Como usar esta spec

Protocolo obrigatorio por sprint:

1. `/devflow`
2. Ler `README.md`
3. Ler este arquivo inteiro
4. Ler a secao do sprint alvo
5. Ler `EXEC_SPEC_NATIVE_APP_UX_ARCHITECTURE.md`
6. Ler no maximo 2 addendums citados na secao
7. `/devflow coding "UX.{N} - <titulo>"`

Regra:

- um agente executor nao deve iniciar pela memoria desta conversa
- este arquivo e o ponto de entrada operacional

---

## Referencias visuais obrigatorias

Assets locais oficiais:

- `plans/native_app_ux_revamp/app-new-dashboard.png`
- `plans/native_app_ux_revamp/app-new-treatment.png`
- `plans/native_app_ux_revamp/app-new-stock.png`
- `plans/native_app_ux_revamp/app-new-profile.png`

Uso por sprint:

| Sprint | Asset principal |
|--------|-----------------|
| UX.3 | `app-new-dashboard.png` |
| UX.4 | `app-new-treatment.png` |
| UX.5 | `app-new-stock.png` |
| UX.6 | `app-new-profile.png` |

Regra:

- ao iniciar um sprint de tela, o agente deve abrir o asset correspondente
- o asset orienta hierarquia visual e composicao, nao a IA da navegacao

---

## Tabela de status dos sprints

| Sprint | Titulo | Status | Branch sugerida |
|--------|--------|--------|-----------------|
| UX.1 | Docs e baseline | Concluido | `feature/native-ux/ux-1-docs-baseline` |
| UX.2 | Fundacao visual e tokens | Planejado | `feature/native-ux/ux-2-foundation` |
| UX.3 | Revamp Hoje | Planejado | `feature/native-ux/ux-3-today` |
| UX.4 | Revamp Tratamentos | Planejado | `feature/native-ux/ux-4-treatments` |
| UX.5 | Revamp Estoque | Planejado | `feature/native-ux/ux-5-stock` |
| UX.6 | Revamp Perfil | Planejado | `feature/native-ux/ux-6-profile` |
| UX.7 | Monetizacao foundation | Planejado | `feature/native-ux/ux-7-ads-foundation` |
| UX.8 | Hardening e consistencia transversal | Planejado | `feature/native-ux/ux-8-hardening` |

---

## Precondicoes globais

- ADR-028 aceita e respeitada
- tabs principais preservadas
- docs desta pasta aprovados como fonte ativa
- addendums hibridos de tokens, testing e deeplinks disponiveis

---

## UX.1 - Docs e baseline

### Objetivo

Congelar o corpus documental da iniciativa e registrar a baseline real do mobile atual.

### Arquivos esperados em escopo

- `plans/native_app_ux_revamp/*`
- leituras de `apps/mobile/src/features/*/screens/*.jsx`

### Contexto a carregar

- `README.md`
- `MASTER_PLAN_NATIVE_UX_REVAMP.md`
- `PRD_NATIVE_APP_UX_REVAMP.md`
- `EXEC_SPEC_NATIVE_APP_UX_ARCHITECTURE.md`
- os 4 assets `.png` da pasta para validacao de referencia

### Comandos de validacao

- revisao manual da coerencia entre docs

### Testes obrigatorios

- N/A documental

### Riscos conhecidos

- documentacao excessivamente abstrata
- conflito com master spec hybrid

### Handoff esperado

- ChatGPT revisa framing
- Claude registra e organiza
- Gemini valida consistencia estrutural

### Motivo da quebra

- caber em budget baixo e gerar base unica para os demais sprints

### Resultado esperado ao concluir

- corpus documental consolidado em `plans/native_app_ux_revamp/`
- referencias visuais locais ancoradas nos docs centrais
- baseline mobile e dependencias da iniciativa explicitadas
- entrada operacional pronta para `UX.2`

---

## UX.2 - Fundacao visual e tokens

### Objetivo

Criar componentes base, scaffold e tokens semanticos antes do redesign das telas.

### Arquivos esperados em escopo

- `apps/mobile/src/shared/styles/tokens.js`
- novos componentes base de UI
- `ScreenContainer` ou sucessor compatibilizado

### Contexto a carregar

- arquitetura
- addendum de design system
- addendum de testing

### Comandos de validacao

- `npm run test --workspace=@meus-remedios/mobile`

### Testes obrigatorios

- componentes base
- scaffold
- flags simples quando aplicavel

### Riscos conhecidos

- fundacao ampla demais para um sprint
- divergencia entre token fisico e token semantico

### Handoff esperado

- ChatGPT: revisao de coerencia visual
- Claude: execucao
- Gemini: review de risco arquitetural

### Motivo da quebra

- separar fundacao da estilzacao final das telas reduz retrabalho

---

## UX.3 - Revamp Hoje

### Objetivo

Transformar `TodayScreen` em command center diario sem quebrar o fluxo de registro.

### Arquivos esperados em escopo

- `TodayScreen.jsx`
- componentes de dashboard mobile associados
- adapter/VM da tela

### Contexto a carregar

- arquitetura
- design system
- data mapping
- testing
- `app-new-dashboard.png`

### Comandos de validacao

- `npm run test --workspace=@meus-remedios/mobile`

### Testes obrigatorios

- estados da tela
- prioridade do momento
- agenda por periodo

### Riscos conhecidos

- competir com fluxo do modal de registro
- tornar a agenda bonita, mas menos legivel

### Handoff esperado

- ChatGPT: critica de UX
- Claude: execucao
- Gemini: review de regressao funcional

### Motivo da quebra

- `Hoje` e a tela mais sensivel do app; merece sprint exclusiva

---

## UX.4 - Revamp Tratamentos

### Objetivo

Evoluir a leitura de protocolos para um formato editorial e mais escaneavel.

### Arquivos esperados em escopo

- `TreatmentsScreen.jsx`
- `TreatmentCard.jsx`
- possiveis adapters

### Contexto a carregar

- arquitetura
- design system
- data mapping
- `app-new-treatment.png`

### Comandos de validacao

- `npm run test --workspace=@meus-remedios/mobile`

### Testes obrigatorios

- estados da tela
- rendering dos cards
- status/progresso

### Riscos conhecidos

- falta de taxonomia forte para grupos
- excesso de riqueza visual sem dado robusto

### Handoff esperado

- ChatGPT: valida agrupamento e copy
- Claude: implementa
- Gemini: revisa clareza estrutural

### Motivo da quebra

- tela tem semantica propria e risco moderado de crescer demais

---

## UX.5 - Revamp Estoque

### Objetivo

Transformar a leitura de estoque em decisao de risco e reposicao.

### Arquivos esperados em escopo

- `StockScreen.jsx`
- `StockItem.jsx`
- componentes de alerta/summary

### Contexto a carregar

- arquitetura
- design system
- data mapping
- ads monetization para placement futuro
- `app-new-stock.png`

### Comandos de validacao

- `npm run test --workspace=@meus-remedios/mobile`

### Testes obrigatorios

- resumo critico
- lista critica vs regular
- estados da tela

### Riscos conhecidos

- CTA de compra/reposicao sem backing forte
- confundir estoque regular e critico

### Handoff esperado

- ChatGPT: valida narrativa de risco
- Claude: implementa
- Gemini: revisa semantica e risco

### Motivo da quebra

- estoque exige linguagem propria de criticidade

---

## UX.6 - Revamp Perfil

### Objetivo

Transformar a tela de perfil em hub utilitario pessoal.

### Arquivos esperados em escopo

- `ProfileScreen.jsx`
- componentes utilitarios de profile

### Contexto a carregar

- arquitetura
- design system
- data mapping
- `app-new-profile.png`

### Comandos de validacao

- `npm run test --workspace=@meus-remedios/mobile`

### Testes obrigatorios

- estados da tela
- acoes utilitarias
- navegacao para preferencias

### Riscos conhecidos

- cair em aspiracao sem backing real
- virar tela de "cards bonitos" sem utilidade concreta

### Handoff esperado

- ChatGPT: revisao de utilidade real
- Claude: execucao
- Gemini: review de escopo e riscos

### Motivo da quebra

- `Perfil` tem mais area cinzenta de produto e precisa de sprint dedicada

---

## UX.7 - Monetizacao foundation

### Objetivo

Inserir slots, flags e contratos de ads sem ativacao real do provider.

### Arquivos esperados em escopo

- `AdSlotCard`
- flags/config
- integracao nas telas permitidas

### Contexto a carregar

- arquitetura
- addendum de ads
- testing

### Comandos de validacao

- `npm run test --workspace=@meus-remedios/mobile`

### Testes obrigatorios

- hidden/placeholder/provider_unavailable
- nenhuma tela quebra sem provider

### Riscos conhecidos

- monetizacao contaminar a hierarquia clinica

### Handoff esperado

- ChatGPT: revisa placements
- Claude: implementa foundation
- Gemini: faz finding pass de risco/etica

### Motivo da quebra

- monetizacao precisa de trilha separada da fundacao visual

---

## UX.8 - Hardening e consistencia transversal

### Objetivo

Fechar ajustes globais de consistencia, estados, acessibilidade e regressao.

### Arquivos esperados em escopo

- ajustes nas 4 telas
- testes adicionais
- pequenos refinamentos de base

### Contexto a carregar

- arquitetura
- testing
- design system

### Comandos de validacao

- `npm run test --workspace=@meus-remedios/mobile`

### Testes obrigatorios

- navegacao preservada
- estados principais de todas as telas
- verificacoes transversais de ad slots

### Riscos conhecidos

- sprint virar caixao de ajustes infinitos

### Handoff esperado

- ChatGPT: revisao final de experiencia
- Claude: fechamento
- Gemini: review final de riscos

### Motivo da quebra

- hardening deve ser etapa propria para nao poluir sprints de feature

---

## Gates de saida

Antes de concluir cada sprint:

- escopo do sprint completo
- testes obrigatorios executados
- validacao manual minima realizada
- handoff documentado

---

## Validacoes humanas

Obrigatorias em sprints de tela:

- iOS Simulator ou device
- Android Emulator ou device
- leitura real do CTA principal
- safe area e tab bar

---

## Dependencias bloqueantes

- UX.2 bloqueia UX.3-UX.6
- UX.3-UX.6 alimentam UX.7
- UX.7 e UX.3-UX.6 alimentam UX.8

---

## Criterios de merge por sprint

- PR unico por sprint, salvo quebra por budget
- sem auto-merge por agente
- aguardando review e aprovacao humana conforme regras do projeto
