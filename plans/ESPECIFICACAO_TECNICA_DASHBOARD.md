# Especificação Técnica: Dashboard Health Command Center

## 1. Matriz de Dependências
- **Frontend:** React 19 (Hooks, Suspense), CSS Modules (Tokens), Lucide React (Ícones), Framer Motion (Animações/Gestos).
- **Backend/Data:** Supabase JS Client (RLS ativo), SWR/Custom Cache (em `src/lib/queryCache.js`).
- **Lógica:** Zod (Validação de schemas de visualização).

## 2. Descrições Funcionais (PRD)

### 2.1 Health Score Engine & Dynamic Greeting
- **Greeting:** Componente que renderiza a saudação baseada no `new Date().getHours()` e no perfil do usuário via `userService`.
- **Score:** Processamento client-side da média ponderada (30 dias): Adesão (60%), Pontualidade (20%), Estoque (20%). Uso de Skeletons durante o `Hydration`.

### 2.2 Smart Alerts & Proactive Support
- Sistema de cards com renderização condicional por severidade.
- **CTAs Contextuais:** Implementação de lógicas de "Deep Link" e "Quick Action". Exemplos:
    - Alerta Atraso -> Botão `Tomar` aciona `logService.registerDose`.
    - Alerta Estoque -> Botão `Comprar` abre link externo ou modal de ajuste.

### 2.3 Advanced Treatment Widget (Accordion Pattern)
- **Protocolos Complexos (ex: Fantastic Four):** Uso de padrão Accordion para agrupar múltiplos medicamentos de um mesmo protocolo.
- **Multi-select Registration:** Interface que permite selecionar múltiplos itens e registrar a dose em lote (batch update), minimizando interações com o banco.
- **Visual State:** Indicadores de cor (Verde: OK, Laranja: Próximo, Vermelho: Atrasado).

### 2.4 Gesto 'Swipe to Register'
- Implementação técnica utilizando `Framer Motion` (`drag="x"`, `dragConstraints`).
- **Lógica de Gatilho:** Ao atingir o threshold de 70% da largura do container, dispara a função de registro.
- **Feedback:** Vibração (haptic feedback) via API do browser e transição visual do card para estado 'Concluído'.

## 3. Implementação Técnica de Widgets Dinâmicos
- **Context Engine:** Hook `useDashboardContext` que avalia:
    1. Horário atual vs. Próximas Doses.
    2. Status de Estoque Crítico.
    3. Alertas Pendentes.
- **Renderização:** Orquestração via `DashboardLayout` que ordena os componentes baseado no peso de prioridade calculado pelo `Context Engine`.

## 4. Critérios de Aceitação & Performance
- [ ] Registro de dose via Swipe deve ser processado e refletido no UI em < 100ms (Optimistic UI).
- [ ] O Accordion de protocolos deve suportar até 10 itens sem perda de performance.
- [ ] Custo Zero: Sem chamadas extras à API para cálculos de UI; uso estrito de dados já presentes no cache do SWR.
- [ ] Responsividade: Touch targets mínimos de 44x44px.

## 5. Sequenciamento de Implementação
1. **Fase 1 (Context Logic):** Criação do `useDashboardContext.js` e lógica de priorização.
2. **Fase 2 (UI Foundation):** Integração do Framer Motion e componentes de Greeting.
3. **Fase 3 (Advanced Components):** Implementação do `AccordionTreatmentCard` e Multi-select.
4. **Fase 4 (Gestures):** Implementação do Swipe e Haptics.

---
*Foco: UX Fluida, Custo Zero, Alta Fidelidade ao Mockup.*
