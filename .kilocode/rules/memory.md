# KiloCode Agent Rules
## MAIN LONG-TERM LEARNING LOOP (obrigatório)
### 1) No início de um conjunto de tarefas
- Leia o arquivo de memória: `@/.kilocode/rules/memory.md`
- Extraia 3–7 "regras locais"/aprendizados aplicáveis ao trabalho atual (ex.: "nesse repo, X costuma quebrar Y").

### 2) Ao final de **cada** conjunto de tarefas (obrigatório)
Você deve **apendar** (append) uma nova entrada em:
`@/.kilocode/rules/memory.md`

**Nunca sobrescreva** o arquivo. Não edite entradas antigas, exceto se explicitamente solicitado.

#### 2.1) Formato padrão da entrada (copiar e usar sempre)
Adicione ao final do arquivo exatamente neste formato:



## Memory Entry — 2026-02-07 00:34
**Contexto / Objetivo**
- Corrigir campo frequency no ProtocolForm que estava em texto livre e com valores em inglês após implementação de validação Zod

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/schemas/protocolSchema.js` — Traduziu FREQUENCIES de inglês para português e adicionou FREQUENCY_LABELS
  - `src/components/protocol/ProtocolForm.jsx` — Transformou input de texto em dropdown com opções válidas
  - `src/components/onboarding/FirstProtocolStep.jsx` — Atualizou para usar constantes do schema
  - `src/components/protocol/ProtocolCard.jsx` — Adiciona label traduzida na exibição
  - `src/components/protocol/ProtocolForm.test.jsx` — Atualizou testes com novos valores em português

**Verificação**
- Testes/checagens executadas:
  - npm run lint — Passed
  - npm run build — Passed
- Evidência do resultado:
  - Build concluído com sucesso
  - Lint sem erros

**O que deu certo**
- Uso de constantes exportadas do schema para manter consistência entre validação e UI
- Mapeamento label/valor permite exibir texto amigável mantendo valores válidos para o banco
- Verificação de outros componentes que usam frequency identificou todos os pontos de ajuste

**O que não deu certo / riscos**
- Dados existentes no banco com frequência em inglês ('daily', 'alternate', etc.) precisarão de migração
- Protocolos existentes com frequency em inglês podem não renderizar corretamente no dropdown

**Causa raiz (se foi debug)**
- Sintoma: Campo frequency era texto livre com validação Zod que aceitava apenas valores em inglês
- Causa: Schema Zod usava valores em inglês, mas UI usava input livre
- Correção: Tradução para português + dropdown + exportação de labels

**Decisões & trade-offs**
- Decisão: Manter valores em português no banco (diário, dias_alternados, semanal, personalizado, quando_necessário)
- Alternativas consideradas: Manter valores em inglês, usar código numérico
- Por que: Consistência com o resto da aplicação que é em português brasileiro

**Regras locais para o futuro (lições acionáveis)**
- Sempre verificar outros componentes quando uma validação Zod muda
- Exportar labels de enum para uso em componentes UI
- Usar dropdown para campos com valores limitados em vez de texto livre
- Testes unitários devem ser atualizados junto com schemas

**Pendências / próximos passos**
- Criar migração SQL para atualizar frequências existentes no banco de inglês para português
- Verificar se há outros campos no app com o mesmo padrão (texto livre vs validação Zod)
