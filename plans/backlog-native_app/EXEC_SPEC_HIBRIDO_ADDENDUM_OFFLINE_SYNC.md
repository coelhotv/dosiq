# Exec Spec Hibrido - Addendum: Offline e Sync do Mobile

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Consumido por:** Fase 5 e Fase 6
> **Objetivo:** congelar a politica de conectividade, cache e sincronizacao do app mobile para evitar promessas de offline que a arquitetura ainda nao suporta

---

## 1. Papel deste addendum

O mobile inevitavelmente enfrentara:

- rede lenta
- perda temporaria de conectividade
- retorno do app apos longo tempo em background

Este documento define o que o produto faz e o que ele **nao** faz nesta etapa.

Sem isso, agentes menores tendem a:

- prometer offline write sem fila real
- fazer optimistic update inseguro
- misturar cache de leitura com fonte de verdade
- esconder do usuario que os dados estao stale

---

## 2. Decisao congelada

### OS-001. O mobile e online-first com leitura resiliente

Leitura correta:

- o app tenta operar online sempre que possivel
- o app pode mostrar ultimo snapshot local de leitura em algumas telas
- o app **nao** suporta escrita offline nesta etapa

### OS-002. Nao existe fila de mutacoes offline no MVP

Nao implementar nesta etapa:

- outbox local
- replay de mutacoes
- merge de conflito de escrita
- CRDT

### OS-003. Fonte de verdade continua remota

Supabase continua sendo a fonte de verdade.

Cache local serve para:

- performance
- resiliencia de leitura
- reabertura mais suave do app

### OS-004. Dados stale devem ser explicitados

Se o app mostrar dados de cache sem conexao:

- a UI deve deixar isso claro

Exemplos aceitos:

- selo `Atualizado ha pouco`
- aviso `Sem internet - mostrando ultima sincronizacao`

### OS-005. Logout limpa estado local sensivel

Ao deslogar:

- sessao sensivel deve ser removida
- caches locais associados ao usuario devem ser invalidados quando houver risco de vazamento entre contas

---

## 3. Politica de leitura por area do MVP

## 3.1. `Hoje`

Pode exibir ultimo snapshot conhecido se:

- a leitura recente existir
- o usuario for o mesmo

Deve sinalizar stale quando:

- nao conseguiu atualizar da rede

## 3.2. `Tratamentos`

Pode exibir ultimo snapshot conhecido com stale badge.

## 3.3. `Estoque`

Pode exibir ultimo snapshot conhecido com stale badge.

### Regra

Como estoque pode induzir decisao errada, stale state deve ser especialmente explicito.

## 3.4. `Perfil`

Preferir leitura online quando a acao altera vinculacoes ou preferencias.

---

## 4. Politica de escrita

## 4.1. Registro de dose

Se nao houver conectividade efetiva:

- a acao deve ser bloqueada
- o usuario deve ver mensagem clara
- a UI pode oferecer `Tentar novamente`

### Regra

Nao simular sucesso local e sincronizar depois.

## 4.2. Alteracao de preferencia e vinculacoes

Mesma regra:

- sem conectividade, nao confirmar alteracao

## 4.3. Refresh manual

Pull-to-refresh e aceito como mecanismo de recovery.

---

## 5. Gatilhos obrigatorios de sincronizacao

O app deve tentar refresh quando:

1. abre a tela pela primeira vez na sessao
2. usuario faz pull-to-refresh
3. app volta do background apos janela relevante
4. mutacao bem sucedida invalida o dado relacionado

### Janela recomendada

Comecar com limiar simples, por exemplo:

- mais de 60 segundos fora de foreground para `Hoje`
- mais de 5 minutos para listas menos criticas

### Regra

Nao dar refresh agressivo em toda troca de foco de aba sem necessidade.

---

## 6. Storage e segregacao de dados

## 6.1. `SecureStore`

Usar apenas para:

- sessao auth
- segredos curtos e sensiveis

## 6.2. `AsyncStorage`

Usar para:

- cache de leitura nao sensivel
- metadados de stale time
- pending intent leve aprovado

### Regra

Nao gravar dumps arbitrarios do estado global do app sem contrato.

---

## 7. Estados obrigatorios de UX de rede

Cada tela critica do MVP deve prever:

- loading inicial
- empty state
- erro online
- stale offline state
- retry state

### Exemplo de copy aceitavel

- `Sem conexao. Mostrando ultima sincronizacao disponivel.`
- `Nao foi possivel registrar a dose sem internet.`

### Proibido

- spinner infinito
- lista vazia silenciosa quando a falha foi de rede
- toast tecnico sem contexto para o usuario

---

## 8. Ownership por fase

## 8.1. Fase 5 deve sair com

- politica online-first aplicada ao MVP
- stale states claros
- escrita bloqueada sem conectividade
- refresh manual simples

## 8.2. Fase 6 deve sair com

- sync de `notification_devices` tratando falhas de rede sem corromper estado
- refresh de preferencias respeitando conectividade

---

## 9. Testes obrigatorios

- tela de `Hoje` com cache local e sem rede
- tela de `Tratamentos` com cache local e sem rede
- `Estoque` sem rede exibindo stale state
- tentativa de registrar dose offline falha com mensagem correta
- logout limpa sessao e invalida caches de usuario quando aplicavel

### Teste manual obrigatorio

1. abrir app online e carregar dados
2. fechar rede
3. reabrir `Hoje`
4. validar stale state
5. tentar registrar dose
6. validar bloqueio correto
7. voltar a rede
8. executar refresh manual

---

## 10. Itens explicitamente adiados

- offline write queue
- reconciliacao de conflito
- sincronizacao em background robusta
- estrategia de outbox
- merge offline-first real

Se estes itens se tornarem prioridade, eles devem entrar na Fase 8 ou em addendum proprio.

---

## 11. Ancoragem e validacao contra a master spec

- Este addendum preserva a fonte de verdade remota do projeto.
- Este addendum evita prometer offline alem do que a arquitetura suporta.
- Este addendum reduz risco clinico ao nao confirmar mutacoes sem rede.
- Este addendum se encaixa no MVP enxuto definido para o mobile.

Se qualquer implementacao derivada quebrar estes pontos, ela esta desalinhada com a estrategia hibrida do projeto.
