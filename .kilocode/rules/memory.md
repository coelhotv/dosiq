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

---

## Memory Entry — 2026-02-07 05:00
**Contexto / Objetivo**
- Documentar mapeamento completo dos botões de CTA (Call to Action) no Dashboard
- Smart Alerts, QuickActionsWidget e Footer Actions

**O que foi feito (mudanças)**
- Arquivos consultados:
  - `src/views/Dashboard.jsx` — SmartAlerts e handler onAction
  - `src/components/dashboard/QuickActionsWidget.jsx` — Ações rápidas
  - `src/components/dashboard/SmartAlerts.jsx` — Componente de alertas

**Smart Alerts CTAs**
| Alerta | Botão | Função |
|--------|-------|--------|
| Dose Atrasada | TOMAR (primary) | Abre modal de registro pré-preenchido com protocol_id |
| Dose Atrasada | ADIAR (secondary) | Silencia o alerta (snoozedAlertIds Set) |
| Estoque Zerado/Baixo | COMPRAR (primary) | Alert simulado (将来: link externo/lista compras) |
| Estoque Zerado/Baixo | ESTOQUE (secondary) | Navega para página de estoque com medicineId |

**QuickActionsWidget CTAs**
| Botão | Função |
|-------|--------|
| 💊 Registrar Dose | Abre formulário de registro de dose |
| 📦 Adicionar Estoque | Navega para tela de adicionar estoque |
| 📊 Ver Histórico | Navega para histórico completo |
| → Ver todos os protocolos | Link para lista de protocolos |

**Footer Actions**
| Botão | Função |
|-------|--------|
| + REGISTRO MANUAL | Abre modal sem dados pré-preenchidos |

**Estrutura do Handler onAction**
```javascript
onAction((alert, action) => {
  if (action.label === 'TOMAR') { /* abre modal com prefillData */ }
  if (action.label === 'COMPRAR') { /* alert simulado */ }
  if (action.label === 'ESTOQUE') { /* onNavigate('stock') */ }
  if (action.label === 'ADIAR') { /* setSnoozedAlertIds */ }
})
```

**Regras locais para o futuro (lições acionáveis)**
- Sempre verificar handler onAction quando adicionar novos action labels
- Usar Set para tracking de IDs é mais performático que Array.includes
- QuickActionsWidget é usado em Dashboard.jsx e passed via props
- SmartAlerts recebe alerts array e onAction callback

**Pendências / próximos passos**
- Integrar COMPRAR com lista de compras real ou link externo
- Adicionar persistência de snoozedAlertIds no banco (opcional)
- Padronizar nomenclatura de botões (primary/secondary types)

---

## Memory Entry — 2026-02-07 05:08
**Contexto / Objetivo**
- Corrigir problema de scroll na tela de detalhes do Health Score em dispositivos mobile
- Conteúdo era cortado pelo BottomNav fixo e menu de rodapé

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/components/ui/Modal.css` — Ajustes de max-height e padding para mobile
  - `src/components/dashboard/HealthScoreDetails.css` — Adicionado padding-bottom para scroll completo
- Comportamento impactado:
  - Modal agora tem max-height de 85vh em mobile
  - Padding-bottom adicional permite scroll até o final do conteúdo
- Estrutura do Handler onAction

**O que deu certo**
- Ajuste de max-height para 85vh evita sobreposição do BottomNav
- Padding-bottom no modal-body permite scroll completo
- Alinhamento do modal ao bottom em mobile via CSS

**O que não deu certo / riscos**
- Solução depende de valor fixo (85vh, 60px) que pode variar conforme dispositivo

**Causa raiz (se foi debug)**
- Sintoma: Conteúdo cortado no final do modal em mobile
- Causa: max-height: 100vh não considerava espaço do BottomNav fixo
- Correção: Redução para 85vh + padding-bottom adicional
- Prevenção: Sempre considerar elementos fixos (BottomNav) ao definir max-height em modais mobile

**Decisões & trade-offs**
- Decisão: Usar valores fixos (85vh, padding-bottom) ao invés de CSS calc() dinâmico
- Alternativas consideradas: Usar env(safe-area-inset-bottom) para dispositivos modernos
- Por quê: Maior compatibilidade com dispositivos mais antigos

**Regras locais para o futuro (lições acionáveis)**
- Em modais mobile, sempre considerar espaço de BottomNav fixo
- Usar max-height < 100vh quando houver elementos fixos na tela
- Adicionar padding-bottom adequado para permitir scroll completo
- Testar scroll até o final do conteúdo em dispositivos reais

**Pendências / próximos passos**
- Testar em dispositivos reais para validar ajustes
- Considerar usar env() para dynamic viewport units em browsers modernos

---

## Memory Entry — 2026-02-07 05:20
**Contexto / Objetivo**
- Corrigir ReferenceError no Dashboard: Cannot access 'snoozedAlertIds' before initialization
- O dashboard não carregava, tela ficava vazia

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/Dashboard.jsx` — Moveu estado `snoozedAlertIds` para antes do useMemo que o utiliza
- Comportamento impactado:
  - Dashboard agora carrega normalmente
  - Error de TDZ (Temporal Dead Zone) resolvido

