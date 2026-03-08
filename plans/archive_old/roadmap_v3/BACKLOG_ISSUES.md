# Backlog de Issues

> Última atualização: 2026-02-17

## Visão Geral

Este documento lista todas as issues de backlog criadas durante o desenvolvimento do bot Telegram, organizadas por prioridade e categoria.

---

## Issues Abertas

### Prioridade Alta

| Issue | Título | Labels | Criada em |
|-------|--------|--------|-----------|
| [#46](https://github.com/accoelho/meus-remedios/issues/46) | Auditar JSDoc de todo o projeto | - | 2026-02-17 |

### Prioridade Média

| Issue | Título | Labels | Criada em |
|-------|--------|--------|-----------|
| [#33](https://github.com/accoelho/meus-remedios/issues/33) | Traduzir JSDoc de escapeMarkdownV2 | - | 2026-02-17 |
| [#34](https://github.com/accoelho/meus-remedios/issues/34) | Otimizar escapeMarkdownV2 com regex única | - | 2026-02-17 |
| [#39](https://github.com/accoelho/meus-remedios/issues/39) | Refatorar testes para it.each | - | 2026-02-17 |
| [#43](https://github.com/accoelho/meus-remedios/issues/43) | Usar escapeMarkdownV2 em tasks.js | - | 2026-02-17 |
| [#45](https://github.com/accoelho/meus-remedios/issues/45) | Traduzir JSDoc de formatStockStatus e formatProtocol | - | 2026-02-17 |

---

## Detalhes das Issues

### Issue #33: Traduzir JSDoc de escapeMarkdownV2 para português
- **PR de origem:** #32
- **Estimativa:** 5 minutos
- **Arquivo:** `server/utils/markdownUtils.js`
- **Descrição:** Traduzir comentários JSDoc da função `escapeMarkdownV2()` de inglês para português.

### Issue #34: Otimizar escapeMarkdownV2 com regex única
- **PR de origem:** #32
- **Estimativa:** 10 minutos
- **Arquivo:** `server/utils/markdownUtils.js`
- **Descrição:** Substituir múltiplos `.replace()` por uma única regex com callback para melhor performance.

### Issue #39: Refatorar testes para testes parametrizados (it.each)
- **PR de origem:** #36
- **Estimativa:** 30 minutos
- **Arquivo:** `server/utils/__tests__/markdownUtils.test.js`
- **Descrição:** Reorganizar testes de caracteres reservados usando padrão `it.each()` para melhor manutenibilidade e legibilidade.

### Issue #43: Usar escapeMarkdownV2 em tasks.js linha 112
- **PR de origem:** #42
- **Estimativa:** 15 minutos
- **Arquivo:** `server/bot/tasks.js`
- **Descrição:** Aplicar função `escapeMarkdownV2()` na linha 112 do arquivo tasks.js para garantir escape correto de caracteres especiais.

### Issue #45: Traduzir JSDoc de formatStockStatus e formatProtocol
- **PR de origem:** #44
- **Estimativa:** 5 minutos
- **Arquivo:** `server/utils/formatters.js`
- **Descrição:** Traduzir comentários JSDoc das funções `formatStockStatus()` e `formatProtocol()` de inglês para português.

### Issue #46: Auditar JSDoc de todo o projeto
- **PR de origem:** #44
- **Estimativa:** 1-2 horas
- **Escopo:** Todo o projeto
- **Descrição:** Verificar todos os arquivos do projeto para garantir que JSDoc está em português. Criar lista de arquivos que precisam de correção.

---

## Issues Fechadas

(Nenhuma issue fechada ainda)

---

## Notas

- **Issues de documentação (#33, #45, #46)** são de baixo risco e podem ser feitas a qualquer momento
- **Issues de refactoring (#34, #39, #43)** requerem testes de regressão após implementação
- **Recomendação:** Fazer Issue #46 após as issues #33 e #45 serem resolvidas para evitar retrabalho
- **Padrão de JSDoc em português:**
  ```javascript
  /**
   * Descrição da função em português.
   * @param {tipo} nome - Descrição do parâmetro.
   * @returns {tipo} Descrição do retorno.
   */
  ```

---

## Histórico de Atualizações

| Data | Ação |
|------|------|
| 2026-02-17 | Documento criado com 6 issues abertas |
