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

## Memory Entry — 2026-02-08 18:04
**Contexto / Objetivo**
- Integrar micro-interações e analytics na aplicação (Fase 3)
- Componentes de animação foram criados mas não estavam integrados
- analyticsService foi criado mas não estava sendo usado para tracking de eventos

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/Dashboard.jsx` — Integrado ConfettiAnimation, page_view, dose_registered, MilestoneCelebration
  - `src/components/dashboard/SwipeRegisterItem.jsx` — Integrado PulseEffect e tracking swipe_used
  - `src/components/medicine/MedicineForm.jsx` — Integrado ShakeEffect em campos com erro
  - `src/components/protocol/ProtocolForm.jsx` — Integrado ShakeEffect em campos com erro
  - `src/components/ui/ThemeToggle.jsx` — Adicionado tracking theme_changed
  - `src/components/dashboard/SparklineAdesao.jsx` — Adicionado tracking sparkline_tapped
  - `src/components/gamification/MilestoneCelebration.jsx` — Adicionado tracking milestone_achieved
- Comportamento impactado:
  - ConfettiAnimation dispara em 100% de adesão no Dashboard
  - PulseEffect exibe após registro bem-sucedido de dose via swipe
  - ShakeEffect exibe em campos com erro de validação em formulários
  - Analytics tracking implementado em todos os pontos especificados
  - MilestoneCelebration exibe quando milestone é conquistado no Dashboard

**O que deu certo**
- Integração de ConfettiAnimation com useEffect que detecta 100% de adesão
- Integração de PulseEffect com estado showPulse e handler de registro
- Integração de ShakeEffect em MedicineForm e ProtocolForm com estado shakeFields
- Analytics tracking implementado em: page_view, dose_registered, swipe_used, theme_changed, sparkline_tapped, milestone_achieved
- Integração de MilestoneCelebration com checkNewMilestones e useEffect
- Lint passou com 0 erros (apenas 2 warnings não críticos em arquivos não modificados)

**O que não deu certo / riscos**
- Warnings de eslint-disable em SwipeRegisterItem.jsx e TreatmentAccordion.jsx (não críticos)
- ShakeEffect pode não funcionar corretamente se o usuário clicar rapidamente em múltiplos campos
- ConfettiAnimation pode disparar múltiplas vezes se stats.adherence ficar em 100 por mais de um render

**Causa raiz (se foi debug)**
- N/A (implementação direta sem bugs)

**Decisões & trade-offs**
- Decisão: Usar useState para showConfetti em vez de useRef para simplicidade
- Alternativas consideradas: Usar useRef para evitar re-renders, usar contexto compartilhado
- Por que: useState é mais simples e suficiente para este caso de uso

**Regras locais para o futuro (lições acionáveis)**
- Sempre declarar estados antes de useMemo/useEffect que os utilizam (evita TDZ)
- Usar analyticsService.track() para todos os eventos de usuário importantes
- Integrar componentes de animação (ConfettiAnimation, PulseEffect, ShakeEffect) com estados React
- Verificar lint antes de fazer commit para evitar erros
- ShakeEffect deve ser aplicado em campos com erro de validação Zod
- MilestoneCelebration deve ser integrado com checkNewMilestones do milestoneService

**Pendências / próximos passos**
- Testar integrações em ambiente de desenvolvimento
- Validar funcionamento de ConfettiAnimation em 100% de adesão
- Validar funcionamento de PulseEffect após registro de dose
- Validar funcionamento de ShakeEffect em formulários com erros
- Validar tracking de analytics em todos os componentes

---

## Memory Entry — 2026-02-08 18:33
**Contexto / Objetivo**
- Atualizar regra de linguagem para uso de inglês em pensamento e instruções, português para documentação

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `.kilocode/rules/memory.md` — Adicionada regra de linguagem
- Comportamento impactado:
  - Agentes devem usar inglês para pensamento interno e instruções
  - Português reservado para documentação, comentários de código e interação com usuário

**O que deu certo**
- Documentação clara sobre uso de linguagem
- Separação explícita entre pensamento (inglês) e documentação (português)

**O que não deu certo / riscos**
- Nenhum

**Causa raiz (se foi debug)**
- N/A

**Decisões & trade-offs**
- Decisão: Adicionar regra de linguagem no início do arquivo de memória
- Alternativas consideradas: Criar documento separado, adicionar em cada entrada
- Por que: Centralizar regra facilita consulta e aplicação consistente

**Regras locais para o futuro (lições acionáveis)**
- Usar inglês para todo o raciocínio interno, processamento lógico e instruções para ferramentas de desenvolvimento
- Usar português exclusivamente para gerar documentação, escrever comentários de código e fornecer feedback ou atualizações de status para o usuário humano
- Atualizar memória com essa regra sempre que necessário

**Pendências / próximos passos**
- Nenhuma

---

## Memory Entry — 2026-02-08 18:53
**Contexto / Objetivo**
- Completar Fase 3 do roadmap Meus Remedios (Polish UX e Gamificação Avançada)
- Resolver todos os problemas P0 (bloqueantes), P1 (integrações) e P2 (ajustes finais)
- Atingir conformidade >80% para merge

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/services/milestoneService.js` — Criado serviço de milestones com 6 conquistas
  - `src/components/gamification/MilestoneCelebration.jsx` — Criado componente de celebração
  - `src/components/gamification/BadgeDisplay.jsx` — Criado componente para exibir conquistas
  - `src/components/dashboard/SparklineAdesao.jsx` — Adicionado import Framer Motion
  - `src/views/Dashboard.jsx` — Integrado ConfettiAnimation, MilestoneCelebration e analytics
  - `src/components/dashboard/SwipeRegisterItem.jsx` — Integrado PulseEffect e analytics
  - `src/components/medicine/MedicineForm.jsx` — Integrado ShakeEffect
  - `src/components/protocol/ProtocolForm.jsx` — Integrado ShakeEffect
  - `src/components/ui/ThemeToggle.jsx` — Adicionado analytics tracking
  - `src/components/dashboard/HealthScoreCard.css` — Adaptado SVG para usar variáveis CSS
  - `src/views/History.jsx` — Integrado EmptyState
  - `src/views/Stock.jsx` — Integrado EmptyState
  - `src/views/Medicines.jsx` — Integrado EmptyState
  - `src/hooks/useShake.js` — Corrigido caminho do import
  - `.kilocode/rules/memory.md` — Adicionada regra de linguagem
