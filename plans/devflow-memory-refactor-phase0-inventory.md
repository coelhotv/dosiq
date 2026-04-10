# DEVFLOW Memory Refactor — Fase 0 Inventory

## Status

Fase 0 executada em 2026-04-10.

Objetivo:

- preparar baseline reversível
- sinalizar o refactor em `.agent/state.json`
- inventariar a superfície da memória DEVFLOW
- registrar referências legadas para saneamento futuro

## Baseline Criada

Snapshot local criado em:

- `.agent/snapshots/devflow-memory-refactor-2026-04-10/`

Arquivos salvos:

- `.agent/snapshots/devflow-memory-refactor-2026-04-10/state.json`
- `.agent/snapshots/devflow-memory-refactor-2026-04-10/rules.json`
- `.agent/snapshots/devflow-memory-refactor-2026-04-10/anti-patterns.json`
- `.agent/snapshots/devflow-memory-refactor-2026-04-10/knowledge.json`

## Estado Operacional

`.agent/state.json` foi atualizado para deixar explícito:

- refactor ativo: `devflow-memory-refactor`
- fase atual: `0`
- status: `in-progress`
- observação operacional para outros agentes:
  evitar alterações em `.agent/memory/*` fora do escopo deste refactor sem revisão explícita

## Inventário da Memória Atual

Arquivos índice:

- `.agent/memory/rules.json`
- `.agent/memory/anti-patterns.json`
- `.agent/memory/knowledge.json`
- `.agent/memory/decisions.json`
- `.agent/memory/contracts.json`

Diretórios detail:

- `.agent/memory/rules_detail/`
- `.agent/memory/anti-patterns_detail/`
- `.agent/memory/knowledge_detail/`
- `.agent/memory/decisions_detail/`
- `.agent/memory/contracts_detail/`

Journals:

- `.agent/memory/journal/`
- `.agent/memory/journal/archive/`

## Achados de Preparação

### Referências legadas encontradas

Há referências operacionais ou históricas a:

- `.memory/rules.md`
- `.memory/anti-patterns.md`
- `knowledge.md`

Pontos relevantes para Fase 1:

- `.agent/memory/rules_detail/R-065.md`
- `.agent/memory/rules.json`
- `.agent/memory/knowledge.json`
- `.agent/memory/knowledge_detail/K-056.md`

Observação:

Boa parte das ocorrências de `knowledge.md` é metadado de origem histórica e não necessariamente bloqueia o refactor. O foco inicial da Fase 1 deve ficar nas referências operacionais que ainda influenciam bootstrap e delegação.

### Integridade a revisar na Fase 1

- alinhamento semântico entre índice e `rules_detail/`
- `related_rule` inválido em `anti-patterns.json`
- entradas malformadas em APs específicos
- ausência de `rules_detail/R-157.md`

## Critério de Conclusão da Fase 0

- baseline reversível criada
- plano macro documentado em `plans/devflow-memory-refactor.md`
- inventário de Fase 0 documentado
- `state.json` sinalizando o refactor em andamento

## Próxima Fase

Fase 1 — Saneamento estrutural:

- corrigir inconsistências de índice/detail
- corrigir `related_rule` inválidos
- remover dependências operacionais do legado `.memory/*.md`