**O que deu certo**
- Reorganização da ordem de declarações no componente
- Declaração de estados sempre antes de useMemo/useEffect que os utilizam

**Causa raiz (se foi debug)**
- Sintoma: Dashboard não carregava, ReferenceError no console
- Causa: `snoozedAlertIds` era declarado após o useMemo que o utiliza (TDZ)
- Correção: Moveu declaração do estado para antes do useMemo
- Prevenção: Sempre declarar estados antes de hooks que os utilizam

**Regras locais para o futuro (lições acionáveis)**
- Estados devem ser declarados antes de useMemo/useEffect que os utilizam
- Em React, ordem de declarações importa para evitar TDZ
- Criar ordem lógica: states -> useMemo -> useEffects -> handlers

---

## Memory Entry — 2026-02-07 06:32
**Contexto / Objetivo**
- Reordenar elementos do Dashboard conforme solicitação do usuário
- Nova ordem: Header → SmartAlerts → Widgets → Tratamento → Próximas Doses
- Adicionar seção "Próximas doses" com as próximas 5 doses ordenadas por hora

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/Dashboard.jsx` — Reorganizada ordem do JSX e adicionado useMemo nextDoses
  - `src/views/Dashboard.css` — Adicionados estilos para .next-doses-section
- Comportamento impactado:
  - Dashboard agora exibe: Header → SmartAlerts → DashboardWidgets → Tratamento → Próximas Doses
  - Seção "Próximas doses" mostra as próximas 5 doses ordenadas por horário
  - Título alterado de "CRONOGRAMA DE HOJE" para "TRATAMENTO"

**O que deu certo**
- Reorganização do JSX mantendo mesma estrutura de TreatmentAccordion
- nextDoses useMemo calcula doses futuras considerando janela de 2h
- CSS adiciona estilos consistentes com o design existente

**O que não deu certo / riscos**
- Erro inicial de lint: `currentMinutes` não estava definido
- Correção: Adicionada declaração `const currentMinutes = now.getHours() * 60 + now.getMinutes()`

**Causa raiz (se foi debug)**
- Sintoma: Lint falhava com "'currentMinutes' is not defined"
- Causa: Variável era usada mas não declarada no componente
- Correção: Adicionada declaração junto com snoozedAlertIds

**Decisões & trade-offs**
- Decisão: Manter lógica de nextDoses similar à smartAlerts existente
- Alternativas: Criar hook separado, usar contexto compartilhado
- Por quê: Manter consistência com código existente

**Regras locais para o futuro (lições acionáveis)**
- Sempre declarar variáveis antes de usá-las em useMemo/useEffect
- Verificar lint antes de fazer commit
- Manter consistência com padrões existentes do código

**Pendências / próximos passos**
- Testar em ambiente de desenvolvimento para validar comportamento
- Ajustar estilos CSS se necessário para mobile

---

## Memory Entry — 2026-02-07 06:57
**Contexto / Objetivo**
- Refinar estrutura do Dashboard conforme feedback do usuário
- Substituir DashboardWidgets por QuickActionsWidget (apenas 3 ações)
- Dividir seção de tratamento em duas partes
- Ajustar títulos: PLANOS DE TRATAMENTO → TRATAMENTO, ÚLTIMAS → PRÓXIMAS

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/Dashboard.jsx` — Substituído DashboardWidgets por QuickActionsWidget
  - `src/views/Dashboard.jsx` — Dividido treatment-section em treatment-plans-section e treatment-standalone-section
  - `src/views/Dashboard.css` — Atualizados estilos para novas seções
  - `src/views/Dashboard.jsx` — Removido useMemo nextDoses não utilizado
  - `src/views/Dashboard.jsx` — Removida variável currentMinutes não utilizada