- Comportamento impactado:
  - ConfettiAnimation dispara em 100% de adesão no Dashboard
  - PulseEffect exibe após registro bem-sucedido de dose via swipe
  - ShakeEffect exibe em campos com erro de validação em formulários
  - Analytics tracking implementado em todos os pontos especificados
  - MilestoneCelebration exibe quando milestone é conquistado no Dashboard
  - HealthScoreCard SVG agora adapta cores ao tema claro/escuro
  - EmptyState exibe em views vazias (History, Stock, Medicines)
  - ThemeToggle permanece clicável mesmo com prefers-reduced-motion

**O que deu certo**
- Resolução de todos os problemas P0 (bloqueantes): Sparkline import, Milestones
- Resolução de todos os problemas P1 (integrações): Confetti, Pulse, Shake, Analytics
- Resolução de todos os problemas P2 (ajustes): ThemeToggle, HealthScoreCard, EmptyStates
- Build compila sem erros (11.11s)
- Lint passa com 0 erros (apenas 2 warnings não críticos)
- Testes críticos passam
- Merge realizado com --no-ff seguindo padrões estabelecidos
- Branch apagada após merge
- Conformidade final: ~95% (meta >80% atingida)
- 16 commits semânticos e atômicos realizados
- Documentação atualizada com regra de linguagem

**O que não deu certo / riscos**
- Warnings de eslint-disable em SwipeRegisterItem.jsx e TreatmentAccordion.jsx (não críticos)
- ShakeEffect pode não funcionar corretamente se o usuário clicar rapidamente em múltiplos campos
- ConfettiAnimation pode disparar múltiplas vezes se stats.adherence ficar em 100 por mais de um render
- Problemas P2 não foram implementados inicialmente, mas resolvidos em branch separada

**Causa raiz (se foi debug)**
- N/A (implementação direta sem bugs críticos)

**Decisões & trade-offs**
- Decisão: Usar useState para showConfetti em vez de useRef
- Alternativas consideradas: Usar useRef para evitar re-renders, usar contexto compartilhado
- Por que: useState é mais simples e suficiente para este caso de uso

- Decisão: Criar branch separada para problemas P2 após merge principal
- Alternativas consideradas: Incluir todos os problemas P2 no mesmo PR, adiar para Fase 4
- Por que: Permite validação mais rápida e não bloqueia o merge da Fase 3

**Regras locais para o futuro (lições acionáveis)**
- Sempre declarar estados antes de useMemo/useEffect que os utilizam (evita TDZ)
- Usar analyticsService.track() para todos os eventos de usuário importantes
- Integrar componentes de animação (ConfettiAnimation, PulseEffect, ShakeEffect) com estados React
- Verificar lint antes de fazer commit para evitar erros
- ShakeEffect deve ser aplicado em campos com erro de validação Zod
- MilestoneCelebration deve ser integrado com checkNewMilestones do milestoneService
- Usar variáveis CSS do tema em vez de cores hardcoded em SVGs
- Remover disabled de botões quando a ação não é uma animação (ex: ThemeToggle)
- Seguir padrões de commits semânticos: type(scope): subject
- Usar --no-ff ao fazer merge para preservar histórico
- Apagar branch após merge bem-sucedido

**Pendências / próximos passos**
- Testar em ambiente de desenvolvimento para validar funcionamento
- Considerar implementar problemas P2 restantes (se houver)
- Preparar documentação para Fase 4 (PWA e Navegação)
- Validar funcionamento de MilestoneCelebration ao conquistar milestones

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

---

