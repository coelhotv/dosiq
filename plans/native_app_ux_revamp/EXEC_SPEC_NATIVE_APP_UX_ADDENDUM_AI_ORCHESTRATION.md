# Exec Spec Addendum: Native App UX AI Orchestration

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/PLANO_EXECUCAO_HIBRIDO.md`
> **Objetivo:** transformar o budget semanal limitado de tokens em regra operacional para execucao da iniciativa

---

## 1. Premissa de orçamento semanal limitado

Esta iniciativa assume que ChatGPT, Claude e Gemini operam com limites reais de contexto e consumo semanal. Portanto:

- os sprints precisam caber em sessoes finitas
- a documentacao precisa reduzir reload de contexto
- handoffs precisam ser formais

---

## 2. Modelo balanceado de orquestracao

### ChatGPT

Papel principal:

- analise de produto
- refinamento de PRD
- decomposicao de escopo
- revisao de especificacao

### Claude

Papel principal:

- execucao via `/devflow`
- implementacao
- specs operacionais e atualizacao de docs

### Gemini

Papel principal:

- review tecnico
- finding pass
- critica estrutural
- validacao de riscos e regressao

Regra:

- os tres podem opinar, mas cada sprint deve saber quem e o executor principal

---

## 3. Responsabilidades por agente

| Agente | Responsabilidade principal |
|--------|----------------------------|
| ChatGPT | framing, produto, refinamento, leitura critica |
| Claude | execucao, alteracao de codigo, fechamento operacional |
| Gemini | revisao, apontamento de riscos, confirmacao arquitetural |

---

## 4. Budget estimado por tipo de sessao

| Tipo de sessao | Tokens estimados |
|----------------|------------------|
| Bootstrap `/devflow` + indices | 20K-30K |
| Leitura da spec principal | 6K-15K |
| Leitura de 1-2 addendums | 4K-12K |
| Leitura do codigo em escopo | 20K-50K |
| Implementacao/revisao | 25K-60K |
| Total recomendado por sessao | 75K-165K |

---

## 5. Budget por sprint

| Sprint | Budget recomendado | Justificativa |
|--------|--------------------|---------------|
| UX.1 | Baixo | docs e baseline |
| UX.2 | Medio | fundacao reutilizavel |
| UX.3 | Medio | 1 tela principal |
| UX.4 | Medio | 1 tela principal |
| UX.5 | Medio | 1 tela principal |
| UX.6 | Medio | 1 tela principal |
| UX.7 | Baixo/Medio | slots e flags |
| UX.8 | Medio | fechamento transversal |

---

## 6. Budget de contingencia

Se o sprint exceder o budget:

1. congelar o que ja esta claramente fechado
2. mover o restante para sprint `.1` complementar
3. registrar o recorte no handoff

Exemplos:

- `UX.4` vira `UX.4` + `UX.4.1`
- `UX.8` vira `UX.8` + `UX.8h`

---

## 7. Criterios para quebrar sprint

Quebrar sprint quando houver:

- mais de uma tela principal
- mais de um addendum especializado obrigatorio
- dependencia de validacao humana no meio da implementacao
- risco alto de contexto estourado

---

## 8. Regras de contexto minimo por sessao

Cada sessao deve carregar apenas:

- `README.md`
- secao do sprint atual
- 1 spec principal
- no maximo 2 addendums
- arquivos de codigo em escopo

Proibido:

- reler toda a pasta sem necessidade
- carregar specs de sprints futuros

---

## 9. Handoff templates

### Handoff ChatGPT -> Claude

```md
## Handoff Produto -> Execucao
- Sprint alvo:
- Requisito chave:
- Riscos percebidos:
- Decisoes congeladas:
- Addendums a carregar:
```

### Handoff Claude -> Gemini

```md
## Handoff Execucao -> Review
- Escopo implementado:
- Arquivos em foco:
- Riscos para review:
- Casos a verificar:
```

### Handoff Gemini -> Claude

```md
## Handoff Review -> Ajustes
- Findings:
- Severidade:
- Arquivos afetados:
- Recomendacao objetiva:
```

---

## 10. Protocolo de reentrada apos interrupcao

1. ler `README.md`
2. checar `EXEC_SPEC_NATIVE_APP_UX_SPRINT_PLAN.md`
3. identificar ultimo sprint ativo
4. ler apenas docs do sprint
5. retomar pelo handoff mais recente

---

## 11. Quando usar revisao cruzada vs seguir direto

### Revisao cruzada recomendada

- fundacao visual
- mudanca de arquitetura de tela
- introducao de monetizacao

### Seguir direto aceitavel

- ajustes pequenos de copy
- tuning de espacamento ja previsto
- pequenas extensoes de componentes base sem controversia

---

## 12. Regras obrigatorias congeladas

1. 1 sprint = 1 sessao principal de execucao
2. no maximo 1 spec principal + 2 addendums por sessao
3. nenhum agente reabre toda a pasta sem necessidade
4. toda sessao termina com checklist de handoff e proximos passos

---

## 13. Checklist de encerramento de sessao

- [ ] sprint alvo registrado
- [ ] docs lidos listados
- [ ] limites do que ficou de fora anotados
- [ ] riscos pendentes anotados
- [ ] proximo agente sabe exatamente por onde retomar
