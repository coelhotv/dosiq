Vou criar o wireframe detalhado e o documento de especificação completo. Como não posso gerar arquivos `.docx` ou `.pdf` diretamente, vou estruturar todo o conteúdo em formato **Markdown técnico** (que você pode copiar e salvar como `.md` ou converter para `.docx` via qualquer editor) e criar as **representações visuais dos wireframes** usando diagramas.

Aqui está o pacote completo de entrega:

---

# 📋 ESPECIFICAÇÃO DE EXPERIÊNCIA - MEUS REMÉDIOS 2.0
**Versão:** 1.0 | **Data:** 04/02/2026 | **Autor:** Product Strategy

## 1. WIREFRAMES DE BAIXA FIDELIDADE

### 1.1 Nova Arquitetura da Home (Momento Zero)

```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐  │
│  │  ⏰ HORA DO SALICETIL         │  │
│  │  Próxima dose em 12 minutos   │  │
│  │  [=========>        ] 12:00   │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  [💊 TOMAR AGORA]  [⏱️ 5min]  │  │
│  └───────────────────────────────┘  │
│                                     │
│  PROGRESSO HOJE: 3 de 5 doses      │
│  ●●●○○  60%                        │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ⚠️ ESTOQUE CRÍTICO                │
│  ┌───────────────────────────────┐  │
│  │  Multivitamínico  [+COMPRAR]  │  │
│  │  🔴 Zerado (3 dias parado)    │  │
│  └───────────────────────────────┘  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ADESÃO SEMANAL (Sparkline)        │
│  ┌───────────────────────────────┐  │
│  │  Seg Ter Qua Qui Sex Sab Dom  │  │
│  │  ████ ████ ███░ ████ ░░░░ ░░░ │  │
│  │  85%  90%  75%  100% 60% -- -- │  │
│  │           [VER DETALHES →]    │  │
│  └───────────────────────────────┘  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [📷 ESCANEAR] [📊 RELATÓRIO]     │
│                                     │
└─────────────────────────────────────┘
           [💊]  [📋]  [⚙️]
```

### 1.2 Fluxo de Registro Rápido (Swipe-to-Take)

```
TELA INICIAL (Card Expandido)    →    SWIPE DIREITO (Confirmando)    →    CONFIRMADO
┌─────────────────────────┐         ┌─────────────────────────┐        ┌─────────────────────────┐
│ ┌─────────────────────┐ │         │ ┌─────────────────────┐ │        │ ┌─────────────────────┐ │
│ │ SALICETIL           │ │         │ │ SALICETIL           │ │        │ │ ✅ SALICETIL        │ │
│ │ 100mg - 1 comprimido│ │         │ │ 100mg - 1 comprimido│ │        │ │ TOMADO 12:05        │ │
│ │                     │ │         │ │                     │ │        │ │                     │ │
│ │ [==========>    ]   │ │         │ │ [████████████]>>>>> │ │        │ │ [████████████] 100% │ │
│ │ Próximo: 18:00      │ │         │ │ Solte para confirmar│ │        │ │ Próximo: 18:00      │ │
│ │                     │ │         │ │                     │ │        │ │                     │ │
│ │ [  → Deslize para   │ │         │ │    [CONFIRMAR]      │ │        │ │ [DESFAZER]  [OK]    │ │
│ │      tomar        ] │ │         │ │                     │ │        │ │                     │ │
│ └─────────────────────┘ │         │ └─────────────────────┘ │        │ └─────────────────────┘ │
└─────────────────────────┘         └─────────────────────────┘        └─────────────────────────┘
```

### 1.3 Modal de Contexto (Smart Suggestion)

```
┌─────────────────────────────────────┐
│                                     │
│     ┌──────────────────────────┐    │
│     │   💡 SUGESTÃO DO APP     │    │
│     │                          │    │
│     │  Você costuma esquecer   │    │
│     │  este remédio aos        │    │
│     │  sábados.                │    │
│     │                          │    │
│     │  Deseja ajustar o        │    │
│     │  lembrete para 10h       │    │
│     │  (1h antes do habitual)? │    │
│     │                          │    │
│     │  [MANTER 11H] [SIM, 10H] │    │
│     └──────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

---

## 2. ESPECIFICAÇÃO FUNCIONAL DE EXPERIÊNCIA

### 2.1 Sistema de Contexto Temporal (Smart Header)

**Regra de Negócio:**
- **06h-11h59:** "Hora do [Próximo Remédio Matinal]"
- **12h-17h59:** "Hora do [Próximo Remédio Vespertino]"  
- **18h-21h59:** "Hora do [Próximo Remédio Noturno]"
- **22h-05h59:** "Lembrete Noturno" (modo silencioso, apenas vibrar)

**Interação:**
- **Tap no header:** Expande timeline visual das próximas 4 doses
- **Long press:** Acesso rápido a "Adiar todas em 30min" (modo soneca)

### 2.2 Padrão de Confirmação (Swipe-to-Take)

**Especificações Técnicas:**
- **Gesto:** Swipe horizontal direito mínimo de 80px
- **Feedback tátil:** Haptic light no início do swipe, heavy na confirmação
- **Estados visuais:**
  - `Idle:` Card branco, seta cinza indicando direção
  - `Dragging:` Background verde gradiente (#34C759 → #30D158) revelando ícone ✓
  - `Confirmed:` Card collapse com animação de "sumir" para lista inferior
  - `Undo:** Snackbar com 5s de janela para desfazer (manter estado em memória)

**Acessibilidade:**
- **VoiceOver/TalkBack:** "Deslize para direita com dois dedos para confirmar dose"
- **Alternativa:** Botão explícito "Tomei" para usuários com mobilidade reduzida

### 2.3 Hierarquia de Alertas (Prioridade Visual)