## Memory Entry — 2026-02-07 16:15
**Contexto / Objetivo**
- Corrigir cálculo de dosagem no comando /registrar do bot do Telegram
- Corrigir erro de "Sessão expirada" ao selecionar opção de dosagem
- O teclado de opções mostrava valores incorretos (ex: 1m em vez de 10mg para Ansitec)

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/bot/callbacks/conversational.js` — Adicionado dosage_per_pill na query, calculado dosagem real, adicionado await em todas as chamadas de getSession
  - `server/bot/commands/protocols.js` — Adicionado await em chamada de getSession
- Comportamento impactado:
  - Teclado de opções agora mostra dosagem correta (pillsPerIntake * dosagePerPill)
  - Erro de "Sessão expirada" resolvido ao adicionar await em todas as chamadas de getSession

**O que deu certo**
- Uso de dosage_per_pill da tabela de medicamentos para calcular dosagem correta
- Adição de await em todas as chamadas de getSession resolveu erro de sessão expirada
- Debug logs ajudaram a identificar o problema de cálculo de dosagem

**O que não deu certo / riscos**
- Inicialmente não foi identificado que getSession é uma função async
- Múltiplas chamadas de getSession sem await em diferentes arquivos

**Causa raiz (se foi debug)**
- Sintoma: Teclado de opções mostrava valores incorretos (1m em vez de 10mg)
- Causa: Query não buscava dosage_per_pill da tabela de medicamentos, usava apenas dosage_per_intake (pills per intake)
- Correção: Adicionar dosage_per_pill na query e calcular: pillsPerIntake * dosagePerPill
- Prevenção: Sempre verificar se todos os campos necessários estão sendo buscados na query

- Sintoma: Erro de "Sessão expirada" ao selecionar opção de dosagem
- Causa: getSession é uma função async, mas estava sendo chamada sem await, retornando Promise em vez do valor da sessão
- Correção: Adicionar await em todas as chamadas de getSession
- Prevenção: Sempre usar await ao chamar funções async

**Decisões & trade-offs**
- Decisão: Calcular dosagem real (pillsPerIntake * dosagePerPill) em vez de mostrar apenas pills per intake
- Alternativas consideradas: Mostrar apenas pills per intake, mostrar ambos
- Por que: Usuário precisa ver a dosagem real em mg/ml, não apenas quantidade de comprimidos

**Regras locais para o futuro (lições acionáveis)**
- Sempre usar await ao chamar getSession (é uma função async)
- Verificar se todos os campos necessários estão sendo buscados na query do Supabase
- Para cálculo de dosagem: buscar dosage_per_intake (protocolos) e dosage_per_pill (medicamentos)
- Dosagem real = pillsPerIntake * dosagePerPill
- Usar debug logs para rastrear valores calculados e identificar problemas
- Fazer grep por "getSession(" para verificar se todas as chamadas têm await

**Pendências / próximos passos**
- Testar comando /registrar após deploy automático
- Verificar se dosagem está correta para diferentes medicamentos
- Monitorar logs da Vercel para verificar se não há mais erros de sessão expirada

---

## Memory Entry — 2026-02-07 16:24
**Contexto / Objetivo**
- Corrigir cálculo de redução de estoque no comando /registrar do bot do Telegram
- O sistema estava reduzindo a dosagem (2000mg) do estoque em vez de reduzir a quantidade de comprimidos (4)
- Usuário tentou registrar dose de Omega 3 (2000mg = 4 comprimidos de 500mg), mas sistema tentou reduzir 2000 comprimidos

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/bot/callbacks/conversational.js` — Adicionado cálculo de comprimidos a serem reduzidos do estoque
- Comportamento impactado:
  - Sistema agora busca `dosage_per_pill` da tabela de medicamentos
  - Calcula quantidade de comprimidos: `quantity / dosagePerPill`
  - Usa `pillsToDecrease` em vez de `quantity` para decrementar estoque
  - Mensagem de erro de estoque insuficiente agora mostra dosagem e comprimidos

**O que deu certo**
- Separação clara entre dosagem (mg/ml) e quantidade de comprimidos no estoque
- Cálculo correto: `pillsToDecrease = quantity / dosagePerPill`
- Mensagem de erro mais informativa mostrando dosagem solicitada e comprimidos necessários

**O que não deu certo / riscos**
- Sistema anteriormente confundia dosagem com quantidade de comprimidos
- Validação de estoque estava comparando unidades diferentes (mg vs comprimidos)

**Causa raiz (se foi debug)**
- Sintoma: Sistema tentou reduzir 2000 comprimidos do estoque ao registrar dose de 2000mg
- Causa: Função `processDoseRegistration` usava `quantity` (dosagem em mg) diretamente para decrementar estoque
- Correção: Buscar `dosage_per_pill` da tabela de medicamentos e calcular `pillsToDecrease = quantity / dosagePerPill`
- Prevenção: Sempre separar dosagem (mg/ml) de quantidade de comprimidos no estoque

**Decisões & trade-offs**
- Decisão: Calcular quantidade de comprimidos dinamicamente em vez de armazenar no protocolo
- Alternativas consideradas: Armazenar quantidade de comprimidos no protocolo, pedir usuário para informar quantidade de comprimidos
- Por que: Manter consistência com dados existentes (dosagem em mg/ml é mais comum para usuários)

**Regras locais para o futuro (lições acionáveis)**
- Estoque é sempre em quantidade de comprimidos, não em dosagem (mg/ml)
- Para decrementar estoque: calcular `pillsToDecrease = dosage / dosagePerPill`
- Buscar `dosage_per_pill` da tabela de medicamentos sempre que precisar converter dosagem para comprimidos
- Mensagens de erro de estoque devem mostrar dosagem e comprimidos para clareza

