# DEVFLOW Memory Refactor — Fase 2 Report

## Status

Fase 2 concluída em 2026-04-10.

Escopo da fase:

- reclassificação de `rules` em `hot / warm / cold`
- reclassificação de `anti-patterns` em `hot / warm / cold`
- criação de `packs` contextuais para suporte ao bootstrap seletivo
- marcação de APs absorvíveis pela regra-mãe via `derived_from`
- preparação do terreno para a mudança do bootstrap do `/devflow`

## Entregas Realizadas

### 1. `rules.json` enriquecido com metadados de carregamento

Cada regra agora possui:

- `layer`
- `pack`
- `bootstrap_default`

Critério aplicado:

- `hot`: guardrails universais e recorrentes
- `warm`: regras contextuais, mas ainda operacionalmente úteis
- `cold`: regras específicas, históricas, de campanha ou de baixa recorrência

Distribuição final em `.agent/memory/rules.json`:

- `hot`: 24
- `warm`: 57
- `cold`: 26

### 2. `anti-patterns.json` enriquecido com metadados de carregamento

Cada anti-pattern agora possui:

- `layer`
- `pack`
- `bootstrap_default`

Além disso, APs derivados de regras-mãe receberam:

- `derived_from`

Distribuição final em `.agent/memory/anti-patterns.json`:

- `hot`: 12
- `warm`: 62
- `cold`: 23
- `derived_from`: 20 APs

### 3. Packs contextuais formalizados

Os índices agora suportam carregamento por grupos lógicos:

- `file-integrity`
- `review-validation`
- `date-time`
- `test-hygiene`
- `schema-data`
- `react-hooks`
- `infra-api`
- `adherence-reporting-mobile`
- `telegram`
- `design-ui`
- `process-hygiene`

### 4. Bootstrap quente preparado

O subconjunto `bootstrap_default = true` foi reduzido para:

- 24 regras core
- 12 anti-patterns core

Isso preserva a intenção da proposta original da Fase 2 sem apagar conhecimento do índice. O corte efetivo no bootstrap fica pronto para a Fase 3, quando a lógica da skill passar a respeitar `layer` e `pack`.

## Validações Executadas

### Integridade de packs

Resultado:

- nenhuma regra sem `pack`
- nenhum anti-pattern sem `pack`

### Integridade do bootstrap

Resultado:

- 24 regras com `bootstrap_default = true`
- 12 anti-patterns com `bootstrap_default = true`
- nenhuma divergência entre `layer = hot` e `bootstrap_default = true`

### Cobertura de absorção por regra-mãe

Resultado:

- 20 APs marcados com `derived_from`

## Estado Final da Fase 2

Ao final da fase:

- a memória já distingue o que é `hot`, `warm` e `cold`
- os packs contextuais já existem no índice
- o bootstrap novo pode ser implementado sem reclassificar novamente a base

## Próxima Fase Recomendada

Fase 3 — Adaptar o bootstrap do `/devflow`:

- carregar `layer = hot` por padrão
- expandir para `warm` por `goal`, `tags`, `applies_to` e arquivos em escopo
- deixar `cold` fora do bootstrap normal
- atualizar a documentação operacional para refletir o novo fluxo
