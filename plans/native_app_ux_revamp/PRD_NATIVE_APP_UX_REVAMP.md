# PRD: Native App UX Revamp

> **Status:** PRD detalhado e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Documento complementar:** `plans/native_app_ux_revamp/MASTER_PLAN_NATIVE_UX_REVAMP.md`
> **Objetivo:** traduzir a visao de revamp UX do app mobile native em requisitos de produto, experiencia e sucesso

---

## 1. Contexto e problema

O app mobile native ja validou a camada funcional do MVP, mas ainda nao entrega com consistencia:

- uma hierarquia visual forte
- uma percepcao de qualidade premium
- uma leitura clara de prioridade clinica
- uma superficie preparada para monetizacao futura

O problema atual nao e "falta de funcionalidade". O problema e:

- valor percebido abaixo do potencial do produto
- telas com linguagem utilitaria e pouco memoravel
- pouca diferenciacao visual entre resumo, risco, acao e apoio

---

## 2. Oportunidade de produto

Uma experiencia mobile mais refinada deve:

- aumentar confianca do usuario
- reduzir esforco cognitivo para a primeira acao do dia
- melhorar recorrencia de uso
- preparar o terreno para revenue sem parecer oportunista

O app mobile pode se tornar a superficie mais forte do ecossistema desde que o redesign seja:

- incremental
- suportado por dados reais
- arquitetado antes de ser estilizado

---

## 3. Referencias visuais de produto

Este PRD usa como referencia visual oficial os seguintes assets:

- `plans/native_app_ux_revamp/app-new-dashboard.png`
- `plans/native_app_ux_revamp/app-new-treatment.png`
- `plans/native_app_ux_revamp/app-new-stock.png`
- `plans/native_app_ux_revamp/app-new-profile.png`

Esses arquivos existem para:

- ancorar discussoes de UX
- facilitar handoff entre agentes
- reduzir ambiguidade no que significa "tela mais premium"

Esses arquivos nao existem para:

- impor arquitetura de informacao nova
- obrigar paridade literal de layout
- autorizar features nao previstas pelo dominio atual

---

## 4. Objetivos de negocio

| ID | Objetivo | Metrica primaria |
|----|----------|-----------------|
| BN-UX-01 | Aumentar valor percebido do app mobile | Feedback interno positivo consistente |
| BN-UX-02 | Melhorar engajamento diario na tela Hoje | Maior taxa de registro apos abertura |
| BN-UX-03 | Tornar a gestao de estoque mais acionavel | Menor abandono em contexto de risco |
| BN-UX-04 | Preparar monetizacao responsavel | Slots de ads prontos sem regressao de UX |

---

## 5. Objetivos de experiencia

| ID | Objetivo | Resultado esperado |
|----|----------|-------------------|
| EX-UX-01 | Clareza imediata | O usuario entende o foco da tela em poucos segundos |
| EX-UX-02 | Menos ruido | Cada bloco comunica uma funcao clara |
| EX-UX-03 | Coerencia visual | As 4 telas parecem parte do mesmo produto |
| EX-UX-04 | Acao principal evidente | Hero cards e alertas criticos tem CTA inequvoco |
| EX-UX-05 | Leitura confortavel | Conteudo escaneavel em iOS e Android |

---

## 6. Perfis de usuario e contexto de uso

### Perfil principal

- adulto em tratamento continuo
- usa o app em micro-momentos ao longo do dia
- abre o app para confirmar algo, registrar algo ou verificar risco

### Contexto dominante

- uso rapido
- possivel ansiedade ou urgencia leve
- baixa tolerancia a densidade textual excessiva
- necessidade de ver primeiro o que importa

---

## 7. Jobs to be done por tela

### Hoje

Quando eu abro o app no meu dia a dia, eu quero:

- entender como estou no dia
- saber o que precisa de acao agora
- ver a agenda restante de forma simples

### Tratamentos

Quando eu reviso meus tratamentos, eu quero:

- entender rapidamente o estado dos meus protocolos
- perceber progresso e consistencia
- notar riscos adjacentes sem precisar mudar de tela

### Estoque

Quando eu olho meu estoque, eu quero:

- identificar criticidade imediatamente
- saber quantos dias/unidades restam
- agir para reposicao sem ambiguidade

### Perfil

Quando eu entro no perfil, eu quero:

- ver minha identidade e recursos pessoais
- acessar configuracoes utilitarias
- encontrar acoes de suporte, compartilhamento e preferencias

---

## 8. Principios de UX

1. A tela deve explicar seu proposito em menos de uma dobra.
2. Um bloco principal nao pode competir com dois CTAs do mesmo peso.
3. Status deve ser legivel por cor, texto e composicao.
4. Conteudo clinico tem prioridade sobre monetizacao.
5. Dados ausentes devem gerar degrade elegante, nao layout quebrado.

---

## 9. Definicao de sucesso por tela

### Hoje