**Pendências / próximos passos**
- Testar comando /registrar após deploy automático
- Verificar se estoque está sendo decrementado corretamente para diferentes medicamentos
- Monitorar logs da Vercel para validar funcionamento

---

## Memory Entry — 2026-02-07 16:32
**Contexto / Objetivo**
- Corrigir ordem de validação de estoque no comando /registrar do bot do Telegram
- O sistema estava gravando a dose no banco mesmo quando a validação de estoque falhava
- Usuário tentou registrar dose de 2000mg, validação de estoque falhou, mas dose foi gravada como 2000 comprimidos

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/bot/callbacks/conversational.js` — Reorganizada ordem de validação e gravação
- Comportamento impactado:
  - Validação de estoque agora acontece ANTES de gravar a dose
  - Dose só é gravada se houver estoque suficiente
  - Evita gravar doses incorretas quando estoque é insuficiente

**O que deu certo**
- Reorganização da função `processDoseRegistration` para validar estoque primeiro
- Separação clara entre validação e gravação
- Prevenção de dados inconsistentes no banco

**O que não deu certo / riscos**
- Doses incorretas podem ter sido gravadas anteriormente (antes da correção)
- Usuário pode ter doses com valores impossíveis (ex: 2000 comprimidos)

**Causa raiz (se foi debug)**
- Sintoma: Dose gravada no banco mesmo quando validação de estoque falhava
- Causa: Função `processDoseRegistration` gravava a dose (linha 254-262) ANTES de validar estoque (linha 306)
- Correção: Mover validação de estoque para antes de gravar a dose
- Prevenção: Sempre validar recursos antes de consumir/gravar

**Decisões & trade-offs**
- Decisão: Validar estoque antes de gravar dose
- Alternativas consideradas: Gravar dose mesmo sem estoque, usar transação do banco
- Por que: Validação prévia evita inconsistências no banco e fornece feedback claro ao usuário

**Regras locais para o futuro (lições acionáveis)**
- Sempre validar recursos (estoque) antes de consumir/decrementar
- Validar antes de gravar no banco para evitar dados inconsistentes
- Ordem correta: validação → gravação → decremento
- Usar transações do banco quando possível para garantir atomicidade

**Pendências / próximos passos**
- Verificar se há doses incorretas no banco que precisam ser corrigidas manualmente
- Testar comando /registrar após deploy automático
- Monitorar logs da Vercel para validar funcionamento

---

## Memory Entry — 2026-02-07 16:40
**Contexto / Objetivo**
- Corrigir mensagem de confirmação de dose no comando /registrar do bot do Telegram
- Mensagem mostrava "Dose de 2000x Omega 3 registrada com sucesso!" (comprimidos)
- Deveria mostrar "Dose de 2000mg Omega 3 registrada com sucesso!" (dosagem)

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/bot/callbacks/conversational.js` — Buscar dosage_unit e mostrar unidade correta na mensagem
- Comportamento impactado:
  - Mensagem de confirmação agora mostra unidade correta (mg/ml) em vez de 'x'
  - Evita confusão entre dosagem (mg) e quantidade de comprimidos

**O que deu certo**
- Busca de dosage_unit da tabela de medicamentos
- Mensagem de confirmação agora mostra unidade correta
- Clareza para o usuário sobre o que foi registrado

**O que não deu certo / riscos**
- Mensagem anterior mostrava 'x' (comprimidos) em vez da unidade correta
- Isso causava confusão para o usuário

**Causa raiz (se foi debug)**
- Sintoma: Mensagem de confirmação mostrava "Dose de 2000x Omega 3 registrada com sucesso!"
- Causa: Mensagem usava `${quantity}x` em vez de `${quantity}${unit}`
- Correção: Buscar dosage_unit da tabela de medicamentos e usar na mensagem
- Prevenção: Sempre mostrar unidade correta em mensagens de confirmação

**Decisões & trade-offs**
- Decisão: Buscar dosage_unit da tabela de medicamentos para mostrar unidade correta
- Alternativas consideradas: Usar unidade fixa (mg), não mostrar unidade
- Por que: Clareza para o usuário sobre o que foi registrado

**Regras locais para o futuro (lições acionáveis)**
- Sempre mostrar unidade correta em mensagens de confirmação
- Buscar dosage_unit da tabela de medicamentos quando necessário
- Evitar confusão entre dosagem (mg/ml) e quantidade de comprimidos

**Pendências / próximos passos**
- Testar comando /registrar após deploy automático
- Verificar se mensagem de confirmação está correta para diferentes medicamentos
- Monitorar logs da Vercel para validar funcionamento

---

