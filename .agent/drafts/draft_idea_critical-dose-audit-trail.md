# Draft Idea: audit trail de ciclo de vida de dose crítica (debug-first)
**Created**: 2026-07-02
**Status**: draft (pre-specifying)
**Suggested Tier**: 2 (migração + cross-plataforma web/mobile/server + toca contrato de notificação)

## Contexto
Debug de dose crítica hoje é cego pós-fato: `adb dumpsys`/`logcat` (efêmero, exige device plugado)
+ SQL só do estado FINAL (`dose_instances.status`), sem a TRAJETÓRIA. Incidente 2026-07-02: ~1h pra
descobrir que um alarme Android "não chegou" por `importance=NONE` (notificações bloqueadas no app) —
achado que o server JAMAIS veria; só o device sabe.

## Premissas Identificadas
- [x] Cliente = A (dev/PO), debug-trail. Cliente B (paciente/cuidador, log on-screen) = épico 009 FUTURO, NÃO agora.
- [x] Tabela desenhada reutilizável p/ 009 (colunas genéricas), MAS zero UX/RLS-leitura/i18n neste wedge (YAGNI).
- [x] Custo real do status quo: rastro morre pós-fato; relato remoto de usuário = indebugável.
- [x] Único mecanismo de infra NOVA = beacon device com fila offline (alarm_fired/suppressed/nag).
      Todo o resto = emit ~1 linha em sites que JÁ dão round-trip ao server.

## Forcing Questions

### I1: Demand Reality
> Q: quem fica fodido se não existir amanhã — cliente A (debug) ou B (user-facing)?
> A: wedge = debug-trail (A). B = épico 009 futuro; deixar tabela reutilizável, mas spec de agora só audit debug.
> Push aplicado: separei A (demanda comportamental forte: 1h de arqueologia hoje) de B (hipótese, zero evidência).
> Operador confirmou A como wedge.

### I2: Status Quo
> Q: consegue reconstruir "alarme não tocou ontem" sem device na mão nem logcat do momento?
> A: "não tem rastro nem como debugar sem o simulador conectado 100% do tempo; device do usuário = frustração muda".
> → custo confirmado: indebugável pós-fato. Justifica trail server-side persistente.

### I3: Narrowest Wedge
> Q: qual ÚNICO evento teria encerrado a caçada de hoje em uma query?
> A (agente): alarm_delivery_outcome device-reported {fired|suppressed, reason, permission_snapshot}.
> Push do operador: snooze/nag/transições JÁ são processadas por app/server — por que não logar também?
> Refino aceito: custo real = TRANSPORTE, não a chamada. Eventos que já dão round-trip (snooze, resolve,
> push_sent/failed, scheduled, transition-via-push) = emit trivial, INCLUEM. Só alarm_fired/suppressed/nag
> (device possivelmente offline) exigem o mecanismo novo = beacon + fila local + flush no foreground.

## Wedge (final)
1. Tabela `dose_critical_events` append-only, reutilizável (event, platform, actor, detail jsonb, created_at, dose_instance_id).
2. Emits baratos em todo site que já toca o server (device-action + server-side).
3. 1 beacon device: fila local (AsyncStorage) + flush no foreground, carrega alarm_fired/suppressed/nag + permission_snapshot.

## Failure Patterns Identified
- Evitado "solution in search of a problem" no cliente B (cortado p/ épico 009).
- Evitado over-scope: gate contra construir UX/RLS-leitura do 009 agora.

## Decisão
proceed to specifying (Tier 2)

## Next Action (the assignment)
Rodar `/devflow specifying` p/ o wedge debug-audit-trail: definir os event types canônicos (enum),
o shape do `detail jsonb` por tipo, os sites de emit (write-path + read-path), e o contrato do beacon
offline (fila + flush). NÃO especificar nada do épico 009 (UX/leitura-paciente).
