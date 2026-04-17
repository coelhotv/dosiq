# Exec Spec Addendum: Native App UX Data Mapping

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/native_app_ux_revamp/EXEC_SPEC_NATIVE_APP_UX_ARCHITECTURE.md`
> **Objetivo:** separar o que ja existe em dados reais do que e aspiracional, evitando implementacao baseada em suposicao

---

## 1. Papel deste addendum

Este documento existe para impedir que agentes:

- inventem campos
- criem componentes dependentes de dados nao confiaveis
- acoplem UI a contratos inexistentes

Regra central:

- layout segue dados reais ou degrade explicito

---

## 2. Matriz por tela: bloco visual, dado, fonte, gap, acao

| Tela | Bloco visual | Dado exigido | Fonte atual | Gap | Acao |
|------|--------------|--------------|-------------|-----|------|
| Hoje | resumo diario | expected/taken/score | `useTodayData` | Baixo | mapear para VM |
| Hoje | prioridade do momento | doses `late/now` | `useTodayData` | Baixo | reaproveitar |
| Hoje | agenda por periodo | `zones` por janela | `useTodayData` | Medio | adapter visual |
| Hoje | alerta contextual | `stockAlerts` | `useTodayData` | Baixo | estilizar |
| Tratamentos | resumo geral | aderencia agregada | `useTreatments` ou derivado | Medio | criar adapter |
| Tratamentos | grupos terapeuticos | categoria/linha | parcial ou inexistente | Alto | degrade se nao houver |
| Tratamentos | progresso | regimen/protocol info | `useTreatments` | Baixo | mapear |
| Tratamentos | risco adjacente | sinais de baixo estoque | integracao parcial | Medio | opcional por sprint |
| Estoque | resumo de criticidade | itens criticos e contagem | `useStock` | Baixo | mapear |
| Estoque | dias restantes | previsao/estoque | `useStock` | Baixo | reaproveitar |
| Estoque | CTA reposicao | acao valida | depende do produto | Medio | placeholder de acao se necessario |
| Perfil | identidade | email/user info | `useProfile` | Baixo | reaproveitar |
| Perfil | notificacoes | settings atuais | `useProfile` + screen dedicada | Baixo | reaproveitar |
| Perfil | recursos utilitarios | Telegram, logout, PDF | parcial | Medio | organizar em cards |
| Perfil | emergencia/modo consulta | contratos dedicados | inexistente | Alto | adiar/degradar |
| Todas | ads | slot/flag | inexistente no dominio | Medio | contrato neutro de UI |

---

## 3. Campos existentes reaproveitaveis

### Hoje

- `stats.expected`
- `stats.taken`
- `stats.score`
- `zones.late`
- `zones.now`
- `zones.upcoming`
- `zones.done`
- `stockAlerts`

### Tratamentos

- identificadores de tratamento
- nome do medicamento
- frequencia, dose, horarios ou metadados equivalentes
- informacoes de progresso se presentes no service atual

### Estoque

- listas `active` e `inactive`
- saldo
- previsao de dias
- rotulos de status

### Perfil

- `user.email`
- `settings`
- preferencias de notificacao
- Telegram link/token flow

---

## 4. Gaps permitidos sem backend novo

Permitidos por degrade:

- agrupar tratamentos por categoria visual sem taxonomia formal
- usar copy editorial apoiada em campos existentes
- transformar alerta de estoque em destaque visual mais forte
- reservar blocos patrocinados como placeholder

---

## 5. Gaps que exigem contrato novo

Exigem decisao explicita de produto ou backend:

- cartao de emergencia funcional
- modo consulta com compartilhamento rapido real
- compra/reposicao integrada
- taxonomia clinica oficial para grupos terapeuticos
- provider real de ads com telemetria

Regra:

- nenhum desses itens bloqueia o redesign base

---

## 6. Decisoes para placeholders temporarios

### Permitidos

- `AdSlotCard` como placeholder
- CTA de reposicao com label neutra se ainda nao houver fluxo forte
- blocos utilitarios em `Perfil` com copy "em breve" somente se estiverem fora do caminho critico

### Nao permitidos

- metricas falsas
- grupos clinicos inventados
- card de emergencia com dados ficticios

---

## 7. Regras para esconder, degradar ou adiar

### Esconder

Quando:

- dado nao existe
- dado e inconsistente
- o bloco criaria falsa promessa

### Degradar

Quando:

- existe dado parcial
- o bloco ainda agrega valor sem promessa excessiva

### Adiar

Quando:

- o bloco depende de nova feature ou contrato
- o custo de fakear o estado seria alto

---

## 8. Mapeamento especifico de blocos

### Adesao diaria

- fonte real existente
- pode virar `MetricRingCard` ou resumo equivalente

### Prioridade do momento

- fonte real existente
- deve nascer das zonas `late + now`

### Agenda do dia

- fonte real existente
- exige adapter para periodos visuais

### Grupos terapeuticos

- dado fraco/inconsistente
- usar apenas se houver fonte robusta

### Progresso de tratamento

- parcialmente existente
- pode ser textual antes de virar barra perfeita

### Dias restantes de estoque

- fonte funcional existente
- pilar do redesign de `Estoque`

### Recursos de perfil

- parte existe
- deve ser reorganizada em cards utilitarios

### Emergencia / modo consulta

- aspiracional
- fora do baseline real
- adiar ate decisao formal

### Ads

- sem dado de provider agora
- usar contrato neutro

---

## 9. Criterio de aceite de readiness

O mapeamento desta iniciativa estara correto quando:

1. cada bloco visual souber de onde vem seu dado
2. cada gap tiver uma acao clara: usar, degradar ou adiar
3. nenhum sprint de tela depender de backend inventado