- resumo diario compreensivel
- acao do momento clara
- agenda por periodo escaneavel
- risco de estoque visivel quando relevante

### Tratamentos

- resumo de adesao perceptivel
- cards de tratamento com progresso e status claros
- agrupamento por contexto clinico sem poluir

### Estoque

- alerta critico destacado
- itens criticos separados dos regulares
- CTA de reposicao sem duvida semantica

### Perfil

- tela mais utilitaria e menos "lista de tecnicalidades"
- preferencias e acoes relevantes encontraveis de primeira
- espaco para futuras funcoes sem parecer vago

---

## 10. Requisitos funcionais por tela

### 9.1. Hoje

**Obrigatorios**

- resumo do dia com adesao ou score equivalente
- bloco de prioridade do momento
- agenda agrupada por periodo (`manha`, `tarde`, `noite` quando aplicavel)
- CTA de registro no bloco prioritario
- suporte a stale/loading/error/empty

**Desejaveis**

- micro-indicadores de progresso do dia
- destaque suave para dose concluida

### 9.2. Tratamentos

**Obrigatorios**

- bloco de resumo geral
- listagem de protocolos ativos
- visual de progresso ou regime
- status do tratamento
- risco adjacente de estoque quando aplicavel

**Desejaveis**

- agrupamento por linha terapeutica ou categoria sem inventar taxonomia se o dado nao existir

### 9.3. Estoque

**Obrigatorios**

- resumo de criticidade
- separacao visual entre critico e regular
- leitura de dias restantes/unidades restantes
- CTA de reposicao em itens criticos quando houver acao valida

**Desejaveis**

- copy contextual para tranquilidade no estoque regular

### 9.4. Perfil

**Obrigatorios**

- identificacao do usuario
- superficie clara para notificacoes
- acoes utilitarias principais
- integracao com recursos ja existentes como Telegram e logout

**Desejaveis**

- blocos extensíveis para PDF, historico e compartilhamento

---

## 11. Requisitos nao funcionais

- compatibilidade com `StyleSheet`
- sem dependencia nova de styling
- navegacao atual preservada
- acessibilidade minima aceitavel
- contraste adequado para badges e CTAs
- componentes preparados para iOS e Android
- execucao incremental por sprint

---

## 12. Requisitos de monetizacao

1. Ads sao camada secundaria
2. Nenhuma insercao de ad pode competir com CTA clinico principal
3. Placements reservados devem existir antes da ativacao real do provider
4. A primeira entrega usa placeholder e contrato neutro
5. Ativacao real de provider fica em wave posterior

---

## 13. Metricas de sucesso

### Metricas de produto

- aumento da acao principal registrada em `Hoje`
- maior frequencia de visita as telas `Hoje` e `Tratamentos`
- melhor navegabilidade percebida em validacao manual

### Metricas de experiencia

- tempo reduzido para identificar o foco da tela
- menor confusao entre blocos informativos e acionaveis
- maior consistencia visual percebida entre vistas

### Metricas de monetizacao foundation

- slots integrados sem colisao com conteudo clinico
- zero regressao de clareza apos introducao dos placeholders

---

## 14. Riscos de produto

| Risco | Impacto | Mitigacao |
|------|---------|-----------|
| Copiar os mocks literalmente | Alto | Preservar IA atual e adaptar apenas a linguagem visual |
| Introduzir features sem dados reais | Alto | Usar mapeamento de readiness e degrade |
| Ads degradarem confianca | Alto | Guardrails de placement e ativacao tardia |
| Redesign virar iniciativa aberta demais | Medio | Waves e sprint plan prescritivos |
| Cada tela virar um estilo isolado | Alto | Fundacao visual obrigatoria antes das telas |

---

## 15. Exclusoes

- nova arquitetura de menu principal
- dark mode
- animacoes avancadas
- redesign da web
- ativacao definitiva de ads
- reescrita de dominio server-side por motivacao apenas visual

---

## 16. Traceability matrix requisito -> wave/sprint

| Requisito | Wave/Sprint |
|-----------|-------------|
| Fundacao de componentes base | UX.2 |
| Resumo + CTA principal em `Hoje` | UX.3 |
| Agenda segmentada por periodo | UX.3 |
| Resumo editorial de tratamentos | UX.4 |
| Progresso e status por protocolo | UX.4 |
| Criticidade primeiro em `Estoque` | UX.5 |
| CTA de reposicao em itens criticos | UX.5 |
| Perfil como hub utilitario | UX.6 |
| Placeholder de ads e contrato | UX.7 |
| Hardening, testes e consistencia | UX.8 |

---

## 17. Criterio de aceite geral do PRD

O PRD desta iniciativa esta satisfeito quando:

1. as 4 telas principais tiverem objetivo, foco e hierarquia claros
2. a fundacao visual estiver consolidada antes de monetizacao
3. as decisoes aspiracionais estiverem separadas dos dados realmente disponiveis
4. a execucao puder acontecer por sprints pequenos e rastreaveis