- Comportamento impactado:
  - QuickActionsWidget agora mostra apenas 3 ações (Registrar Dose, Adicionar Estoque, Ver Histórico)
  - Tratamento dividido em: TRATAMENTO (acordeons) + PRÓXIMAS (swipe items)

**O que deu certo**
- QuickActionsWidget já tinha estrutura com 3 ações + footer link
- Reutilização de componente existente sem criar novo
- Divisão clara entre planos e protocolos avulsos

**O que não deu certo / riscos**
- Erro de lint: variável nextDoses não utilizada após remoção da seção separada
- Correção: Removido useMemo completo

**Causa raiz (se foi debug)**
- Sintoma: Lint falhava com "'nextDoses' is assigned a value but never used"
- Causa: useMemo calculava doses mas UI agora usa protocolos avulsos diretamente
- Correção: Removido useMemo e variáveis não utilizadas (currentMinutes)

**Decisões & trade-offs**
- Decisão: Manter QuickActionsWidget existente ao invés de criar novo componente
- Alternativas: Criar componente ActionsBar menor
- Por quê: QuickActionsWidget já tem 3 ações,只需 ocultar footer link

**Regras locais para o futuro (lições acionáveis)**
- Verificar uso de variáveis antes de remover código
- Usar lint antes de commit para evitar erros
- Reutilizar componentes existentes quando possível

**Pendências / próximos passos**
- Validar em ambiente de desenvolvimento

---

## Memory Entry — 2026-02-07 07:06
**Contexto / Objetivo**
- QuickActionsWidget não estava trazendo valor conforme testes
- Remover o componente QuickActionsWidget do dashboard
- Nova estrutura: Header → SmartAlerts → Tratamento → PRÓXIMAS → Footer

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/Dashboard.jsx` — Removido import e uso de QuickActionsWidget
  - Mantido useMemo para treatmentPlans e smartAlerts (ainda em uso)
- Comportamento impactado:
  - Dashboard agora tem ordem: Header → SmartAlerts → TRATAMENTO → PRÓXIMAS → Footer

**O que deu certo**
- Remoção simples e direta do componente
- Mantidos os hooks necessários (useMemo) que ainda são usados

**Regras locais para o futuro (lições acionáveis)**
- Testar componentes antes de considerar definitivos
- Remover código não utilizado para manter código limpo
- Verificar dependências antes de remover imports

---

## Memory Entry — 2026-02-07 12:00
**Contexto / Objetivo**
- Auditoria técnica completa do bot do Telegram inoperante há mais de 3 dias
- Identificar causa raiz da falha e propor correções específicas
- Analisar conformidade com padrões de código definidos em docs/PADROES_CODIGO.md

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/services/sessionManager.js` — Removida importação de MOCK_USER_ID não existente
  - `server/services/sessionManager.js` — Implementada obtenção dinâmica de userId via getUserIdByChatId
  - `plans/AUDITORIA_BOT_TELEGRAM.md` — Relatório completo de auditoria técnica criado
- Comportamento impactado:
  - Bot agora inicia corretamente sem erro de SyntaxError
  - Sessões são associadas ao userId correto (suporte a múltiplos usuários)
  - Se usuário não estiver vinculado, sessão fica apenas em cache local