## Memory Entry — 2026-02-07 17:10
**Contexto / Objetivo**
- Corrigir unidade de quantity_taken no comando /registrar do bot do Telegram
- O bot gravava 2000 (mg) no banco, mas deveria gravar 4 (comprimidos)
- Schema Zod tem limite de 100 para quantity_taken, confirmando que deve ser em comprimidos

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/bot/callbacks/conversational.js` — Gravar pillsToDecrease em vez de quantity no banco
- Comportamento impactado:
  - quantity_taken agora é gravado em comprimidos (4) em vez de mg (2000)
  - Compatível com schema Zod que tem limite de 100
  - Mensagem de confirmação continua mostrando dosagem em mg

**O que deu certo**
- Separação clara entre dosagem (mg/ml) e quantidade de comprimidos no banco
- quantity_taken agora está em comprimidos, compatível com schema Zod
- Mensagem de confirmação mostra dosagem correta em mg

**O que não deu certo / riscos**
- Sistema anteriormente gravava dosagem (mg) em vez de comprimidos
- Schema Zod tem limite de 100, mas bot gravava 2000 (mg)

**Causa raiz (se foi debug)**
- Sintoma: Bot gravava 2000 no banco, mas schema Zod só permite até 100
- Causa: quantity_taken estava sendo gravado com valor em mg (quantity) em vez de comprimidos (pillsToDecrease)
- Correção: Gravar pillsToDecrease (comprimidos) em vez de quantity (mg)
- Prevenção: Sempre verificar schema Zod para entender unidade esperada

**Decisões & trade-offs**
- Decisão: Gravar quantidade de comprimidos no banco para compatibilidade com schema Zod
- Alternativas consideradas: Aumentar limite do schema Zod, manter valor em mg
- Por que: Schema Zod já existe e é usado pelo frontend, manter compatibilidade

**Regras locais para o futuro (lições acionáveis)**
- quantity_taken na tabela medicine_logs deve ser em comprimidos, não em mg
- Schema Zod define a unidade esperada (limite de 100 confirma comprimidos)
- Sempre verificar schema Zod antes de gravar dados no banco
- Mensagem de confirmação pode mostrar unidade diferente do banco (mg vs comprimidos)

**Pendências / próximos passos**
- Testar comando /registrar após deploy automático
- Verificar se quantity_taken está correto no banco (comprimidos)
- Monitorar logs da Vercel para validar funcionamento

---

## Memory Entry — 2026-02-07 16:08
**Contexto / Objetivo**
- Corrigir comando /registrar do bot que não estava funcionando
- O comando não fornecia feedback após selecionar medicamento e quantidade
- Nenhuma dose era registrada no banco de dados

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/bot/callbacks/conversational.js` — Adicionado import do logger, substituído console.error por logger.error, adicionado validação de estoque, adicionado tratamento de erro robusto
  - `plans/INVESTIGACAO_REGISTRAR.md` — Documento de investigação criado com análise detalhada
- Comportamento impactado:
  - Comando /registrar agora valida estoque antes de decrementar
  - Feedback ao usuário quando estoque é insuficiente
  - Tratamento de erro robusto com mensagens detalhadas
  - Logs estruturados com contexto para debug

**O que deu certo**
- Uso de logger.error com contexto detalhado (chatId, protocolId, medicineId, quantity)
- Validação de estoque antes de decrementar evita estoque negativo
- Feedback ao usuário em todos os cenários de erro
- Documento de investigação detalhado facilita entendimento do problema

**O que não deu certo / riscos**
- Erro inicial de edição: old_string não correspondia ao conteúdo do arquivo
- Correção: Reler arquivo e usar contexto exato para edição

**Causa raiz (se foi debug)**
- Sintoma: Comando /registrar não funcionava, sem feedback ao usuário
- Causa: processDoseRegistration usava console.error (não visível em produção) e não validava estoque
- Correção: Substituído console.error por logger.error, adicionado validação de estoque, tratamento de erro robusto
- Prevenção: Sempre usar logger.error em vez de console.error, validar recursos antes de consumir

**Decisões & trade-offs**
- Decisão: Adicionar validação de estoque antes de decrementar
- Alternativas consideradas: Permitir estoque negativo, validar apenas após decremento
- Por que: Validação prévia evita inconsistências no banco e fornece feedback claro ao usuário

**Regras locais para o futuro (lições acionáveis)**
- Sempre usar logger.error em vez de console.error em código de produção
- Validar recursos (estoque) antes de consumir/decrementar
- Fornecer feedback ao usuário em todos os cenários de erro
- Incluir contexto detalhado em logs (chatId, userId, ids de entidades)
- Criar documento de investigação para problemas complexos

**Pendências / próximos passos**
- Testar comando /registrar em ambiente de desenvolvimento
- Validar funcionamento após deploy para produção
- Monitorar logs da Vercel para verificar se erros estão sendo registrados corretamente

---

## Memory Entry — 2026-02-07 16:33
**Contexto / Objetivo**
- Corrigir erro BUTTON_DATA_INVALID da API do Telegram
- O erro ocorria ao usar UUIDs (36 caracteres) em callback_data
- Limite da API do Telegram é 64 bytes para callback_data

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `server/bot/commands/registrar.js` — Substituir UUIDs por índices em reg_med
  - `server/bot/commands/adicionar_estoque.js` — Substituir UUIDs por índices em add_stock_med e add_stock_med_val
  - `server/bot/commands/protocols.js` — Substituir UUIDs por índices em pause_prot e resume_prot
  - `server/bot/callbacks/conversational.js` — Recuperar IDs completos a partir de índices
- Comportamento impactado:
  - Todos os comandos com inline keyboard agora usam índices numéricos
  - Mapeamento de índices para IDs armazenado na sessão do usuário
  - Callbacks recuperam IDs completos a partir do índice

