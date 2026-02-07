# KiloCode Agent Rules

## BEGIN OF RULES

## MAIN LONG-TERM LEARNING LOOP (obrigatório)

### 1) No início de um conjunto de tarefas
- Leia o arquivo de memória: `@/.kilocode/rules/memory.md`
- Extraia 3–7 “regras locais”/aprendizados aplicáveis ao trabalho atual (ex.: “nesse repo, X costuma quebrar Y”).

### 2) Ao final de **cada** conjunto de tarefas (obrigatório)
Você deve **apendar** (append) uma nova entrada em:
`@/.kilocode/rules/memory.md`

**Nunca sobrescreva** o arquivo. Não edite entradas antigas, exceto se explicitamente solicitado.

#### 2.1) Formato padrão da entrada (copiar e usar sempre)
Adicione ao final do arquivo exatamente neste formato:

## Memory Entry — YYYY-MM-DD HH:MM
**Contexto / Objetivo**
- (1–3 bullets do que foi pedido e o resultado esperado)

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `path/to/file.ext` — (resumo)
- Comportamento impactado:
  - (bullet)

**Verificação**
- Testes/checagens executadas:
  - (ex.: unit, integration, build, lint, repro steps)
- Evidência do resultado:
  - (saídas, critérios atendidos, observações)

**O que deu certo**
- (2–5 bullets: técnicas, abordagens, decisões que funcionaram)

**O que não deu certo / riscos**
- (2–5 bullets: dead ends, falhas, pontos de atenção, dívidas)

**Causa raiz (se foi debug)**
- Sintoma:
- Causa:
- Correção:
- Prevenção:

**Decisões & trade-offs**
- Decisão:
- Alternativas consideradas:
- Por que:

**Regras locais para o futuro (lições acionáveis)**
- (3–7 bullets curtos, no estilo “Se X, então Y”)

**Pendências / próximos passos**
- (bullets objetivos, com prioridade se possível)

### 3) O que NÃO vai para a memória
- Segredos/credenciais.
- Texto longo redundante.
- Discussões irrelevantes para o futuro do projeto.
- Opiniões vagas sem ação (“foi difícil”).

> If anything is uncertain, explicitly state assumptions and propose the safest next step.

## END OF RULES

---

# NEW MEMORIES

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

---

## Memory Entry — 2026-02-07 01:45
**Contexto / Objetivo**
- Identificar e traduzir outros termos em inglês nos schemas Zod além do frequency
- Corrigir MEDICINE_TYPES e WEEKDAY que também estavam em inglês

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/schemas/medicineSchema.js` — Traduziu MEDICINE_TYPES para português
  - `src/components/medicine/MedicineForm.jsx` — Atualizou para usar constantes exportadas
  - `src/components/medicine/MedicineCard.jsx` — Corrigiu verificação de tipo
  - `src/components/onboarding/FirstMedicineStep.jsx` — Atualizou opções do dropdown
  - `src/views/Medicines.jsx` — Corrigiu filtro de tipo
  - `src/components/protocol/ProtocolForm.jsx` — Corrigiu verificação de medicine.type
  - `src/schemas/protocolSchema.js` — Traduziu WEEKDAYS para português
  - `.migrations/20260207_migrate_medicine_type_to_portuguese.sql` — Migration SQL criada

**Verificação**
- Testes/checagens executadas:
  - npm run build — Passed
- Evidência do resultado:
  - Build concluído com sucesso

**O que deu certo**
- Varredura completa de todos os schemas identificou termos em inglês não óbvios
- WEEKDAYS estava definido mas não em uso, agora traduzido para uso futuro
- Criação de migration SQL resolve dados existentes no banco

**O que não deu certo / riscos**
- Constante MEDICINE_TYPES não estava exportada inicialmente (erro de build)
- Correção rápida: adicionou export na declaração

**Decisões & trade-offs**
- Decisão: Traduzir todos os enums do Zod para português
- Alternativas consideradas: Manter código original em inglês para internacionalização
- Por que: Consistência com idioma do app e experiência do usuário em PT-BR

**Regras locais para o futuro (lições acionáveis)**
- Sempre fazer grep por termos em inglês (monday, tuesday, medicine, supplement) ao traduzir schemas
- Verificar se constantes estão exportadas antes de usar em componentes
- Criar migrations SQL para cada enum traduzido antes de alterar código frontend
- Manter Labels mapeados para exibição amigável

**Pendências / próximos passos**
- Verificar se há outras constantes em inglês em outros arquivos do projeto

---

## Memory Entry — 2026-02-07 02:40
**Contexto / Objetivo**
- Corrigir comportamento do botão ADIAR no smart alert de atraso de doses
- O botão não respondia ao clique, não suprimindo o alerta nem pulando a dose

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/Dashboard.jsx` — Adicionou estado `snoozedAlertIds` e handler para ADIAR
  - `src/hooks/__tests__/useCachedQuery.test 2.jsx` — Corrigiu lint errors (catch vazio)
- Comportamento impactado:
  - Botão ADIAR agora suprime o alerta de dose atrasada da lista
  - Alerta é filtrado da UI ao clicar em ADIAR

**Verificação**
- Testes/checagens executadas:
  - npm run lint — Passed
  - npm run build — Passed
- Evidência do resultado:
  - Build concluído com sucesso
  - Lint sem erros

**O que deu certo**
- Uso de Set para rastrear IDs de alertas silenciados (performático)
- Filtro no useMemo de smartAlerts para excluir alertas silenciados
- Handler simples que apenas suprime o alerta (sem criar registro no banco)

**O que não deu certo / riscos**
- Solução é local/session-based - alerta pode reaparecer em novo refresh da página
- Não há persistência do "adiar" no banco de dados

**Causa raiz (se foi debug)**
- Sintoma: Botão ADIAR não fazia nada ao clicar
- Causa: Handler `onAction` em Dashboard.jsx não tratava `action.label === 'ADIAR'`
- Correção: Adicionado handler que adiciona alert.id ao Set de silenciados

**Decisões & trade-offs**
- Decisão: Usar solução local com estado React (Set) ao invés de criar registro no banco
- Alternativas consideradas: Criar campo status/skipped na tabela medicine_logs
- Por quê: Solução mais simples e imediata; impacto mínimo no schema do banco

**Regras locais para o futuro (lições acionáveis)**
- Sempre verificar todos os action labels no handler de SmartAlerts
- Usar Set para tracking de IDs é mais performático que Array.includes
- Catch vazio (`catch {}`) é aceito pelo lint, variável não é necessária

**Pendências / próximos passos**
- Considerar persistência de alertas silenciados no banco (opcional)
- Adicionar teste unitário para o handler de ADIAR
