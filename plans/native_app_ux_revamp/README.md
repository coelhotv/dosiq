# Native App UX Revamp

> **Status:** Pasta oficial da iniciativa | UX.1 concluido | Pronta para UX.2
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Objetivo:** concentrar a documentacao extensiva e prescritiva do revamp visual e experiencial do app mobile native

---

## 1. Objetivo desta pasta

Esta pasta existe para permitir a evolucao do app mobile native a partir do MVP funcional atual para uma experiencia:

- visualmente premium
- clinicamente confiavel
- operacionalmente executavel por agentes IA
- compativel com budget semanal limitado de tokens

Ela e paralela a trilha `H6` de push/beta interno e nao substitui os docs hibridos existentes. O foco aqui e:

- `Hoje`
- `Tratamentos`
- `Estoque`
- `Perfil`

Os mocks hi-fi enviados pelo maintainer sao tratados como:

- referencia estetica
- referencia de hierarquia visual
- referencia de intencao de UX

Eles **nao** sao tratados como wireframes literais nem como autorizacao para mudar a arquitetura de informacao atual.

---

## 2. Mapa de documentos

| Ordem | Documento | Papel |
|------|-----------|-------|
| 1 | `MASTER_PLAN_NATIVE_UX_REVAMP.md` | Documento autoritativo da iniciativa |
| 2 | `PRD_NATIVE_APP_UX_REVAMP.md` | Requisitos de produto, UX e sucesso |
| 3 | `EXEC_SPEC_NATIVE_APP_UX_ARCHITECTURE.md` | Contratos tecnicos e guardrails de implementacao |
| 4 | `EXEC_SPEC_NATIVE_APP_UX_ADDENDUM_DESIGN_SYSTEM.md` | Linguagem visual e sistema de design mobile |
| 5 | `EXEC_SPEC_NATIVE_APP_UX_ADDENDUM_DATA_MAPPING.md` | Mapeamento de dados, gaps e readiness funcional |
| 6 | `EXEC_SPEC_NATIVE_APP_UX_ADDENDUM_ADS_MONETIZATION.md` | Monetizacao, placements e guardrails |
| 7 | `EXEC_SPEC_NATIVE_APP_UX_ADDENDUM_TESTING.md` | Testes, validacao visual e aceite |
| 8 | `EXEC_SPEC_NATIVE_APP_UX_ADDENDUM_AI_ORCHESTRATION.md` | Orcamento de tokens e handoffs entre IAs |
| 9 | `EXEC_SPEC_NATIVE_APP_UX_SPRINT_PLAN.md` | Sprint plan executavel por agentes |
| 10 | `PLANO_EXECUCAO_NATIVE_APP_UX_REVAMP.md` | Cadencia semanal e operacao real |

---

## 3. Referencias visuais locais

Os mocks hi-fi oficiais desta iniciativa estao versionados dentro desta propria pasta:

- `plans/native_app_ux_revamp/app-new-dashboard.png`
- `plans/native_app_ux_revamp/app-new-treatment.png`
- `plans/native_app_ux_revamp/app-new-stock.png`
- `plans/native_app_ux_revamp/app-new-profile.png`

Regra:

- agentes devem preferir estas imagens locais como fonte de referencia visual
- os mocks sao referencia estetica, de hierarquia e de composicao
- os mocks nao sobrepoem a IA principal congelada em `Hoje`, `Tratamentos`, `Estoque`, `Perfil`

Mapeamento oficial:

| Mock | Tela-alvo |
|------|-----------|
| `app-new-dashboard.png` | `Hoje` |
| `app-new-treatment.png` | `Tratamentos` |
| `app-new-stock.png` | `Estoque` |
| `app-new-profile.png` | `Perfil` |

---

## 4. Ordem de leitura

### Para humanos

1. `MASTER_PLAN_NATIVE_UX_REVAMP.md`
2. `PRD_NATIVE_APP_UX_REVAMP.md`
3. `EXEC_SPEC_NATIVE_APP_UX_ARCHITECTURE.md`
4. Addendums conforme a discussao do sprint
5. `EXEC_SPEC_NATIVE_APP_UX_SPRINT_PLAN.md`
6. `PLANO_EXECUCAO_NATIVE_APP_UX_REVAMP.md`