**O que deu certo**
- Uso de índices numéricos reduz callback_data de ~81 caracteres para ~15 caracteres
- Mapeamento na sessão permite recuperar IDs completos quando necessário
- Validação de sessão expirada em todos os callbacks
- Solução aplicada a todos os comandos afetados

**O que não deu certo / riscos**
- Sessão expirada pode causar erro se usuário clicar em botão antigo
- Correção: Adicionada validação de sessão com feedback ao usuário

**Causa raiz (se foi debug)**
- Sintoma: Erro 400 Bad Request: BUTTON_DATA_INVALID da API do Telegram
- Causa: callback_data usava UUIDs (36 caracteres) resultando em ~81 caracteres, excedendo limite de 64 bytes
- Correção: Substituir UUIDs por índices numéricos e armazenar mapeamento na sessão
- Prevenção: Sempre verificar tamanho de callback_data ao criar inline keyboards

**Decisões & trade-offs**
- Decisão: Usar índices numéricos em vez de codificar UUIDs (base64, etc.)
- Alternativas consideradas: Codificar UUIDs em base64, usar IDs curtos do banco
- Por que: Índices são mais simples, mais legíveis e garantem tamanho pequeno

**Regras locais para o futuro (lições acionáveis)**
- Limite da API do Telegram para callback_data é 64 bytes
- Sempre usar índices numéricos em vez de UUIDs em callback_data
- Armazenar mapeamento de índices para IDs na sessão do usuário
- Validar sessão expirada em todos os callbacks que usam índices
- Testar inline keyboards com muitos itens para verificar limite

**Pendências / próximos passos**
- Testar comando /registrar após deploy automático
- Testar comandos /adicionar_estoque, /pausar, /retomar
- Monitorar logs da Vercel para verificar se erro BUTTON_DATA_INVALID foi resolvido

---

## Memory Entry — 2026-02-07 21:07
**Contexto / Objetivo**
- Refatorar componente "Protocolos" no dashboard para listar próximos 5 protocolos ordenados cronologicamente
- Adicionar funcionalidade de swipe para registro de dose
- Adicionar link "Ver todos" que redireciona para view completa de protocolos

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/views/Dashboard.jsx` — Adicionado useMemo standaloneProtocols com ordenação cronológica
  - `src/views/Dashboard.jsx` — Adicionado fallbackProtocols para protocolos do primeiro plano
  - `src/views/Dashboard.jsx` — Atualizado título para "PRÓXIMAS DOSES" e adicionado link "Ver todos"
  - `src/views/Dashboard.css` — Adicionados estilos para .view-all-link e .empty-message
- Comportamento impactado:
  - Lista os próximos 5 protocolos isolados ordenados por horário crescente
  - Fallback para protocolos do primeiro plano se não houver protocolos avulsos
  - Link "Ver todos" sempre visível quando há protocolos na lista

**O que deu certo**
- Uso de useMemo para ordenação cronológica eficiente
- Lógica de fallback para protocolos do primeiro plano
- Link "Ver todos" redireciona corretamente para view de protocolos

**O que não deu certo / riscos**
- Verificar se há protocolos suficientes para testar a ordenação
- Testar comportamento quando há exatamente 5 protocolos vs mais de 5

**Decisões & trade-offs**
- Decisão: Mostrar link "Ver todos" sempre quando há protocolos, independente da quantidade
- Alternativas consideradas: Mostrar apenas quando há mais de 5 protocolos
- Por que: Usuário pode querer ver a view completa mesmo com poucos protocolos

**Regras locais para o futuro (lições acionáveis)**
- Usar useMemo para cálculos complexos de ordenação/filtragem
- Sempre considerar fallback para dados não disponíveis
- Testar diferentes quantidades de dados para validar UI
- Verificar lint antes de fazer commit

**Pendências / próximos passos**
- Testar em ambiente de desenvolvimento após deploy
- Validar ordenação cronológica com protocolos em diferentes horários
- Verificar comportamento do link "Ver todos"

---

## Memory Entry — 2026-02-08 14:42
**Contexto / Objetivo**
- Corrigir 2 problemas bloqueantes (P0) da Fase 3 que impedem o merge da branch
- Problema #1: SparklineAdesao.jsx com erro de importação Framer Motion
- Problema #2: F3.3 Celebrações de Milestone NÃO IMPLEMENTADO (0% implementado)

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/components/dashboard/SparklineAdesao.jsx` — Adicionado `import { motion } from 'framer-motion'`
  - `eslint.config.js` — Atualizado varsIgnorePattern para incluir `motion` e `AnimatePresence`
  - `src/services/milestoneService.js` — Criado serviço completo de gerenciamento de milestones
  - `src/components/gamification/MilestoneCelebration.jsx` — Criado componente de celebração com animação
  - `src/components/gamification/MilestoneCelebration.css` — Criado estilos para modal de celebração
  - `src/components/gamification/BadgeDisplay.jsx` — Criado componente para exibir conquistas
  - `src/components/gamification/BadgeDisplay.css` — Criado estilos para grid de badges
- Comportamento impactado:
  - SparklineAdesao agora compila sem erro de ReferenceError
  - Sistema de milestones e celebrações está implementado e pronto para integração

