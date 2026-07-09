---
title: "Transição Automática de Etapas"
description: "Especificação do sistema de transição automática de etapas para protocolos em regime de titulação no Dosiq."
version: "1.0.0"
status: active
category: feature
audience:
  - dev
  - agent
tags:
  - titration
  - auto-transition
  - workflow
created_at: "2026-07-08"
updated_at: "2026-07-08"
---

# Transição Automática de Etapas de Titulação

## 🎯 Funcionalidade Implementada

Implementamos um sistema completo de **transição automática de etapas** para protocolos em regime de titulação. O sistema agora detecta automaticamente quando uma etapa termina e oferece ao usuário a opção de avançar para a próxima etapa com um único clique.

---

## 🚀 Como Funciona

### 1. **Detecção Automática**

O sistema calcula automaticamente quando uma etapa de titulação terminou usando:
- **Data de início da etapa** (`stage_started_at`)
- **Duração da etapa** (em dias, definida no `titration_schedule`)
- **Data atual**

Quando `dias_decorridos > duração_da_etapa`, o sistema marca `isTransitionDue = true`.

### 2. **Alerta Visual no Dashboard**

Quando uma transição está pendente, um **banner de alerta** aparece automaticamente no Dashboard com:

#### **Para Etapas Intermediárias:**
```
⚠️ Hora de Avançar para a Próxima Etapa

SeloZok (50mg) - BB - Metoprolol

┌─────────────────────┐      →      ┌─────────────────────┐
│ Etapa Atual         │              │ Próxima Etapa       │
│ Etapa 1             │              │ Etapa 2             │
│ 1 comp. por horário │              │ 1.5 comp. por horário│
│ 50mg 2x ao dia      │              │ 75mg 2x ao dia      │
└─────────────────────┘              └─────────────────────┘

Duração da próxima etapa: 14 dias

[Lembrar Depois]  [🚀 Avançar Agora]
```

#### **Para Etapa Final:**
```
⚠️ Protocolo de Titulação Concluído!

SeloZok (50mg) - BB - Metoprolol

Você completou todas as etapas do protocolo de titulação!
A dose atual de 2 comp. é a dose de manutenção.

100mg 2x ao dia - Manutenção

[✅ Marcar como Concluído]
```

### 3. **Ações Disponíveis**

#### **🚀 Avançar Agora**
Ao clicar, o sistema automaticamente:
1. Incrementa `current_stage_index` (ex: 0 → 1)
2. Atualiza `stage_started_at` para a data/hora atual
3. Ajusta `dosage_per_intake` para a dose da nova etapa (ex: 1 → 1.5)
4. Mantém `titration_status = 'titulando'`
5. Recarrega o Dashboard com os dados atualizados

#### **Lembrar Depois**
- Oculta o alerta temporariamente
- O alerta reaparecerá na próxima vez que o Dashboard for carregado
- Útil se você quiser adiar a transição por algumas horas/dias

#### **✅ Marcar como Concluído** (apenas na última etapa)
- Define `titration_status = 'alvo_atingido'`
- Mantém a dose atual como dose de manutenção
- Remove o protocolo da lista de "em titulação"

---

## 🔧 Implementação Técnica

### **Arquivos Criados/Modificados**

#### 1. **`TitrationTransitionAlert.tsx`** (Novo)
Componente React que renderiza o alerta de transição com:
- Comparação visual entre etapa atual e próxima
- Botões de ação
- Tratamento especial para etapa final

#### 2. **`TitrationTransitionAlert.css`** (Novo)
Estilos premium com:
- Gradientes e bordas coloridas
- Animação de entrada (slideDown)
- Layout responsivo
- Design consistente com o resto da aplicação

#### 3. **`protocolService.ts`** - Método `advanceTitrationStage`
```typescript
async advanceTitrationStage(id, markAsCompleted = false) {
  // 1. Busca o protocolo atual
  const protocol = await this.getById(id)
  
  // 2. Valida se há regime de titulação
  if (!protocol.titration_schedule || protocol.titration_schedule.length === 0) {
    throw new Error('Este protocolo não possui regime de titulação')
  }

  const currentStageIndex = protocol.current_stage_index || 0
  const nextStageIndex = currentStageIndex + 1

  // 3. Verifica se há próxima etapa
  if (nextStageIndex >= protocol.titration_schedule.length) {
    // Última etapa - marca como concluído
    return await supabase
      .from('protocols')
      .update({
        titration_status: 'alvo_atingido',
        current_stage_index: protocol.titration_schedule.length - 1,
        stage_started_at: new Date().toISOString()
      })
      // ...
  }

  // 4. Avança para próxima etapa
  const nextStage = protocol.titration_schedule[nextStageIndex]
  
  return await supabase
    .from('protocols')
    .update({
      current_stage_index: nextStageIndex,
      stage_started_at: new Date().toISOString(),
      dosage_per_intake: nextStage.dosage,
      titration_status: markAsCompleted ? 'alvo_atingido' : 'titulando'
    })
    // ...
}
```

#### 4. **`Dashboard.tsx`** - Integração
```typescript
// Estado para rastrear alertas dispensados
const [dismissedTransitions, setDismissedTransitions] = useState(new Set())

// Handler para avançar etapa
const handleAdvanceTitration = async (protocolId, isFinalStage) => {
  await protocolService.advanceTitrationStage(protocolId, isFinalStage)
  showSuccess(isFinalStage 
    ? '🎯 Protocolo de titulação concluído!' 
    : '🚀 Avançado para a próxima etapa!')
  await loadDashboardData()
}

// Handler para dispensar alerta
const handleDismissTransition = (protocolId) => {
  setDismissedTransitions(prev => new Set(prev).add(protocolId))
}

// Renderização dos alertas
{activeProtocols
  .filter(p => 
    p.titration_scheduler_data?.isTransitionDue && 
    !dismissedTransitions.has(p.id)
  )
  .map(protocol => (
    <TitrationTransitionAlert
      key={protocol.id}
      protocol={protocol}
      onAdvance={handleAdvanceTitration}
      onDismiss={handleDismissTransition}
    />
  ))
}
```

