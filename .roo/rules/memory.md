# Memory - Meus Remédios

Arquivo de memória longa do projeto para aprendizado contínuo.

---

## Memory Entry — 2026-02-11 13:55
**Contexto / Objetivo**
- Implementar FASE 1 da consolidação de componentes: padronizar UX do LogForm entre Dashboard e History
- Tarefa CRÍTICA (P0) que habilita o botão "Plano Completo" na tela History

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/History.jsx` — Adicionado estado `treatmentPlans`, carregamento via `treatmentPlanService.getAll()` e prop para LogForm
- Comportamento impactado:
  - Botão "Plano Completo" agora visível em ambos Dashboard e History
  - Consistência UX entre as duas views para registro de doses

**O que deu certo**
- Seguir exatamente a especificação do `plans/CONSOLIDACAO_COMPONENTES_PLANO.md`
- Usar Promise.all para carregamento paralelo sem impactar performance
- Manter backward compatibility — LogForm já suportava treatmentPlans opcionalmente
- A estrutura do History.jsx já estava bem organizada, facilitando a modificação

**O que não deu certo / riscos**
- Comando `npm run test:related` não existe na versão atual do Vitest (usar `test:critical` ou `test:changed`)
- Testes de snapshot podem falhar se houverem mocks desatualizados (falhas preexistentes em medicineService.test.js)

**Decisões & trade-offs**
- Decisão: Usar `test:critical` ao invés de `test:related`
- Alternativas: `test:changed` para arquivos modificados desde main
- Por que: `test:critical` cobre services, utils, schemas e hooks — suficiente para validar a mudança

**Regras locais para o futuro (lições acionáveis)**
- Sempre verificar scripts disponíveis em `package.json` antes de executar comandos de teste
- O LogForm já suporta bulk registration — passar treatmentPlans ativa automaticamente
- Quando consolidar UX, priorizar a solução que reutiliza props existentes do componente
- History.jsx carrega dados em paralelo via Promise.all — manter esse padrão

**Pendências / próximos passos**
- FASE 2: Consolidar ProtocolSummary (Dashboard) e ProtocolChecklistItem (Protocols)
- FASE 3: Unificar QuickActionsWidget
- FASE 4: Extrair useHealthScore comum
- FASE 5: Consolidar modais de protocolo
- FASE 6: Consolidar utilitários de dose

---

## Memory Entry — 2026-02-11 17:36
**Contexto / Objetivo**
- Corrigir bug crítico: LogForm com modo "Plano Completo" falhava no History.jsx
- Erro: `Invalid input: expected object, received array`

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/History.jsx` — Modificado `handleLogMedicine` para tratar arrays (bulk registration)
- Código adicionado (linha 78-80):
  ```jsx
  } else if (Array.isArray(logData)) {
    await logService.createBulk(logData)
    showSuccess('Plano completo registrado com sucesso! Estoque atualizado.')
  ```

**Causa raiz**
- LogForm retorna um **array** quando type === 'plan' (plano completo)
- History.jsx só tratava objeto único via `logService.create(logData)`
- Dashboard.jsx já tinha a lógica correta: verifica `Array.isArray(data)` e chama `createBulk`

**O que deu certo**
- Copiar o padrão do Dashboard.jsx para History.jsx
- Validação rápida: lint passou, testes críticos passaram
- Backward compatibility mantida — registros únicos continuam funcionando

**Regras locais para o futuro (lições acionáveis)**
- Quando componente pode retornar tipos diferentes (objeto vs array), SEMPRE verificar ambos os casos
- LogForm tem dois modos de retorno: objeto único (protocol) ou array (plan)
- Copiar padrões de tratamento de dados entre views que usam o mesmo componente
- Testar ambos os modos do LogForm: "Único Remédio" e "Plano Completo"

**Validação**
- Lint: ✅ 0 erros
- Testes críticos: ✅ Todos passando
- Build: ✅ Sucesso

---