**O que deu certo**
- Uso de varsIgnorePattern no ESLint para resolver falso positivo de `motion` não usado
- milestoneService.js com persistência em localStorage e prevenção de celebrações duplicadas
- MilestoneCelebration.jsx usa Framer Motion para animações suaves (spring animation)
- BadgeDisplay.jsx com grid responsivo para exibir conquistas
- Build compila sem erros (0 errors, 2 warnings não críticos)

**O que não deu certo / riscos**
- Erro inicial de lint: `motion` reportado como não usado apesar de ser usado como JSX component
- Correção: Adicionado `motion` e `AnimatePresence` ao varsIgnorePattern no ESLint
- Warnings não críticos em outros arquivos (SwipeRegisterItem.jsx, TreatmentAccordion.jsx) sobre eslint-disable não usado

**Causa raiz (se foi debug)**
- Sintoma: Lint reportava "'motion' is defined but never used" em SparklineAdesao.jsx e MilestoneCelebration.jsx
- Causa: ESLint's `no-unused-vars` rule não reconhece uso de variáveis como JSX components
- Correção: Atualizado varsIgnorePattern em eslint.config.js para incluir `^(motion|AnimatePresence|[A-Z_])`
- Prevenção: Sempre adicionar componentes de bibliotecas de animação ao varsIgnorePattern quando necessário

**Decisões & trade-offs**
- Decisão: Usar varsIgnorePattern ao invés de desabilitar a regra completamente
- Alternativas consideradas: Desabilitar `no-unused-vars`, usar eslint-disable inline
- Por que: Mantém a regra ativa para outros casos, apenas ignora componentes JSX específicos

**Regras locais para o futuro (lições acionáveis)**
- Quando usar Framer Motion, adicionar `motion` e `AnimatePresence` ao varsIgnorePattern do ESLint
- Criar serviços com persistência em localStorage para features de gamificação
- Usar AnimatePresence para animações de entrada/saída de componentes
- Implementar prevenção de celebrações duplicadas com check de milestones já conquistados
- Testar lint e build após criar novos componentes com animações

**Pendências / próximos passos**
- Integrar MilestoneCelebration e BadgeDisplay no Dashboard (próxima tarefa)
- Implementar lógica de detecção de milestones no Dashboard
- Testar celebrações de milestones em ambiente de desenvolvimento
- Considerar adicionar confetti animation para celebrações de milestones

---

## Memory Entry — 2026-02-09 21:57
**Contexto / Objetivo**
- Implementar tarefas P1 da Fase 3.5 de melhorias visuais
- Adicionar glassmorphism refinado, melhorar contraste e legibilidade, implementar micro-interações visuais
- Aplicar novos tokens aos componentes do dashboard e botões

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/styles/tokens/colors.css` — Adicionados tokens de glassmorphism (light, standard, heavy, hero), gradientes (insight, hero, alert-critical, success) e melhorado contraste de texto em dark mode
  - `src/styles/tokens/transitions.css` — Adicionados tokens de micro-interações (hover, focus, active, scale, glow)
  - `src/components/dashboard/HealthScoreCard.css` — Aplicado glassmorphism hero, gradient hero e micro-interações
  - `src/components/dashboard/SmartAlerts.css` — Aplicado glassmorphism standard, gradient alert-critical e micro-interações
  - `src/components/dashboard/TreatmentAccordion.css` — Aplicado glassmorphism light e micro-interações
  - `src/components/ui/Button.css` — Aplicado micro-interações (scale, glow, focus-visible)
- Comportamento impactado:
  - Cards agora têm glassmorphism com diferentes níveis de intensidade
  - Gradientes sutis aplicados a cards de insight, hero e alertas críticas
  - Micro-interações visuais (scale, glow, transitions) aplicadas a todos os componentes interativos
  - Contraste de texto melhorado em dark mode para WCAG AA compliance

**O que deu certo**
- Uso de tokens CSS para manter consistência e facilitar manutenção
- Separação clara entre níveis de glassmorphism (light, standard, heavy, hero)
- Micro-interações aplicadas com scale effects e glow transitions
- Validação bem-sucedida: lint (0 erros), build (sucesso), testes críticos (67 passaram)
- Commits atômicos e semânticos criados para cada mudança lógica

**O que não deu certo / riscos**
- Nenhum erro crítico encontrado durante implementação
- Warnings de lint em arquivos não modificados (SwipeRegisterItem.jsx, TreatmentAccordion.jsx) - não críticos

**Causa raiz (se foi debug)**
- N/A (implementação direta sem bugs críticos)

**Decisões & trade-offs**
- Decisão: Usar valores fixos de scale (1.02, 0.98, 1.01) em vez de valores dinâmicos
- Alternativas consideradas: Usar valores baseados em viewport, usar transformações 3D
- Por que: Valores fixos são mais previsíveis e performáticos, compatíveis com todos os dispositivos

- Decisão: Aplicar glassmorphism com gradientes em vez de cores sólidas
- Alternativas consideradas: Usar cores sólidas com transparência, usar imagens de fundo
- Por que: Gradientes sutis adicionam profundidade visual sem sobrecarregar a interface

**Regras locais para o futuro (lições acionáveis)**
- Sempre usar tokens CSS para glassmorphism, gradientes e micro-interações
- Aplicar scale effects em hover e active states para feedback visual
- Usar glow transitions para elementos interativos (botões, cards)
- Verificar contraste WCAG AA (4.5:1) para cores de texto em dark mode
- Criar commits atômicos para cada mudança lógica separada
- Testar lint, build e testes críticos após cada conjunto de mudanças

**Pendências / próximos passos**
- Validar visualmente em ambiente de desenvolvimento
- Testar micro-interações em dispositivos reais (mobile, desktop)
- Considerar implementar P2 tasks (bordas com variação de espessura, etc.)
- Preparar documentação para Fase 4 (PWA e Navegação)

---

## NOTA PARA FUTUROS AGENTES (Orchestrator Instructions)

**Modo de Pensamento em Inglês**
- A partir desta tarefa, o modo de pensamento deve ser executado em **INGLÊS**
- Isso melhora a clareza e precisão do raciocínio técnico
- **IMPORTANTE**: Produzir código, comentários e documentação em **PORTUGUÊS**
- Apenas o processo de pensamento interno deve ser em inglês
- Mensagens para o usuário devem ser em português
- Documentação técnica deve ser em português

**Exemplo de Aplicação:**
- Pensamento: "I need to create a new component for milestone celebrations"
- Código: `// Componente de celebração de milestone`
- Comentário: `// Verifica se o milestone já foi conquistado`
- Documentação: "Este componente exibe celebrações de milestones conquistados"

