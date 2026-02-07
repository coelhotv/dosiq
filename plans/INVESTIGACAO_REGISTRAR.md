# 🔍 INVESTIGAÇÃO - COMANDO /REGISTRAR

**Data:** 2026-02-07  
**Status:** 🟡 EM INVESTIGAÇÃO  
**Problema:** Comando `/registrar` não está registrando doses

---

## 📋 Descrição do Problema

O usuário reportou que ao usar o comando `/registrar` no bot:
1. O bot lista os medicamentos corretamente
2. O usuário clica em um medicamento
3. O bot pergunta a quantidade tomada
4. O usuário clica em uma quantidade
5. **NENHUMA mensagem de sucesso é exibida**
6. **NENHUM registro é criado no banco de dados**
7. Ao verificar na app, não há registro da dose

---

## 🔍 Análise do Código

### Fluxo do Comando `/registrar`

1. **Comando inicial** ([`server/bot/commands/registrar.js`](server/bot/commands/registrar.js:5))
   - Busca protocolos ativos do usuário
   - Cria teclado inline com nomes dos medicamentos
   - Envia mensagem: "💊 Registrar dose manual\nQual medicamento você tomou?"
   - Define sessão: `{ action: 'registrar_dose' }`

2. **Callback - Medicamento selecionado** ([`server/bot/callbacks/conversational.js`](server/bot/callbacks/conversational.js:109))
   - `handleRegistrarMedSelected(bot, callbackQuery)`
   - Busca protocolo para obter dosagem padrão
   - Define sessão: `{ action: 'registrar_dose', step: 'waiting_qty', medicineId, protocolId, medicineName, waitingForInput: true }`
   - Edita mensagem perguntando quantidade

3. **Callback - Quantidade selecionada** ([`server/bot/callbacks/conversational.js`](server/bot/callbacks/conversational.js:158))
   - `handleRegistrarQtySelected(bot, callbackQuery)`
   - Verifica sessão e ação
   - Chama `processDoseRegistration(bot, chatId, session.protocolId, session.medicineId, quantity, message.message_id)`

4. **Processamento do registro** ([`server/bot/callbacks/conversational.js`](server/bot/callbacks/conversational.js:198))
   - `processDoseRegistration(bot, chatId, protocolId, medicineId, quantity, editMessageId = null)`
   - Obtém userId via `getUserIdByChatId(chatId)`
   - Cria log no banco
   - Decrementa estoque
   - Calcula streak
   - Envia mensagem de sucesso

---

## 🐛 Possíveis Causas

### 1. Erro Silenciado em `processDoseRegistration`

**Problema:** A função `processDoseRegistration` usa `console.error` em vez de `logger.error`

**Código atual (linha 269):**
```javascript
} catch (err) {
  console.error('Erro ao registrar dose manual:', err);
  
  // Handle unlinked user case
  if (err.message === 'User not linked') {
    await bot.sendMessage(chatId, '❌ Conta não vinculada. Use /start para vincular.');
    return;
  }
  
  bot.sendMessage(chatId, '❌ Erro ao registrar a dose. Tente novamente.');
}
```

**Problema:** Se houver um erro, ele é silenciado (apenas logado no console) e o usuário não recebe feedback.

**Solução:** Usar `logger.error` para registrar o erro e enviar mensagem de feedback ao usuário.

---

### 2. Falha na Obtenção de UserId

**Problema:** A função `getUserIdByChatId` pode estar falhando silenciosamente

**Código (linha 201):**
```javascript
const userId = await getUserIdByChatId(chatId);
```

**Possível causa:** Se o usuário não estiver vinculado corretamente, a função lança um erro com mensagem 'User not linked'.

**Solução:** Adicionar tratamento de erro mais robusto e feedback ao usuário.

---

### 3. Falha no Decremento de Estoque

**Problema:** O decremento de estoque pode estar falhando silenciosamente

**Código (linha 217-236):**
```javascript
const { data: stockEntries, error: fetchError } = await supabase
  .from('stock')
  .select('*')
  .eq('medicine_id', medicineId)
  .eq('user_id', userId)
  .gt('quantity', 0)
  .order('purchase_date', { ascending: true });

if (!fetchError && stockEntries.length > 0) {
  let remaining = quantity;
  for (const entry of stockEntries) {
    if (remaining <= 0) break;
    const toDecrease = Math.min(entry.quantity, remaining);
    await supabase
      .from('stock')
      .update({ quantity: entry.quantity - toDecrease })
      .eq('id', entry.id);
    remaining -= toDecrease;
  }
}
```

**Possível causa:** Se não houver estoque suficiente, o loop pode falhar silenciosamente.

**Solução:** Adicionar tratamento de erro e feedback ao usuário.

---

### 4. Falha na Criação do Log

**Problema:** A criação do log pode estar falhando silenciosamente