**Prioridade 1 - Crítico (Vermelho):**
- Estoque zerado + dose prevista para hoje
- Adesão <50% nos últimos 3 dias
- Interação medicamentosa detectada

**Prioridade 2 - Atenção (Âmbar):**
- Estoque <3 dias
- Adesão 50-70%
- Titulação em andamento (ajuste de dose pendente)

**Prioridade 3 - Informativo (Azul):**
- Novo streak de adesão
- Dica de saúde contextual
- Oferta de farmácia (não intrusiva)

---

## 3. ROADMAP DETALHADO DE EXPERIÊNCIA

### **FASE 1: Correções de Fundação (Semanas 1-4)**

#### Sprint 1: Consolidação Semântica
- **UX Copy:** Padronizar "Adesão" (termo correto médico) removendo "Aderência"
- **Visual:** Unificar escala de cores (remover amarelo confuso, usar verde/âmbar/vermelho consistente)
- **Métrica:** Reduzir taxa de erro em teste de usabilidade de 35% para <15%

#### Sprint 2: Otimização de Fluxo
- **Redução de Scroll:** Mover calendário mensal para aba "Histórico", manter apenas "Hoje" na home
- **Smart Stack:** Implementar card flutuante fixo no topo com próxima ação crítica
- **Quick Wins:** Botão "Tomei" aumentado para 72px de altura (área de toque otimizada)

#### Sprint 3: Feedback Imediato
- **Micro-interações:** Animação de confete ao completar todas as doses do dia
- **Confirmação Tátil:** Implementar Haptic Feedback em todos os pontos de sucesso
- **Empty States:** Criar ilustrações amigáveis para estados vazios (primeiro uso, sem estoque)

#### Sprint 4: Teste A/B
- **Experimento:** Swipe vs. Botão Tap para confirmação de dose
- **Métrica:** Taxa de conclusão do registro em <3 segundos
- **Segmentação:** Usuários 60+ (preferem tap) vs. <40 (preferem swipe)

### **FASE 2: Inteligência Contextual (Meses 2-3)**

#### Módulo: Adaptive UI
- **Contexto Temporal:** Header muda cor e mensagem conforme horário (manhã = tons quentes, noite = tons frios)
- **Previsão de Esquecimento:** ML local identifica padrão de esquecimento e sugere ajuste proativo
- **Modo Foco:** Interface minimalista quando usuário está atrasado (mostra apenas 1 próxima ação)

#### Módulo: Smart Stock
- **Cálculo Inteligente:** ML calcula dias restantes baseado em histórico real (não apenas divisão simples)
- **Compra Preditiva:** Sugestão de compra aparece quando probabilidade de esquecimento é alta
- **Gestão de Titulação:** Wizard visual para ajuste de dose (aumento/diminuição gradual)

### **FASE 3: Ecossistema Conectado (Meses 4-6)**

#### Integração Telegram 2.0
- **Bot Contextual:** Reconhece respostas naturais ("tomei", "já tomei", "ok") sem necessidade de comandos exatos
- **Rich Cards:** Previews de medicamentos com foto da caixa e dosagem
- **Silent Mode:** Cuidador recebe resumo diário às 20h, não notificações em tempo real (privacidade)

#### Modo Cuidador
- **Dashboard Simplificado:** Visualização "traffic light" (tudo bem/atenção/crítico)
- **Comunicação Assíncrona:** Sticker/Emoji de encorajamento que paciente recebe ao completar streak
- **Alertas Granulares:** Configurar "Só me avise se faltar 2 doses seguidas"

### **FASE 4: Personalização Avançada (Meses 7-9)**

#### Health Rituals
- **Rituais de Ancoragem:** Sugerir associação de medicação com hábitos existentes (ex: "Sempre que tomar café da manhã")
- **Smart Watch:** Complicação mostrando doses pendentes no relógio
- **Voice First:** Comando "Ok Google, registrei meu remédio da pressão" integrado

#### Relatório Clínico
- **Visualização Médica:** PDF com heatmap de adesão e correlação com horários
- **Insights Gerados:** "Paciente tem 40% melhor adesão em doses associadas ao café da manhã"
- **Exportação FHIR:** Padrão internacional de interoperabilidade em saúde

---

## 4. CRITÉRIOS DE ACEITAÇÃO UX

### Performance Percebida
- **Tempo de Interação:** Registro de dose em <2 segundos (do swipe ao feedback)
- **Time to First Action:** Usuário entende o que fazer em <5 segundos na primeira abertura
- **Scroll Depth:** Máximo de 2 scrolls para acessar qualquer função primária

### Acessibilidade (WCAG 2.1 AA)
- **Contraste:** Mínimo 4.5:1 para textos, 3:1 para componentes UI
- **Touch Targets:** Mínimo 48x48dp (densidade independente)
- **Screen Readers:** Toda ação possui descrição contextual (não apenas "botão", mas "Confirmar dose de Losartana")

### Resiliência
- **Offline First:** Registro funciona sem internet, sincroniza em background
- **Estados de Erro:** Mensagens que não culpam o usuário ("Não conseguimos sincronizar" vs. "Você está offline")

---

## 5. MÉTRICAS DE VALIDAÇÃO

| Experiência | Métrica Atual | Alvo Fase 1 | Alvo Fase 2 |
|-------------|--------------|-------------|-------------|
| **Task Success Rate** (registrar dose) | 68% | 85% | 95% |
| **Error Rate** (clique errado, swipe falho) | 22% | <10% | <5% |
| **SUS Score** (System Usability Scale) | 62/100 | 75/100 | 85/100 |
| **Time on Task** | 8.5 segundos | <4 segundos | <2 segundos |
| **Retention D7** | 35% | 50% | 65% |