---

## 📊 Fluxo de Dados

```
1. Dashboard carrega
   ↓
2. Para cada protocolo ativo:
   - Calcula titration_scheduler_data via calculateTitrationData()
   - Verifica se isTransitionDue = true
   ↓
3. Se transição pendente E não dispensado:
   - Renderiza TitrationTransitionAlert
   ↓
4. Usuário clica "Avançar Agora":
   - Chama protocolService.advanceTitrationStage(id)
   - Atualiza banco de dados
   - Recarrega Dashboard
   - Mostra mensagem de sucesso
   ↓
5. Dashboard atualizado mostra:
   - Nova etapa atual
   - Novo progresso (Dia 1/14)
   - Nova dose nos registros futuros
```

---

## 🎨 Design e UX

### **Cores e Ícones**
- **Alerta de transição**: Amarelo/laranja (`--accent-warning`)
- **Etapa atual**: Opacidade reduzida (passado)
- **Próxima etapa**: Verde (`--accent-success`) - destaque
- **Animação**: Slide down suave (0.3s)

### **Responsividade**
- **Desktop**: Layout horizontal com comparação lado a lado
- **Mobile**: Layout vertical com seta rotacionada (90°)

### **Feedback Visual**
- ✅ **Sucesso**: Banner verde com mensagem
- ❌ **Erro**: Banner vermelho com detalhes
- 🔄 **Loading**: Desabilitação de botões durante operação

---

## 🧪 Testando a Funcionalidade

### **Cenário 1: Criar Protocolo em Titulação**

1. Cadastre um medicamento (ex: Selozok 50mg)
2. Crie um protocolo com 3 etapas:
   - Etapa 1: 1 dia, 1 comp (para testar rapidamente)
   - Etapa 2: 7 dias, 1.5 comp
   - Etapa 3: 14 dias, 2 comp
3. Salve o protocolo

### **Cenário 2: Simular Transição (Teste Rápido)**

Para testar sem esperar dias, você pode:

**Opção A: Editar manualmente no Supabase**
1. Vá no Table Editor → protocols
2. Encontre seu protocolo
3. Edite `stage_started_at` para uma data passada (ex: 2 dias atrás)
4. Salve
5. Recarregue o Dashboard → O alerta deve aparecer!

**Opção B: Usar SQL**
```sql
UPDATE protocols
SET stage_started_at = NOW() - INTERVAL '2 days'
WHERE name = 'BB - Metoprolol';
```

### **Cenário 3: Avançar Etapa**

1. Com o alerta visível, clique em **"🚀 Avançar Agora"**
2. Observe:
   - Banner de sucesso aparece
   - Alerta desaparece
   - Card do protocolo atualiza para "Etapa 2/3"
   - Progresso reseta para "Dia 1/7"
   - Dose atualiza para 1.5 comp

### **Cenário 4: Dispensar Alerta**

1. Clique em **"Lembrar Depois"**
2. O alerta desaparece
3. Recarregue a página → O alerta reaparece
4. Navegue para outra página e volte → O alerta reaparece

### **Cenário 5: Concluir Titulação**

1. Avance até a última etapa (Etapa 3)
2. Simule que a etapa terminou (edite `stage_started_at`)
3. O alerta muda para **"Protocolo de Titulação Concluído!"**
4. Clique em **"✅ Marcar como Concluído"**
5. Observe:
   - `titration_status` → `'alvo_atingido'`
   - Protocolo sai da lista de "em titulação"
   - Dose permanece em 2 comp (manutenção)

---

## 🔮 Melhorias Futuras (Opcional)

1. **Notificações Push**: Alertar 1 dia antes da transição
2. **Histórico de Transições**: Registrar cada mudança de etapa em uma tabela separada
3. **Gráfico de Evolução**: Visualizar a progressão da dose ao longo do tempo
4. **Ajuste Manual de Data**: Permitir adiar a transição por X dias
5. **Confirmação com Senha**: Para mudanças críticas de dosagem
6. **Integração com Médico**: Enviar relatório de progresso por email

---

## ✅ Checklist de Implementação

- [x] Componente `TitrationTransitionAlert` criado
- [x] Estilos CSS com design premium
- [x] Método `advanceTitrationStage` no API service
- [x] Integração no Dashboard
- [x] Handlers para avançar e dispensar
- [x] Tratamento de erros
- [x] Feedback visual (sucesso/erro)
- [x] Build sem erros
- [x] Documentação completa

---

## 📝 Notas Importantes

1. **Persistência de Dispensas**: Os alertas dispensados são armazenados apenas em memória (state). Ao recarregar a página, eles reaparecem. Para persistência permanente, seria necessário armazenar no localStorage ou banco de dados.

2. **Validação de Etapas**: O sistema valida se há próxima etapa antes de avançar. Se estiver na última etapa, automaticamente marca como concluído.

3. **Atualização de Dose**: A dose (`dosage_per_intake`) é atualizada automaticamente para a dose da nova etapa. Isso afeta todos os registros futuros.

4. **Compatibilidade**: Funciona com protocolos avulsos e protocolos dentro de planos de tratamento.

---

**Desenvolvido com ❤️ para facilitar o gerenciamento de medicamentos em titulação.**
