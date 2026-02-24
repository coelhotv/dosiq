# ESPECIFICAÇÃO TÉCNICA DE UX/UI
## Meus Remédios 2.0 - Redesign da Dashboard

**Versão:** 1.0  
**Data:** 04/02/2026  
**Autor:** Product Strategy  
**Status:** Draft para Review

---

## 1. VISÃO GERAL

### 1.1 Problema
A dashboard atual apresenta sobrecarga cognitiva com 11+ elementos visuais simultâneos, duplicidade de métricas ("Adesão" vs "Aderência") e falta de hierarquia contextual que leva o usuário a decisão paralisada.

### 1.2 Solução Proposta
Sistema **"Momento Zero"** - interface adaptativa que prioriza a única ação mais relevante no contexto temporal atual, reduzindo carga cognitiva e aumentando taxa de conversão de registro de doses.

### 1.3 Principios de Design
- **Contexto sobre Dados:** Mostrar apenas o necessário para a decisão imediata
- **Progresso sobre Perfeição:** Celebrar pequenas vitórias (micro-recompensas)
- **Ação sobre Navegação:** Registro em máximo 2 interações (swipe + confirmação)

---

## 2. MOCKUPS DE ALTA FIDELIDADE

### 2.1 Estados da Interface

![Dashboard Redesign](sandbox:///mnt/kimi/output/mockups_dashboard_meus_remedios.png)

#### Estado 1: Momento Zero (Ação Imediata)
**Trigger:** Horário atual está dentro da janela de dose (±30 min)

**Componentes:**
1. **Smart Header Contextual**
   - Cor: Âmbar (#FF9500) para urgência suave
   - Conteúdo: "HORA DO [MEDICAMENTO]" + countdown
   - Ação: Tap expande timeline das próximas 4 doses

2. **Card de Ação Primária (Swipe-to-Take)**
   - Dimensões: 84% width, 18% height (proporção mobile)
   - Estado visual: Fundo verde escuro (#1F2F23) com borda verde (#34C759)
   - Interação: Swipe horizontal direito mínimo 80px
   - Feedback: Haptic light no início, heavy na confirmação + sombra expansiva

3. **Smart Stack de Alertas**
   - Prioridade 1: Estoque crítico (vermelho) - aparece apenas se <3 dias
   - Prioridade 2: Adesão semanal (sparkline) - colapsável
   - Regra: Máximo 1 alerta visível simultaneamente na home

4. **Progresso Micro-visual**
   - Dots horizontais (máx 5 doses/dia)
   - Cores: Verde (tomado), Cinza (pendente)
   - Posição: Acima do fold, abaixo do card principal

#### Estado 2: Meta Alcançada (Sucesso)
**Trigger:** 100% doses do dia completadas

**Componentes:**
1. **Header de Celebração**
   - Anel de progresso pontilhado (60 segmentos) animado
   - Texto: "Sequência: X dias" + badge de recorde
   - Efeito: Micro-confete (partículas sutis) ao entrar no estado

2. **Card de Insight**
   - ML-generated tip baseado em padrões de comportamento
   - Formato: "Você tem X% melhor adesão quando [condição]"
   - Cor: Azul informativo (#007AFF)

3. **Próxima Dose Preview**
   - Informação relaxada (amanhã, horário)
   - CTA secundário: Ajustar lembrete

#### Estado 3: Atenção Necessária (Múltiplos Alertas)
**Trigger:** >1 evento crítico simultâneo (dose atrasada + estoque baixo)

**Componentes:**
1. **Header de Alerta Agregado**
   - Contador: "N ALERTAS PENDENTES"
   - Cor: Vermelho crítico (#FF3B30)
   - Ação: Tap expande lista detalhada

2. **Stack de Cards de Ação**
   - Layout: Vertical scrollable (máx 3 visíveis)
   - Prioridade: Dose atrasada (vermelho) > Estoque (âmbar) > Dicas (azul)
   - CTA primário por card (evitar decisão do usuário)

3. **Timeline Colapsada**
   - Visualização horária do dia (4 pontos principais)
   - Status: Verde (ok), Vermelho (atrasado), Cinza (futuro)

---

## 3. ESPECIFICAÇÃO DE INTERAÇÕES

### 3.1 Gestos

| Gesto | Contexto | Ação | Feedback |
|-------|----------|------|----------|
| **Swipe Direito** | Card de medicação | Confirma dose | Haptic success + sombra + collapse |
| **Swipe Esquerdo** | Card de medicação | Adiar 30min | Snackbar com undo (5s) |
| **Long Press** | Header contextual | Expandir timeline | Scale up suave (0.95→1.0) |
| **Pull Down** | Dashboard | Sync manual | Spinner + refresh indicator |
| **Double Tap** | Alerta de estoque | Ir para compra | Transição slide-left |

### 3.2 Micro-interações

#### Confirmação de Dose (Swipe)
```
1. Touch Begin: Card scale 0.98, shadow aumenta
2. Drag >20px: Background verde revela da esquerda (gradiente)
3. Drag >50px: Ícone de check aparece no centro do swipe
4. Drag >80px: Haptic heavy + Som de liquido (opcional)
5. Release: Card collapse para baixo (height 0 com spring animation)
6. Success: Dots de progresso preenchem sequencialmente (stagger 100ms)
```

#### Atualização de Estoque
```
1. Tap "+ Estoque": Modal slide-up com input numérico
2. Input: Teclado numérico apenas, default = última compra
3. Confirmação: Shake animation no card se <7 dias (alerta preemptivo)
```

### 3.3 Sistema de Cores Semânticas

| Contexto | Cor Hex | Uso |
|----------|---------|-----|
| Sucesso/Adesão | #34C759 | Doses tomadas, sequências, metas |
| Urgência Leve | #FF9500 | Próxima dose (<1h), estoque médio |
| Crítico | #FF3B30 | Atrasado, estoque zerado, alertas |
| Informativo | #007AFF | Insights, dicas, navegação |
| Neutro | #8E8E93 | Textos secundários, elementos inativos |
| Fundo | #0A0A0F | Background (dark mode obrigatório) |
| Card | #1C1C24 | Superfícies elevadas |

### 3.4 Tipografia

| Hierarquia | Fonte | Tamanho | Peso | Uso |
|------------|-------|---------|------|-----|
| H1 | SF Pro Display | 28pt | Bold | Nome do remédio (ação principal) |
| H2 | SF Pro Display | 20pt | Semibold | Headers de seção |
| H3 | SF Pro Text | 17pt | Medium | Labels de contexto |
| Body | SF Pro Text | 15pt | Regular | Descrições, dados |
| Caption | SF Pro Text | 13pt | Medium | Timestamps, unidades |
| Micro | SF Pro Text | 11pt | Regular | Legendas, footer |

---

## 4. ARQUITETURA DE INFORMAÇÃO (Nova)

### 4.1 Hierarquia Visual

```
Z-Index 10: Header Contextual (fixo, backdrop blur)
Z-Index 20: Card de Ação Primária (elevado, shadow 4dp)
Z-Index 15: Smart Stack (scrollable)
Z-Index 5:  Background (gradiente sutil)
Z-Index 30: Bottom Navigation (fixo)
```

### 4.2 Estados de Loading

- **Skeleton:** Shimmer effect em cards (não spinner circular)
- **Empty State:** Ilustração + CTA primário (nunca tela em branco)
- **Error:** Mensagem em-card (não modal invasivo) com retry sutil

### 4.3 Responsividade

**Breakpoints:**
- Mobile: <375px (iPhone SE) - Layout compacto, fonte -1pt
- Mobile Padrão: 375-428px - Layout base
- Tablet: >768px - Split view (lista esquerda, detalhe direita)

---

## 5. ROADMAP DE IMPLEMENTAÇÃO UX

### Fase 1: Fundação (Semanas 1-2)
**Objetivo:** Reduzir carga cognitiva imediata

- [ ] Implementar Smart Header (contexto temporal)
- [ ] Consolidar nomenclatura (remover "Aderência", manter "Adesão")
- [ ] Criar componente Swipe-to-Take (biblioteca React Native Gesture Handler)
- [ ] Reduzir scroll: Mover calendário mensal para aba "Histórico"
- [ ] Aumentar touch targets para 48x48dp mínimo

**Métricas de Sucesso:**
- Tempo médio de registro: <8s → <3s
- Taxa de erro (clique errado): <15%

### Fase 2: Inteligência Contextual (Semanas 3-6)
**Objetivo:** Personalização adaptativa

- [ ] Algoritmo "Momento Zero" (priorização de próxima ação)
- [ ] Sparkline de adesão semanal (biblioteca de charts)
- [ ] Smart Stack de alertas (priorização automática)
- [ ] Sistema de cores dinâmico (alteração conforme estado)
- [ ] Haptic feedback em todos os pontos de sucesso

**Métricas de Sucesso:**
- D1 Retention: +20%
- Task Success Rate: >90%

### Fase 3: Gamificação Saudável (Semanas 7-10)
**Objetivo:** Engajamento emocional sem coerção

- [ ] Sistema de sequências (streaks) visuais
- [ ] Celebrações de milestone (7, 30, 90 dias)
- [ ] Insights ML (correlação de comportamentos)
- [ ] Modo Cuidador (visão read-only simplificada)

**Métricas de Sucesso:**
- Adesão média do app: 71% → 85%
- NPS: >50

### Fase 4: Ecossistema (Semanas 11-16)
**Objetivo:** Integração e expansão

- [ ] Widget iOS/Android (próxima dose na home)
- [ ] Integração Apple Health / Google Fit
- [ ] Complicação para Apple Watch / Wear OS
- [ ] Modo Offline-first (sync em background)

---

## 6. CRITÉRIOS DE ACEITAÇÃO

### 6.1 Performance
- **Time to Interactive:** <2s em 4G
- **Animation Frame Rate:** 60fps em swipe gestures
- **Bundle Size:** Incremento máximo de 500KB na Fase 1

### 6.2 Acessibilidade (WCAG 2.1 AA)
- Contraste mínimo 4.5:1 para todo texto
- Screen reader labels descritivos (não apenas "botão", mas "Confirmar dose de Paracetamol")
- Suporte a Dynamic Type (iOS) / Font Size (Android)
- Reduce Motion respeitado (animações desativáveis)

### 6.3 Testes de Usabilidade
- **Cohort 1:** Usuários 60+ (teste de legibilidade e simplicidade)
- **Cohort 2:** Usuários com artrite (teste de precisão de gestos)
- **Cohort 3:** Usuários com múltiplas medicações (>5)

**Critério de Aprovação:** 80% dos usuários conseguem registrar dose em primeira tentativa sem assistência.

---

## 7. ANEXOS

### Anexo A: Fluxo de Estados
```
[Chegada App] 
    ↓
[Verificar Contexto Temporal]
    ↓
├─ Hora da dose → Estado 1 (Momento Zero)
├─ Dose atrasada → Estado 3 (Alerta)
├─ Tudo em dia → Estado 2 (Sucesso)
└─ Primeiro uso → Onboarding
```

### Anexo B: Estados de Erro
- **Swipe acidental:** Undo snackbar com 5s timeout
- **Sem internet:** Queue local, sync badge quando voltar
- **Estoque negativo:** Alerta de validação, não permite salvar

### Anexo C: Referências
- Apple Human Interface Guidelines (Medication Tracking)
- Material Design 3 (Dynamic Color)
- NN/g Heuristics (Visibility of System Status)

---

**Próximos Passos:**
1. Review com stakeholders técnicos (viabilidade de ML local)
2. Prototipagem em Figma (micro-interações)
3. Teste A/B: Swipe vs Tap (2 semanas)
4. Handoff para desenvolvimento (Fase 1)

**Contato:** Product Lead | product@meusremedios.com.br