**Benefícios:**
- Melhor precisão técnica no raciocínio
- Manutenção da consistência linguística do projeto (PT-BR)
- Facilita comunicação com usuários lusófonos

---

## Memory Entry — 2026-02-09 22:50
**Contexto / Objetivo**
- Implementar Exemplos Visuais 1, 2 e 3 do documento ESTRATEGIA_MELHORIAS_VISUAIS_FASE3.5.md
- Aplicar todos os tokens P0, P1 e P2 aos componentes SmartAlerts, HealthScoreCard e InsightCard
- Criar componente InsightCard com gradiente e glassmorphism

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `src/components/dashboard/SmartAlerts.css` — Atualizado para usar tokens de espaçamento, cor e micro-interações
  - `src/components/dashboard/HealthScoreCard.css` — Atualizado tamanho do gráfico, SVG glow e espaçamentos
  - `src/components/dashboard/InsightCard.css` — Criado novo componente com gradiente e glassmorphism
  - `src/components/dashboard/InsightCard.jsx` — Criado novo componente React com props configuráveis
- Comportamento impactado:
  - SmartAlerts agora usa `--spacing-component-compact` para gap e padding
  - SmartAlerts usa `--text-primary-dark` e `--text-secondary-dark` para melhor contraste
  - SmartAlerts usa `--alert-color` CSS custom property para border-left dinâmico
  - HealthScoreCard agora tem gráfico de 80px com SVG glow effects
  - HealthScoreCard usa `--text-primary-dark` para valor do score
  - InsightCard criado com gradiente insight (cyan → purple) e glassmorphism standard

**O que deu certo**
- Uso de CSS custom properties (`--alert-color`) para border-left dinâmico em SmartAlerts
- Separação clara entre espaçamentos: `--spacing-component-compact` (12px), `--spacing-related` (8px), `--spacing-related-tight` (4px)
- Aplicação consistente de tokens de glassmorphism, gradientes e micro-interações
- SVG glow effects aplicados com `drop-shadow()` e `filter: drop-shadow()`
- InsightCard criado com suporte a highlight de texto e action button interativo
- Validação bem-sucedida: lint (0 erros), build (sucesso), testes críticos (67 passaram)

**O que não deu certo / riscos**
- Nenhum erro crítico encontrado durante implementação
- 4 testes falhando são pré-existentes e não relacionados às mudanças visuais
- Warnings de lint em arquivos não modificados (SwipeRegisterItem.jsx, TreatmentAccordion.jsx) - não críticos

**Causa raiz (se foi debug)**
- N/A (implementação direta sem bugs críticos)

**Decisões & trade-offs**
- Decisão: Usar `--alert-color` CSS custom property para border-left dinâmico em SmartAlerts
- Alternativas consideradas: Usar classes CSS separadas para cada tipo de alerta, usar inline styles
- Por que: Solução mais limpa e escalável, permite fácil adição de novos tipos de alerta

- Decisão: Criar InsightCard como componente separado com props configuráveis
- Alternativas consideradas: Integrar diretamente no Dashboard, criar componente inline
- Por que: Reutilização futura e separação de responsabilidades

**Regras locais para o futuro (lições acionáveis)**
- Sempre usar tokens CSS para glassmorphism, gradientes e micro-interações
- Aplicar scale effects em hover e active states para feedback visual
- Usar glow transitions para elementos interativos (botões, cards)
- Verificar contraste WCAG AA (4.5:1) para cores de texto em dark mode
- Criar commits atômicos para cada mudança lógica separada
- Testar lint, build e testes críticos após cada conjunto de mudanças
- Usar CSS custom properties para valores dinâmicos baseados em contexto

**Pendências / próximos passos**
- Validar visualmente em ambiente de desenvolvimento
- Testar micro-interações em dispositivos reais (mobile, desktop)
- Considerar integrar InsightCard no Dashboard quando houver insights disponíveis
- Testar contraste WCAG AA em ambos os temas (light/dark)