### Para agentes IA

1. `/devflow`
2. Ler `README.md`
3. Ler `MASTER_PLAN_NATIVE_UX_REVAMP.md`
4. Ler a secao do sprint atual em `EXEC_SPEC_NATIVE_APP_UX_SPRINT_PLAN.md`
5. Ler `EXEC_SPEC_NATIVE_APP_UX_ARCHITECTURE.md`
6. Ler no maximo 2 addendums aplicaveis ao sprint
7. Executar `/devflow coding "UX.{sprint} - <titulo>"`

---

## 5. Precedencia documental

Em caso de sobreposicao ou conflito, a precedencia correta e:

1. `MASTER_PLAN_NATIVE_UX_REVAMP.md`
2. `PRD_NATIVE_APP_UX_REVAMP.md`
3. `EXEC_SPEC_NATIVE_APP_UX_ARCHITECTURE.md`
4. `EXEC_SPEC_NATIVE_APP_UX_ADDENDUM_*`
5. `EXEC_SPEC_NATIVE_APP_UX_SPRINT_PLAN.md`
6. `PLANO_EXECUCAO_NATIVE_APP_UX_REVAMP.md`

Quando houver conflito com a estrategia hibrida maior do repositorio, a precedencia superior continua sendo:

1. `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
2. addendums hibridos aplicaveis
3. ADRs aceitas em `.agent/memory/decisions/mobile_and_platform/`
4. esta pasta

---

## 6. Convencoes de nomenclatura

- `MASTER_PLAN_*` = visao autoritativa da iniciativa
- `PRD_*` = requisitos de produto e UX
- `EXEC_SPEC_*` = documento prescritivo de implementacao
- `ADDENDUM_*` = refinamentos tematicos especializados
- `SPRINT_PLAN` = quebrado por sprint para agentes
- `PLANO_EXECUCAO` = ritmo operacional e uso semanal

Convencao das waves desta iniciativa:

- `UX.1` docs e baseline
- `UX.2` fundacao visual e tokens
- `UX.3` tela `Hoje`
- `UX.4` tela `Tratamentos`
- `UX.5` tela `Estoque`
- `UX.6` tela `Perfil`
- `UX.7` monetizacao foundation
- `UX.8` hardening e consistencia

---

## 7. Protocolo `/devflow` por sprint

Template minimo:

```bash
/devflow
/devflow coding "UX.{N} - <titulo>"
```

Contexto maximo permitido por sessao:

- 1 spec principal
- 2 addendums
- arquivos de codigo estritamente em escopo do sprint

Regra:

- 1 sprint = 1 sessao principal
- nao carregar toda a pasta em toda sessao
- nao misturar redesign de multiplas telas no mesmo sprint

---

## 8. Status board inicial

| Sprint | Titulo | Status | Dependencia principal |
|--------|--------|--------|-----------------------|
| UX.1 | Docs e baseline | Concluido | Nenhuma |
| UX.2 | Fundacao visual e tokens | Planejado | UX.1 |
| UX.3 | Revamp Hoje | Planejado | UX.2 |
| UX.4 | Revamp Tratamentos | Planejado | UX.2 |
| UX.5 | Revamp Estoque | Planejado | UX.2 |
| UX.6 | Revamp Perfil | Planejado | UX.2 |
| UX.7 | Monetizacao foundation | Planejado | UX.3-UX.6 |
| UX.8 | Hardening e consistencia | Planejado | UX.3-UX.7 |

---

## 9. Dependencias externas obrigatorias

Esta pasta depende explicitamente de:

- `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DESIGN_TOKENS.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_TESTING_MOBILE.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`
- `ADR-028` em `.agent/memory/decisions/mobile_and_platform/ADR-028.md`

---

## 10. Regra operacional

Se um agente entrar nesta iniciativa sem ter lido ao menos:

- `README.md`
- `MASTER_PLAN_NATIVE_UX_REVAMP.md`
- `EXEC_SPEC_NATIVE_APP_UX_SPRINT_PLAN.md`

ele esta operando fora do protocolo e deve interromper a execucao antes de modificar codigo.
