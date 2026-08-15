# plans/specs/ — Índice de Status (fonte de verdade)

> **Propósito:** agentes/consultores NÃO devem inferir o status de uma spec pelo header dela
> (histórico de drift: 001 dizia "Dev Ready" já entregue). **Este README é o índice canônico**;
> o header `**Status**` de cada spec deve espelhá-lo. Divergência → vale o README + evidência (PR#).
>
> **Manutenção (R-275):** todo C5 pós-merge que entrega (total ou parcialmente) uma spec DEVE
> atualizar (1) a linha desta tabela com o PR# e (2) o header `**Status**` da spec. Distill (D5)
> reconcilia.
>
> **Regra de tamanho — 1 linha ≈ 1-3 frases.** Este é um índice, não o registro da entrega.
> Histórico completo (achados, decisões passo-a-passo, trechos de código) mora no journal DEVFLOW
> (`.agent/memory/journal/`) e no PR de cada entrega — **nunca duplicar aqui**. Numa linha, escrever
> só: (1) PR#/commit; (2) 1 frase do que foi entregue; (3) referências `AP-NNN`/`R-NNN`/`ADR-NNN`
> **sem reexplicar o conteúdo delas** — quem quiser o porquê abre a referência. Se a entrega tem
> fases/slices, listar só PR# de cada uma, não a narrativa de cada uma. Achado interessante mas fora
> do índice? Vai pro journal ou vira AP/R, não pra esta linha. Antes de commitar uma linha nova,
> perguntar: "isso cabe em 3 frases?" — se não, é o PR que está inchado, não a linha que precisa de
> mais espaço.

## Vocabulário canônico (único permitido)

| Status | Significado |
|--------|-------------|
| `draft` | ideia/rascunho; não passou por specifying completo ou aguarda clarificação/priorização |
| `specified` | spec.md completa (S6); sem plan/tasks |
| `planned` | plan.md + tasks.md prontos (P4); aguarda coding |
| `in-progress` | coding iniciado; PRs parciais mergeados (anotar fases entregues) |
| `delivered` | 100% mergeado em prod (anotar PRs) |
| `superseded` | substituída/absorvida por outra spec (apontar qual) |

## Tabela de status (atualizada 2026-08-15)

| # | Spec | Status | Evidência / Nota |
|---|------|--------|------------------|
| 001 | native-alarm-persistent | **delivered** | Alarme v1, base da 010. Sem PR registrado (2026-06-03) |
| 002 | caregiver-demand-teaser | draft | |
| 003 | patient-dose-history | **delivered** | PR #641 |
| 004 | expanded-adherence-dashboard | draft | PO 2026-06-10: não entregue como spec'ado |
| 005 | consultation-mode-profile | draft | Absorve parte da 012 (líquidos/injetáveis + tendência biomarkers) |
| 006 | public-emergency-qr-card | draft | Absorve parte da 012 (líquidos/injetáveis em meds críticos) |
| 007 | medical-pdf-report | planned | Absorve Fase E da 012 (dose×biomarcador) + líquidos/injetáveis |
| 008 | complete-data-export-lgpd | **delivered** | PR #743. Export LGPD completo (mobile nativo + hub web). AP-291, R-291 |
| 009 | caregiver-mode | **specified** | Próximo grande épico do roadmap; não implementado |
| 010 | native-alarm-v2 | **delivered** | PR #634. ADR-055/056 |
| 011 | notifications-from-instances | **delivered** | PR #633. ADR-057 |
| 012 | diabetes-t2-support | **delivered** | PRs #658-667. ADR-058..068. Fase E descoped → 005/006/007/008 |
| 013 | whatsapp-bot-adapter | draft | |
| 014 | whatsapp-templates-webhook | draft | |
| 015 | ai-chatbot-mobile | **delivered** | PRs #684-687. ADR-074, CON-028. Chat IA nativo web+mobile+Telegram |
| 016 | voice-dose-registration | draft | |
| 017 | voice-dose-summary | draft | |
| 018 | anvisa-interactions-local | draft | |
| 019 | universal-links-web-banner | **delivered** | PR #607 |
| 020 | notification-copy-metrics | specified | dev ready, não iniciado |
| 021 | telegram-snooze-dose | specified | dev ready, não iniciado |
| 022 | liquid-medications | **delivered** | PRs #650-652 |
| 023 | user-feedback | **delivered** | PRs #639/#640 |
| 024 | node22-upgrade | **delivered** | PRs #642/#643 |
| 025 | fix-notifications-alarms | **delivered** | PRs #644-647 |
| 026 | activation-strategy | **in-progress** | Fase 1 (nudges in-app) entregue PR #653; demais fases pendentes |
| 027 | topical-ointments | draft | não iniciar sem priorização do PO |
| 028 | nudges-admin | **in-progress** | PR #654 (payload builder) mergeado; restante pendente |
| 029 | treatment-level-titration | **delivered** | Épico fechado (F1-F6, PRs #746-751/#757/#758/#760/#765). Reescopado 2026-07-16 de migração p/ construção (titulação N1 nunca funcionou em prod — AP-301). ADR: motor+CHECK anti-zumbi em prod. R-296, R-300. Dívida: push das 08:00 sem prova de execução (T030) |
| 030 | fix-dose-history | **delivered** | PR #668. AP-231 |
| 031 | injection-site-rotation | **delivered** | PR #675. ADR-072, CON-026 |
| 032 | biomarker-pa | **delivered** | PRs #669/#670. ADR-070 |
| 033 | mobile-history-timeline-refactor | **delivered** | PR #671. AP-193, ADR-054 |
| 034 | gemini-sunset | **in-progress** | A/B/C entregues (PRs #752-754). ADR-069 accepted. Falta 034-D (medição passiva) → decisão T051 do PO |
| 035 | unified-dose-log-stock-core | **delivered** | PR #673. ADR-071, CON-026. AP-236 |
| 036 | fix-alarm-stale-snooze | **delivered** | PR #672. AP-235. Mobile-only |
| 037 | anvisa-web-ondemand | **delivered** | PRs #682/#683. ADR-073, CON-027. AP-242 |
| 038 | refactor-web-structure | **delivered** | PRs #677-680. R-279, AP-238/239/240. Refator puro |
| 039 | dose-state-machine | **in-progress** | F0-F3 entregues (PRs #689-#694). ADR-075, CON-024/029/030. Live Activities iOS+Android em prod. Falta F4 (smoke consolidado + decisão go/no-go v2, T041) e F5 (housekeeping de canais/deadcode) |
| 040 | typescript-migration | **delivered** | Épico completo 6 fases, PRs #702-731. Monorepo 100% TS. R-283/284 |
| 041 | ios-push-to-start | **delivered** | PRs #696/#697/#701. ADR-076, CON-030. Verificado em prod 2026-08-15: provider `apns_liveactivity` com 21 devices ativos ⇒ migração e registro de token push-to-start funcionando (as pendências antes listadas estavam stale). Dívida: smoke formal em device iOS nunca registrado |
| 042 | critical-audit-trail | **delivered** | PRs #699-701. ADR-077, CON-031. AP-258/259 |
| 043 | notify-improvements | **delivered** | Slice B PR #733 (AP-273) · Slice A PRs #734 (outbox+drenador, ADR-078) e #742 (cutover do daily_digest). Prod 2026-08-15: outbox viva, 1.268 linhas `sent`. `stock_alert` não migrou por decisão de modelagem (fan-out precisa de `subject_id`) → spec 050 |
| 044 | dose-only-mode | **delivered** | Épico completo 6 fases, PRs #735-740. Modo sem controle de estoque. AP-277/281-289, R-290 |
| 045 | fix-android-soloader-crash | **delivered** | Tier 1 — crash SoLoader Android 13 |
| 046 | lgpd-consent | **in-progress (A+B delivered)** | Slice A PR #744 · Slice B PR #745 (gate + política v0.3, merge único) + #755 (fix offline). AP-292/293, R-295. Prod 2026-08-15: 15 de 52 consentidas; as 37 restantes nunca viram o gate (33 com último login anterior a 15/07) e **não são candidatas a prune** — o Slice C só alcança quem revogou. **Falta Slice C** (prune pós-revogação): zero código |
| 047 | inapp-review-prompt | **specified** | Tier 1 — expo-store-review, gatilho streak≥7d. Aguarda coding |
| 048 | landing-glp1 | **specified** | Tier 1 — landing estática AEO/GEO/LLM-SEO. Aguarda coding |
| 049 | docs-revamp | **delivered** | Épico completo 5 fases (F1 schema, F2 frontmatter 54 docs, F3 JS→TS 58 docs, F4 limpeza estrutural, F5 14 docs novos + 2 rewrites). Commits finais: 339620b (sprint 5.3 part 2), 3e59fee (frontmatter fixes), a164a93 (INDEX.md regeneração). 73/73 docs validados |
| 050 | notification-integrity | **planned** | Follow-up da 043: fan-out da outbox (`stock_alert`, precisa de `subject_id`) + claim atômico do lembrete. Plano em 5 PRs (0 US4 · 1a infra · 1b fan-out · 2 expiry+cutover · 3 claim), droppabilidade 3→2→1b→1a, PR 0 nunca. US4 = bug ativo em prod (alerta de tratamento encerrado); raiz na 064 |
| 051 | expo-updates | **051-A delivered · 051-B ~1 sessão** | OTA (EAS Update) + kill switch de versão. ADR-082/083/091, [[CON-033]]. **051-A** nos PRs #775-#779 + #781. **051-B conciliada 2026-08-15**: guias operacionais, FR-019 e registro no INDEX já estavam feitos e não marcados; PO-SEC-2 fechada por auditoria do bundle (zero secret, único JWT é `role=anon`). Resta T011 (regra de elegibilidade OTA × loja + hook no SQP), T049 (`fleet-versions.sh`), doc curto e 2 atos do PO |
| 052 | dose-instance-medicine-snapshot | **delivered** (A+B+C) | Épico completo, PRs #761/#762/#764. ADR-084/085 (accepted). `dose_instances.medicine_id` snapshot (mata falsificação retroativa de histórico clínico). R-297, R-299, R-300. AP-308/309/310/311/313 |
| 053 | unit-label-formatter | **delivered** (Slice A PR #767 ab311429 · Slice B PR #768 6ca42da9) | Origem AP-306. Fonte única no core (`DOSAGE_UNIT_LABELS`/`INTAKE_UNIT_LABELS`, lado direito) + gate `unit-label-gate.sh` + PO-1..6 fechados (PO-3 no Slice B: 19 sites reais — 4 do E1 + 3 copy + 12 interpolação pura invisível ao grep — + `isLiquidDosageUnit` novo no core). Valores de banco/enum intocados (AP-299/R-295). Épico completo |
| 054 | critical-alerts | **planned** | iOS Critical Alerts (dose crítica toca em silencioso/Focus). ADR-086 proposed. Slice 2 (push remoto) condicional a R-296. Aguarda coding |
| 055 | expo-55-target-api-36 | **W1 delivered · W2 planned** | W1 mergeada (PRs #770-#774, #781, mobile v0.30.0): SDK 54 + target API 36 + firebase→Sentry/PostHog (ADR-090) + edge-to-edge + 051-A. **A exigência do Play (API 36) está cumprida — a W2 não tem prazo** (confirmado pelo PO 2026-08-15). W2 = SDK 55 → v0.31.0 + US8 (`StatusBar.currentHeight` → `useSafeAreaInsets()` em `AlarmFullScreen` + 14 sheets). Orientação/large screen → spec 061 |
| 056 | ai-review-tuning | **in-progress** | Tier 1 — tooling em repo externo (`ai-review.sh`); código da Fase 1 entregue em devflow `044fe1e`→`5a6b467` (clamp, filtro por pack em modo `auto`, liveness do agy, saída estruturada). PO-1/2/3 fechados 2026-08-02; SC-001 recalibrado (T027). Diferido e declarado: T014/PO-5 (A/B) sem veículo, e Fase 2 fechada por gate (parte migrou p/ 060) |
| 057 | device-activity-log | **delivered** | PR #769 (squash `1bd51566`). Heartbeat de app_version/atividade independente de push (R-239), tabela `device_activity` + RPC `upsert_device_activity` (ADR-089). 3/3 POs fechados com evidência real (iOS+Android). Recorrência AP-278 (anon EXECUTE) pega e corrigida ao vivo. RC5 1 auto-fix, RC6 clean (0 findings) |
| 058 | rc6-reflection-gate | **specified** | Tier 1 — tooling em repo externo (`ai-review.sh`). Gate determinístico pós-review ("falsificar, não verificar") com verificadores `tsc`/`information_schema` no lugar de um 2º LLM. Origem: 4 dos 8 PRs medidos no 034-D tiveram falso-positivo refutável por ferramenta. Fronteira: 056 = quanto contexto entra, 058 = qual finding sai |
| 059 | analytics-privacy | **draft** | Tier 2 provável. Scrubbing de dado clínico antes de sair do device (Sentry `beforeSend` + payloads PostHog) + analytics sob consentimento (046). Origem: PR 1.3b (ADR-090) — risco subiu quando o analytics passou a identificar o uid. Destrava por decisão jurídica; NÃO planejado |
| 060 | memory-yaml-enrich | **specified** | Tier 1 — frontmatter YAML padronizado em `.agent/memory/` + índice compilado (`compiled_rules_index.json`) + seletor (`select-rules.ts`). ⚠️ Roda **depois** da 058, não antes: a 058 em modo `annotate` produz o baseline de FP contra o qual o ganho desta spec é atribuível. Risco central é de governança — `layer: hot` é orçamento (≤15/8KB, FR-010..012) |
| 061 | large-screen-support | **specified** | Tier 1 provisório (>8 arquivos ou 2 colunas ⇒ Tier 2). Android 16 já ignora o lock de portrait em telas ≥600dp ⇒ o app roda em landscape hoje sem nunca ter sido testado. PO 2026-07-30: suportar de verdade, sem o opt-out `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` (dívida datada em targetSdk 37). Medido: 15 screens, zero `useWindowDimensions`. OQ-002: rodar depois da 055/W2 |
| 062 | android-notification-fidelity | **draft** | Tier a definir. 3 achados do `dumpsys` no smoke do #782, nenhum vindo de aviso de loja: (A) `bypassDnd` ignorado pelo SO — falta pedir `ACCESS_NOTIFICATION_POLICY`; (B) `USAGE_NOTIFICATION` em vez de `USAGE_ALARM` (notifee 9.1.8 não expõe `audioAttributes`); (C) push do servidor sem ícone/cor do dosiq. 🔴 Dimensiona pela **imutabilidade do canal Android**, não pelo nº de arquivos: exige id novo (`-v3`) criado após a concessão + migração idempotente. Par Android da 054. OQ-003 |
| 063 | zero-lint-regressions | **delivered** | Monorepo 100% Zero Lint (0 errors, 0 warnings). Épico completo em 13 PRs (#782-#794). Testes 164/164. Passada de fidelidade visual via constantes de módulo |
| 064 | stock-forecast-vigency | **draft** | Tier 2 provável. Raiz do bug recortado na US4 da 050: `calculateDailyIntake` (`adherenceLogic.ts:349`) filtra só `p.active` e ignora `end_date`/`paused_at` ⇒ tratamento encerrado conta como consumo vivo em 7 superfícies. A 050 corrige só o caminho de push. ⚠️ Dimensiona pelo PDF de consulta, que descreve período passado — precisa de vigência por data de referência, senão reescreve histórico (R-299). NC1/NC2 decidem o Tier. Sem migração |
| 065 | analytics-instrumentation-mobile | **planned** | Tier 2 por privacidade/LGPD (não toca banco nem UI). Fase 1 do analytics: fecha o mobile sob [[CON-034]]/[[ADR-090]] — 15 órfãos cabeados, `surface`+`treatment_id` do FATO (R-299), super property `mode`/`app_env`. RC3 fatiou em **4 PRs (A/B/C/D)**, droppabilidade D→C→B→A nunca; `plan.md`+`tasks.md` (30 tasks). ✅ **Desbloqueada** — `posthog-cli` instalado, autenticado e validado (T001a-d, 2026-08-13); armadilha dos dois prefixos documentada em `tasks.md` |
| 066 | camera-medicine-scan | **specified** | Tier 2 — épico multifases do spike `camera-medicine-capture.md`, mobile apenas. Tese: o gargalo do 1º cadastro é DADO, não captura — a CMED (26.001 apresentações, ~603 KB gzip) cabe no on-demand do [[CON-027]] sem infra nova; cascata L0 EAN → L1 OCR → L2 manual, sem LLM (parser cobre 92,0%). 🔴 Guardas clínicas medidas: ordem de dose indecidível em 5,5% dos compostos e laboratório não é identidade de genérico. 3 NC abertos; aguarda decisão do PO |
| 067 | critical-alarm-window-guard | **planned** | Tier 2 — dose crítica de 13:30 disparou alarme às 09:52 e virou `skipped_user` (prod 2026-08-14); `isDoseNotificationStale` só tem limite superior. Approach A: piso vira coluna `early_window_minutes` no mesmo `computeTolerances`, client só lê; agrega US6 (`skipped_user` invisível no histórico). **4 PRs** A1 visibilidade → A2 guarda+telemetria → B skip por RPC + `REVOKE UPDATE(status)` (ADR-092) → C *fired* vs *observed*, A1 nunca dropável. 22 POs, 64 tasks |