**O que deu certo**
- Análise sistemática de logs da Vercel identificou erro exato
- Correção simples e direta resolveu o problema crítico
- Implementação alinhada com objetivo do refactoring (remover MOCK_USER_ID)
- Tratamento de erro adequado para usuários não vinculados

**O que não deu certo / riscos**
- Refactoring incompleto: server/index.js não usa BotFactory, HealthCheck nem Logger estruturado
- Imports dinâmicos em api/notify.js podem falhar em produção
- Documentação desatualizada menciona server/bot/index.js que não existe

**Causa raiz (se foi debug)**
- Sintoma: Bot não iniciava em produção, SyntaxError nos logs da Vercel
- Causa: sessionManager.js tentava importar MOCK_USER_ID de supabase.js, mas essa constante não existia
- Correção: Removida importação de MOCK_USER_ID e implementada obtenção dinâmica de userId via getUserIdByChatId
- Prevenção: Sempre verificar se constantes exportadas existem antes de importar

**Decisões & trade-offs**
- Decisão: Implementar obtenção dinâmica de userId em setSession em vez de passar como parâmetro
- Alternativas consideradas: Adicionar userId como parâmetro obrigatório em todas as chamadas de setSession
- Por que: Solução mais simples e backward compatible, não exige mudanças em todos os arquivos que chamam setSession

**Regras locais para o futuro (lições acionáveis)**
- Sempre verificar logs de produção da Vercel ao diagnosticar falhas
- Verificar se constantes exportadas existem antes de importar
- Remover referências a MOCK_USER_ID hardcoded em todo o código
- Usar getUserIdByChatId para obter userId dinamicamente em contexto de bot
- Implementar validação de imports antes de fazer deploy

**Pendências / próximos passos**
- Fazer deploy das correções para produção
- Monitorar logs da Vercel por 24-48 horas após deploy
- Testar comandos básicos (/start, /status, /hoje) após deploy
- Considerar implementar BotFactory em server/index.js (melhoria opcional)
- Atualizar documentação para refletir realidade

---

## Memory Entry — 2026-02-07 15:40
**Contexto / Objetivo**
- Atualizar documentações do projeto para incluir informações sobre Vercel CLI
- Documentar comandos úteis para debugs e acesso aos logs
- Adicionar informações sobre CLI da Vercel na memória e PADROES_CODIGO.md

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `.kilocode/rules/memory.md` — Adicionada entrada sobre Vercel CLI
  - `docs/PADROES_CODIGO.md` — Adicionada seção de comandos úteis da Vercel CLI
- Comportamento impactado:
  - Documentação agora inclui comandos para acessar logs da Vercel
  - Equipe tem referência rápida para debugs em produção

**O que deu certo**
- Documentação atualizada com comandos práticos da Vercel CLI
- Incluídos exemplos de uso para diferentes cenários
- Organização clara dos comandos por categoria

**O que não deu certo / riscos**
- Nenhum risco identificado nesta atualização

**Decisões & trade-offs**
- Decisão: Adicionar seção específica de Vercel CLI em PADROES_CODIGO.md
- Alternativas consideradas: Criar documento separado, adicionar em README.md
- Por que: PADROES_CODIGO.md é o documento central de padrões do projeto

**Regras locais para o futuro (lições acionáveis)**
- Usar `vercel logs --follow` para monitorar logs em tempo real
- Usar `vercel logs --filter="api/notify"` para filtrar logs de função específica
- Usar `vercel logs -n 100` para ver as últimas N linhas
- Usar `vercel --prod` para fazer deploy para produção
- Usar `vercel login` para autenticar na CLI da Vercel
- Usar `vercel link` para vincular projeto local ao projeto da Vercel

**Pendências / próximos passos**
- Monitorar logs da Vercel após o deploy automático
- Validar funcionamento do bot após deploy
- Testar comandos básicos (/start, /status, /hoje)
- Verificar se notificações estão sendo enviadas corretamente do código
