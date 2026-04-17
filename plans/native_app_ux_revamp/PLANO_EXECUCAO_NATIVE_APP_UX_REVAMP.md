# Plano de Execucao: Native App UX Revamp

> **Status:** Plano operacional de cadencia semanal
> **Base obrigatoria:** `plans/native_app_ux_revamp/EXEC_SPEC_NATIVE_APP_UX_SPRINT_PLAN.md`
> **Objetivo:** orientar a execucao real e cadenciada do revamp UX dentro do budget semanal de IA disponivel

---

## 1. Ritmo de execucao semanal

Estado atual da iniciativa:

- `UX.1` concluido
- proxima wave operacional recomendada: `UX.2 - Fundacao visual e tokens`

Modelo congelado por semana:

1. 1 sprint principal de implementacao
2. 1 passada curta de review cruzado
3. 1 janela de ajuste/fechamento

Regra:

- nao iniciar o sprint seguinte antes de fechar o handoff e registrar o status do sprint atual

---

## 2. Combinacao entre codigo e review

### Janela A. Preparacao

- leitura da secao do sprint
- abertura do mock local correspondente, quando o sprint for de tela
- carregamento minimo de docs
- `/devflow coding`

### Janela B. Execucao

- implementacao do escopo do sprint
- validacao automatizada minima

### Janela C. Revisao curta

- review cruzado ou finding pass
- consolidacao do que entra e do que fica para follow-up

### Janela D. Fechamento

- checklist de handoff
- update de status
- registro para reentrada

---

## 3. Politica de pause/resume

Se a semana acabar no meio do sprint:

1. congelar o que esta pronto
2. registrar o restante como sub-sprint
3. nao abrir novo escopo competitivo

Exemplo:

- `UX.4` termina em 70% -> vira `UX.4.1` na semana seguinte

---

## 4. Semana modelo com budget limitado

### Dia/janela 1

- bootstrap
- leitura de docs
- leitura do asset visual local do sprint
- inicio do sprint

### Dia/janela 2

- implementacao principal

### Dia/janela 3

- testes
- validacao visual
- review cruzado

### Dia/janela 4

- ajustes
- documentacao do handoff

---

## 5. Definicao de "done" semanal

Uma semana conta como concluida quando:

- o sprint alvo tem escopo claramente fechado
- validacoes minimas foram executadas
- proximo passo esta documentado
- nao resta dependencia silenciosa nao registrada

---

## 6. Backlog de contingencia

Itens tipicos que podem ser deslocados se o budget apertar:

- micro-ajustes de copy
- refinamentos finos de espacamento
- variantes nao essenciais de componentes
- snapshots adicionais

Itens que nao devem ser deslocados:

- contrato principal da tela
- CTA principal
- estados de erro/loading
- compatibilidade com navegacao

---

## 7. Protocolo quando um sprint nao cabe na janela semanal

1. identificar o menor corte executavel
2. encerrar a parte concluida com handoff formal
3. abrir sub-sprint complementar
4. nao inflar o sprint original retroativamente

---

## 8. Cadencia recomendada por wave

| Wave | Cadencia sugerida |
|------|-------------------|
| UX.1 | 1 semana curta |
| UX.2 | 1 semana cheia |
| UX.3 | 1 semana cheia |
| UX.4 | 1 semana cheia |
| UX.5 | 1 semana cheia |
| UX.6 | 1 semana cheia |
| UX.7 | 1 semana curta ou media |
| UX.8 | 1 semana cheia |

---

## 9. Dependencias humanas na cadencia

Pontos que exigem maintainer:

- validacao visual manual
- decisao sobre provider real de ads
- aprovacao de merges
- eventual definicao de funcionalidades aspiracionais em `Perfil`

Se o maintainer nao estiver disponivel:

- o agente pode fechar o sprint tecnicamente
- o sprint nao e considerado operacionalmente encerrado sem a validacao prevista

---

## 10. Regra de sequenciamento

Sequencia correta:

1. docs
2. fundacao
3. telas
4. monetizacao foundation
5. hardening

Sequencia proibida:

1. monetizacao primeiro
2. varias telas em paralelo sem fundacao
3. hardening antes de os contratos se estabilizarem

---

## 11. Sinalizacao de risco semanal

Ao fim de cada semana, registrar:

- o que foi concluido
- o que ficou pendente
- o que virou risco
- o que precisa de decisao humana

---

## 12. Criterio de saude da iniciativa

A iniciativa esta saudavel quando:

- cada sprint cabe no budget
- os handoffs sao curtos e suficientes
- nao ha releitura macica desnecessaria
- a experiencia melhora sem gerar caos de implementacao
