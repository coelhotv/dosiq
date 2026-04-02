# Exec Spec Hibrido - Addendum: Privacy, Permissions e Compliance Mobile

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Consumido por:** Fase 4, Fase 6 e Fase 7
> **Objetivo:** congelar como o app mobile pede permissoes, trata dados sensiveis e se prepara para distribuicao sem vazamento de contexto clinico

---

## 1. Papel deste addendum

O projeto lida com dados de saude e adesao medicamentosa.

Mesmo antes de entrar em biometria ou HealthKit, ja existem riscos reais de:

- expor dados clinicos em logs
- pedir permissao cedo demais
- escrever textos de permissao inconsistentes
- mandar payload sensivel para terceiros sem decisao formal

Este documento define a postura minima obrigatoria.

---

## 2. Decisoes congeladas

### PPC-001. Permissao e sempre just-in-time

Permissao so deve ser pedida quando o usuario estiver perto de usar o recurso.

Nesta etapa, a permissao relevante e:

- notificacoes push na Fase 6

### PPC-002. Sem pre-prompt enganoso

Se houver pre-prompt interna, ela deve:

- explicar beneficio real
- dizer claramente o que sera pedido
- permitir recusa

### PPC-003. Dados clinicos nao entram em logs livres

Nao logar em texto aberto:

- nome completo + remedio + horario + contexto clinico detalhado
- payload medico completo
- tokens de push
- tokens de Telegram

Logs devem ser:

- minimizados
- sanitizados
- orientados a diagnostico tecnico

### PPC-004. Telemetria de terceiros nasce minimizada

Enquanto nao houver aprovacao formal:

- nao enviar payload clinico para analytics
- nao enviar campos de medicamento para ferramentas externas
- nao enviar tokens, chat ids ou conteudo sensivel

### PPC-005. Permissoes futuras permanecem bloqueadas

Continuam fora de escopo ate Fase 8:

- biometria
- HealthKit
- Google Fit
- camera
- contatos
- localizacao

### PPC-006. Store readiness comeca no beta

Mesmo antes de publicacao ampla, o projeto deve chegar ao beta com:

- rationale de permissao
- textos de privacidade consistentes
- mapeamento basico de dados coletados

---

## 3. Matriz de permissoes por fase

## 3.1. Fase 4

Nenhuma permissao sensivel alem do baseline da plataforma.

## 3.2. Fase 5

Nenhuma nova permissao obrigatoria.

## 3.3. Fase 6

Permissao relevante:

- notificacoes push

### Regra

Se notificacoes nao forem criticas naquele momento da UX, a permissao nao deve aparecer no primeiro frame do app sem contexto.

## 3.4. Fase 7

Migracao estrutural nao pode alterar textos, coleta ou escopo de permissao.

---

## 4. UX obrigatoria de permissao de notificacao

## 4.1. Fluxo recomendado

1. tela ou card explica o valor da notificacao
2. usuario toca em CTA explicito
3. app mostra pre-prompt curta
4. app chama permissao do sistema
5. resultado e refletido na UI

## 4.2. Copy exemplo aceitavel

Titulo:

- `Receber lembretes no celular`

Texto:

- `Vamos usar notificacoes para lembrar horarios dos seus remedios e avisos importantes do tratamento.`

CTA primario:

- `Permitir notificacoes`

CTA secundario:

- `Agora nao`

### Regra

Nao usar copy manipulativa, alarmista ou enganosa.

---

## 5. Politica de dados sensiveis

## 5.1. Dados que exigem cuidado especial

- medicamentos
- horarios de dose
- adesao
- estoque associado ao tratamento
- chat ids e tokens de vinculacao

## 5.2. O que pode ficar local

- cache minimo necessario para UX
- session tokens em `SecureStore`
- snapshots de leitura controlados em `AsyncStorage`

## 5.3. O que nao pode acontecer

- dump bruto de payload clinico em storage
- console logs com dados do usuario em producao
- screenshot automatizado com dado sensivel embutido em pipeline sem sanitizacao

---

## 6. Strings e configuracao de permissao

As strings de permissao devem viver em configuracao do app, preferencialmente:

- `app.config.js`

E nao espalhadas informalmente em varios pontos.

### Regra

Se iOS ou Android exigirem texto especifico, o texto deve ser:

- coerente com a UX do app
- curto
- verdadeiro

---

## 7. Compliance minima para beta interno

Antes de distribuir beta interno, o projeto deve ter:

- lista clara de dados usados pelo app
- lista clara de permissoes realmente pedidas
- decisao documentada sobre telemetria de terceiros
- decisao documentada sobre screenshots/logs em debug
- revalidacao de que nenhuma permissao fora de escopo foi adicionada

### Checklist minimo

- [ ] push e a unica permissao sensivel ativa nesta etapa
- [ ] nenhum dado clinico aparece em logs normais
- [ ] tokens nao aparecem em screenshots de documentacao
- [ ] textos de permissao estao alinhados com a funcao real

---

## 8. Crash e analytics

Se o projeto introduzir monitoramento de erro ou analytics no mobile antes da Fase 8:

- isso deve ser minimizado
- isso nao autoriza enviar payload clinico integral

Campos aceitaveis em geral:

- ambiente
- plataforma
- versao do app
- tipo de erro tecnico

Campos nao aceitaveis por padrao:

- nome do medicamento
- texto da notificacao clinica
- conteudo de tratamento do usuario

---

## 9. Ownership por fase

## 9.1. Fase 4 deve sair com

- configuracao preparada para strings de permissao
- postura de nao coletar permissao cedo demais

## 9.2. Fase 6 deve sair com

- UX de permissao de push correta
- estado de permissao refletido na UI
- logs de notificacao sanitizados

## 9.3. Fase 7 nao pode quebrar

- configuracao de permissao no mobile
- segregacao de segredos e envs

---

## 10. Testes obrigatorios

- fluxo de recusa de permissao
- fluxo de aceitacao de permissao
- logs sanitizados sem token
- tela de preferencia refletindo `granted`, `denied` e `undetermined`

### Teste manual obrigatorio

1. instalar build limpa
2. navegar ate ponto de pedir notificacao
3. validar que o pedido nao veio cedo demais
4. negar permissao
5. validar UI coerente
6. reabrir fluxo
7. permitir permissao
8. validar UI coerente e ausencia de logs sensiveis

---

## 11. Itens adiados

- biometria e seus textos
- HealthKit/Google Fit e seus consentimentos
- politica completa de publicacao em loja
- telemetria mais sofisticada com governanca formal

---

## 12. Ancoragem e validacao contra a master spec

- Este addendum preserva o escopo enxuto do MVP native.
- Este addendum respeita que push entra apenas na Fase 6.
- Este addendum nao antecipa biometria nem integracoes de saude.
- Este addendum reduz risco de vazamento de contexto clinico e operacional.

Se qualquer implementacao derivada quebrar estes pontos, ela esta desalinhada com a estrategia hibrida do projeto.