**Código (linha 204-212):**
```javascript
const { error: logError } = await supabase
  .from('medicine_logs')
  .insert([{
    user_id: userId,
    protocol_id: protocolId,
    medicine_id: medicineId,
    quantity_taken: quantity,
    taken_at: new Date().toISOString()
  }]);

if (logError) throw logError;
```

**Possível causa:** Se houver um erro de validação no banco, o log não é criado.

**Solução:** Adicionar tratamento de erro mais robusto e feedback ao usuário.

---

## 🔧 Soluções Propostas

### Solução 1: Melhorar Logging e Feedback ao Usuário

**Arquivo:** [`server/bot/callbacks/conversational.js`](server/bot/callbacks/conversational.js:198)

**Mudanças:**
1. Substituir `console.error` por `logger.error`
2. Adicionar feedback ao usuário em caso de erro
3. Adicionar tratamento de erro mais robusto

**Código proposto:**
```javascript
} catch (err) {
  logger.error('Erro ao registrar dose manual:', err, { 
    chatId, 
    protocolId, 
    medicineId, 
    quantity 
  });
  
  // Handle unlinked user case
  if (err.message === 'User not linked') {
    await bot.sendMessage(chatId, '❌ Conta não vinculada. Use /start para vincular.');
    return;
  }
  
  // Handle other errors
  await bot.sendMessage(chatId, `❌ Erro ao registrar a dose: ${err.message}. Tente novamente.`);
}
```

---

### Solução 2: Adicionar Validação de Estoque

**Arquivo:** [`server/bot/callbacks/conversational.js`](server/bot/callbacks/conversational.js:217)

**Mudanças:**
1. Verificar se há estoque suficiente antes de decrementar
2. Adicionar feedback ao usuário se não houver estoque

**Código proposto:**
```javascript
if (!fetchError && stockEntries.length > 0) {
  const totalStock = stockEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  
  if (totalStock < quantity) {
    await bot.editMessageText(`⚠️ Estoque insuficiente! Você tem apenas ${totalStock}x de ${med?.name || 'Medicamento'}.`, {
      chat_id: chatId,
      message_id: editMessageId,
      parse_mode: 'Markdown'
    });
    await bot.answerCallbackQuery(id, { text: 'Estoque insuficiente', show_alert: true });
    clearSession(chatId);
    return;
  }
  
  let remaining = quantity;
  for (const entry of stockEntries) {
    if (remaining <= 0) break;
    const toDecrease = Math.min(entry.quantity, remaining);
    await supabase
      .from('stock')
      .update({ quantity: entry.quantity - toDecrease })
      .eq('id', entry.id);
    remaining -= toDecrease;
  }
}
```

---

### Solução 3: Adicionar Tratamento de Erro na Criação do Log

**Arquivo:** [`server/bot/callbacks/conversational.js`](server/bot/callbacks/conversational.js:204)

**Mudanças:**
1. Adicionar tratamento de erro mais robusto
2. Adicionar feedback ao usuário em caso de erro

**Código proposto:**
```javascript
const { error: logError } = await supabase
  .from('medicine_logs')
  .insert([{
    user_id: userId,
    protocol_id: protocolId,
    medicine_id: medicineId,
    quantity_taken: quantity,
    taken_at: new Date().toISOString()
  }]);

if (logError) {
  logger.error('Erro ao criar log:', logError, { userId, protocolId, medicineId, quantity });
  
  await bot.editMessageText(`❌ Erro ao registrar dose: ${logError.message}`, {
    chat_id: chatId,
    message_id: editMessageId,
    parse_mode: 'Markdown'
  });
  
  await bot.answerCallbackQuery(id, { text: 'Erro ao registrar dose', show_alert: true });
  clearSession(chatId);
  return;
}
```

---

## 📋 Plano de Implementação

### Fase 1: Diagnóstico (IMEDIATO)
- [ ] Verificar logs da Vercel para identificar erros
- [ ] Testar o comando `/registrar` localmente
- [ ] Adicionar logs de debug para rastrear o fluxo

### Fase 2: Correções (CURTO PRAZO)
- [ ] Melhorar logging em `processDoseRegistration`
- [ ] Adicionar validação de estoque
- [ ] Adicionar tratamento de erro mais robusto
- [ ] Adicionar feedback ao usuário em caso de erro

### Fase 3: Validação (APÓS IMPLEMENTAÇÃO)
- [ ] Testar o comando `/registrar` com estoque suficiente
- [ ] Testar o comando `/registrar` com estoque insuficiente
- [ ] Testar o comando `/registrar` com usuário não vinculado
- [ ] Verificar se o registro é criado no banco

---

## 🎯 Próximos Passos

1. **Verificar logs da Vercel** - Usar `vercel logs --follow` para identificar erros em tempo real
2. **Testar localmente** - Executar o bot localmente e testar o comando `/registrar`
3. **Implementar correções** - Aplicar as soluções propostas
4. **Validar funcionamento** - Testar o comando após as correções

---

**Relatório gerado por:** Kilo Code (Code Mode)  
**Data de geração:** 2026-02-07  
**Versão:** 1.0
