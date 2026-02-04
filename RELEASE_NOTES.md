# 🎉 Release v2.4.0 - Onda 2: Engajamento e Adesão

**Data:** 04 de Fevereiro de 2026  
**Versão:** 2.4.0  
**Tipo:** Minor Release  
**Codinome:** Onda 2 - Fases A e B

---

## 🎯 Resumo Executivo

A **Onda 2** foca em **aumentar o engajamento** do usuário e **melhorar a adesão** ao tratamento através de notificações mais ricas no Telegram, widgets interativos no Dashboard e visualização clara do progresso de titulação.

---

## 🌟 Highlights

### 1. Confirmação ao Pular Dose ⚠️
Evita pulos acidentais com diálogo de confirmação no bot.

```
⚠️ Confirmar ação

Você está prestes a pular a dose de Ritalina.
Esta ação não poderá ser desfeita.

[✅ Confirmar pular] [❌ Cancelar]
_Confirme em 30 segundos..._
```

### 2. Notificações Ricas no Telegram ✨
Mensagens mais informativas e visualmente agradáveis.

| Antes | Depois |
|-------|--------|
| Texto simples | MarkdownV2 com emojis |
| Botões sem ícones | Botões com emojis (✅ ⏰ ⏭️) |
| Sem escape de caracteres | Escape automático de caracteres especiais |
| 2 botões | 3 botões (Adiar adicionado) |

### 3. Score de Adesão no Dashboard 📊
Acompanhe sua consistência no tratamento.

```
┌─────────────────────────────────────────────┐
│  📈 Score de Adesão (30 dias)      [▼]     │
│                                             │
│     ████████░░░░░░░░  78%                   │
│                                             │
│   ✅ 23 doses tomadas                       │
│   ❌ 5 doses perdidas                       │
│   ⏭️ 2 doses puladas                        │
│                                             │
│   🔥 Streak: 7 dias seguidos!               │
└─────────────────────────────────────────────┘
```

### 4. Timeline de Titulação 📈
Visualize todo o cronograma de titulação do seu medicamento.

```
┌─────────────────────────────────────────────┐
│  Cronograma de Titulação - Ritalina         │
│                                             │
│  ✅ Etapa 1 (completa)                      │
│     10mg • 7 dias                           │
│  🎯 Etapa 2 (atual)                         │
│     20mg • 7 dias • 3 dias restantes        │
│  ○ Etapa 3 (futura)                         │
│     30mg • 7 dias                           │
│  ○ Etapa 4 (futura)                         │
│     40mg • manutenção                       │
│                                             │
│  Progresso: ██████░░░░  25%                 │
└─────────────────────────────────────────────┘
```

---

## 📦 Novas Funcionalidades

### Task 2.5: Confirmação ao Pular Dose
- Diálogo de confirmação com timeout de 30 segundos
- Restore automático da UI original após timeout
- Handlers dedicados para confirmar/cancelar
- Mensagens de erro claras

### Task 2.6: Notificações Ricas no Bot
- Escape de caracteres MarkdownV2
- Emojis em todas as mensagens
- Novo botão "Adiar" (snooze)
- Formatação visual aprimorada

### Task 2.1: Score de Adesão e Widget
- Cálculo de adesão por período (7d, 30d, 90d)
- Streaks de dias consecutivos
- Visualização em progress bar
- Badge de streak no ProtocolCard

### Task 2.4: Widgets de Engajamento no Dashboard
- QuickActionsWidget para ações frequentes
- StockAlertsWidget para alertas visuais
- Layout em grid responsivo
- Integração com navegação existente

### Task 2.3: Timeline de Titulação
- Visualização completa das etapas
- Cálculo automático de datas
- Modo compacto e expandido
- Indicadores visuais de status

---

## 🔧 Breaking Changes

Nenhuma breaking change. Todas as modificações são adições de funcionalidades ou melhorias compatíveis com versões anteriores.

---

## 📝 Instruções de Upgrade

1. **Deploy do backend:**
   ```bash
   cd server && npm install && npm run deploy
   ```

2. **Deploy do frontend:**
   ```bash
   npm run build && npm run deploy
   ```

3. **Verificar variáveis de ambiente:**
   - Nenhuma variável nova necessária

4. **Testar integração Telegram:**
   - Enviar comando `/hoje` no bot
   - Verificar formatação das mensagens
   - Testar confirmação de skip

---

## 📊 Métricas de Qualidade

- ✅ Todos os testes unitários passando
- ✅ Build de produção sem erros
- ✅ Lint sem erros
- ✅ 5 PRs revisados e mergeados
- ✅ 2 conflitos de merge resolvidos

---

## 🐛 Issues Conhecidas

Nenhuma issue conhecida.

---

## 🙏 Agradecimentos

- Task 2.5: Bot skip confirmation
- Task 2.6: Bot rich notifications  
- Task 2.1: Adherence score and widget
- Task 2.4: Dashboard engagement widgets
- Task 2.3: Titration timeline

---

**Full Changelog:** [CHANGELOG.md](CHANGELOG.md)

