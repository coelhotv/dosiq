# Runbook — rastro da superfície contínua Android (spec 084)

> **Para quê:** saber se a superfície Android (a notificação contínua da dose crítica, spec 039)
> transicionou. Cada transição real grava uma linha `surface_transitioned` com `platform='android'` em
> `dose_critical_events` (CON-031). Esta consulta lê a **ausência**, e não existe leitor automático
> (spec 084, D1).
>
> **Quando rodar:** sob demanda, ou ao investigar "a superfície parou". Só a partir do **T0**: o
> primeiro dia com pelo menos 1 aparelho Android ativo numa versão que contém a 084. Antes do T0 não
> existe emissor na frota, e ausência não é sinal (AP-354).

## O que cada linha prova

| `platform` | Quem escreve | Prova | **Não** prova |
|---|---|---|---|
| `server` (iOS) | `dispatchLiveActivityLifecycle` | o servidor enviou o push ao APNs | que a Live Activity mudou na tela |
| `android` | o aparelho, quando o JS roda na entrega | o SO entregou o boundary e o JS rodou | que a pessoa viu o card |

Nunca some as duas plataformas num número só. `detail` = `{from, to, source}`, com
`source ∈ {boundary, app, alarm}`: `boundary` é o trigger entregue, `app` é a primeira exibição pelo
app e `alarm` é a reconciliação pelo alarme entregue em background.

## Parâmetros

- `versions`: as `app_version` que contêm a 084 (a partir do pacote 0.34.0).
- `since`: o T0, ou o início da janela de interesse.
- A janela termina **48 h antes de agora**. A linha só entra no banco no próximo foreground do
  aparelho (p50 de 22,5 h medido no `alarm_fired`). O tempo vem sempre de `occurred_at`, nunca de
  `created_at`.

## 1. Ausência (o leitor da spec, PO-6)

```sql
with params as (select array['0.34.0']::text[] as versions, timestamptz '2026-11-01' as since),
dev as (
  select distinct nd.user_id from notification_devices nd, params p
  where nd.platform = 'android' and nd.is_active and nd.app_version = any(p.versions)
    and nd.last_seen_at > p.since),
consent as (  -- último granted/revoked; sem linha = não revogado (espelha useConsentSuppressed)
  select distinct on (user_id) user_id, action from consent_log
  where consent_type = 'health_data' and action in ('granted','revoked') and user_id is not null
  order by user_id, seq desc),
eligible as (
  select di.id from dose_instances di
  join dev on dev.user_id = di.user_id
  left join consent c on c.user_id = di.user_id
  left join medicine_logs ml on ml.id = di.medicine_log_id
  cross join params p
  where di.critical_alarm
    and di.scheduled_for >= p.since and di.scheduled_for < now() - interval '48 hours'
    and coalesce(c.action, 'granted') <> 'revoked'
    -- tomada antes de entrar em `now` (T−10): a superfície encerra, e é correto não haver `now`
    and not (ml.taken_at is not null and ml.taken_at < di.scheduled_for - interval '10 minutes')),
seen as (
  select distinct dose_instance_id from dose_critical_events
  where event = 'surface_transitioned' and platform = 'android' and detail->>'to' = 'now')
select (select count(*) from dev) as usuarios_com_aparelho,
       count(*) as elegiveis,
       count(s.dose_instance_id) as com_now,
       count(*) - count(s.dose_instance_id) as sem_now,
       array_agg(e.id) filter (where s.dose_instance_id is null) as ids_sem_now  -- ids, sem PII
from eligible e left join seen s on s.dose_instance_id = e.id;
```

Publique sempre o **denominador** (`elegiveis`) junto da razão. `usuarios_com_aparelho = 0` significa
que o T0 não chegou, e o resultado não vale.

**Baseline pré-084 (2026-10-11):** na frota de cliente (Android 0.30.1), 4 usuários e **0 elegíveis**
(nenhum deles tem dose crítica). Versões acima de 0.30.1 (0.33.x) são builds de dev/preview em contas
de smoke: incluí-las deu 90 elegíveis, 0 com `now`, 90 sem. Isso serve para validar a consulta, **não**
como medida de cliente.

**Cliente = canal `production` do EAS** (inclusive as faixas alpha/beta da loja). `development`,
`preview` e `device` são canais de teste. O canal **não** fica gravado no banco: `notification_devices`
não tem essa coluna (conferido em 2026-10-11). Por isso o filtro possível aqui é `versions` = as
versões publicadas pelo canal `production`.

## 2. Repetição (guard do SC-002, ≤ 1 %)

Instâncias com soneca ficam de fora. Depois da soneca, a superfície reaparece em `now` e pode voltar
a `late`. São transições reais, e o PO decidiu emiti-las (spec 084, F-B).

```sql
select count(*) as pares, count(*) filter (where n > 1) as repetidos,
       round(100.0 * count(*) filter (where n > 1) / nullif(count(*), 0), 2) as pct
from (
  select e.dose_instance_id, e.detail->>'to' as t, count(*) as n
  from dose_critical_events e
  where e.event = 'surface_transitioned' and e.platform = 'android'
    and e.occurred_at >= timestamptz '2026-11-01'  -- T0
    and not exists (select 1 from dose_critical_events s
                    where s.dose_instance_id = e.dose_instance_id and s.event = 'snoozed')
  group by 1, 2) x;
```

Volume (SC-003): mais de 40 linhas android por dia indica que o dedupe falhou.

## Limitações (imprimir junto do resultado)

Ausência quer dizer **"sem evidência"**, nunca **"falhou"**:

1. **O JS headless não rodou, mas o card foi exibido.** O SO pode exibir o boundary e o processo
   morrer antes do handler. O resultado é ausência de linha com a superfície funcionando.
2. **Fila perdida.** Se o app for desinstalado ou os dados forem limpos antes do flush, o evento se
   perde. Logout também apaga a fila local (spec 091, por allowlist).
3. **Sem sessão no headless.** Sem dono resolvível, o evento não é enfileirado (CON-031 proíbe
   órfão).
4. **Capacidade do canal não é medida aqui.** Canal desabilitado, importância efetiva e Doze são o
   FR-015a/T070b da 082 (loja). Esta consulta responde *transicionou?*; aquela responderá *podia
   transicionar?*.
