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

## Tabela de status (atualizada 2026-07-30)

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
| 029 | treatment-level-titration | **done** | Épico fechado (F1-F6, PRs #746-751/#757/#758/#760/#765). Reescopado 2026-07-16 de migração p/ construção (titulação N1 nunca funcionou em prod — AP-301). ADR: motor+CHECK anti-zumbi em prod. R-296, R-300. Dívida: push das 08:00 sem prova de execução (T030) |
| 030 | fix-dose-history | **delivered** | PR #668. AP-231 |
| 031 | injection-site-rotation | **delivered** | PR #675. ADR-072, CON-026 |
| 032 | biomarker-pa | **delivered** | PRs #669/#670. ADR-070 |
| 033 | mobile-history-timeline-refactor | **delivered** | PR #671. AP-193, ADR-054 |
| 034 | gemini-sunset | **in-progress** | A/B/C entregues (PRs #752-754). ADR-069 accepted. Falta 034-D (medição passiva) → decisão T051 do PO |
| 035 | unified-dose-log-stock-core | **delivered** | PR #673. ADR-071, CON-026. AP-236 |
| 036 | fix-alarm-stale-snooze | **delivered** | PR #672. AP-235. Mobile-only |
| 037 | anvisa-web-ondemand | **delivered** | PRs #682/#683. ADR-073, CON-027. AP-242 |
| 038 | refactor-web-structure | **delivered** | PRs #677-680. R-279, AP-238/239/240. Refator puro |
| 039 | dose-state-machine | **in-progress** | PRs #688/#691-694. ADR-075, CON-024/029/030. Live Activities iOS+Android. Falta F5 housekeeping. v2 travado até 041 |
| 040 | typescript-migration | **delivered** | Épico completo 6 fases, PRs #702-731. Monorepo 100% TS. R-283/284 |
| 041 | ios-push-to-start | **in-progress** | Código completo (mobile 0.24.0). ADR-076, CON-030. Pendente: migração prod + chave APNs + smoke device iOS |
| 042 | critical-audit-trail | **delivered** | PRs #699-701. ADR-077, CON-031. AP-258/259 |
| 043 | notify-improvements | **delivered (Slice A+B)** | Slice B PR #733 (higiene notification_devices, AP-273). Slice A codado (branch feature/tese/043-slice-a) — outbox+cutover, ADR-078. Pendente: aplicar migração prod + push/PR |
| 044 | dose-only-mode | **delivered** | Épico completo 6 fases, PRs #735-740. Modo sem controle de estoque. AP-277/281-289, R-290 |
| 045 | fix-android-soloader-crash | **delivered** | Tier 1 — crash SoLoader Android 13 |
| 046 | lgpd-consent | **in-progress (Slice A delivered)** | Slice A PR #744 (consent_log append-only, RPCs SECURITY DEFINER). AP-292/293, R-295. Pendente: Slice B (gate signup+guards) e Slice C (prune D+90) |
| 047 | inapp-review-prompt | **specified** | Tier 1 — expo-store-review, gatilho streak≥7d. Aguarda coding |
| 048 | landing-glp1 | **specified** | Tier 1 — landing estática AEO/GEO/LLM-SEO. Aguarda coding |
| 049 | docs-revamp | **delivered** | Épico completo 5 fases (F1 schema, F2 frontmatter 54 docs, F3 JS→TS 58 docs, F4 limpeza estrutural, F5 14 docs novos + 2 rewrites). Commits finais: 339620b (sprint 5.3 part 2), 3e59fee (frontmatter fixes), a164a93 (INDEX.md regeneração). 73/73 docs validados |
| 050 | notification-integrity | **specified** | Follow-up da 043. Fan-out da outbox (stock_alert) + claim atômico do lembrete. US2 rebaixada P1→P3 (PO-5 fechado: zero duplicatas medidas em prod). Aguarda planning |
| 051 | expo-updates | **planned** (051-A) | OTA (EAS Update) + kill switch de versão. ADR-082/083/**091**. CON-033 desenhado. 🔴 Fatiada 2026-07-22 (pós ADR-088): **051-A** (binário) na Onda 1 da 055; **051-B** (processo) spec própria depois. 🔄 **Re-specificada 2026-07-25**: reconciliada com ADR-090 (FR-011/017/020 citavam Firebase, dropado) + FR-018 (kill switch) **projetado** — antes era só "config remota", sem tabela/grant/tela + FR-021 (superfície de config + painel admin, entrou na 051-A) + FR-022 (chassi de experimentação, documental). 📐 **Planning 2026-07-25**: ADR-091 escrito (proposed), `plan.md` criado, CON-033 desenhado, checklists preenchida. Bloqueiam o PR 1.5a: ADR-091 `accepted` (T004d) + RC3 sobre o delta (T004f) |
| 052 | dose-instance-medicine-snapshot | **delivered** (A+B+C) | Épico completo, PRs #761/#762/#764. ADR-084/085 (accepted). `dose_instances.medicine_id` snapshot (mata falsificação retroativa de histórico clínico). R-297, R-299, R-300. AP-308/309/310/311/313 |
| 053 | unit-label-formatter | **delivered** (Slice A PR #767 ab311429 · Slice B PR #768 6ca42da9) | Origem AP-306. Fonte única no core (`DOSAGE_UNIT_LABELS`/`INTAKE_UNIT_LABELS`, lado direito) + gate `unit-label-gate.sh` + PO-1..6 fechados (PO-3 no Slice B: 19 sites reais — 4 do E1 + 3 copy + 12 interpolação pura invisível ao grep — + `isLiquidDosageUnit` novo no core). Valores de banco/enum intocados (AP-299/R-295). Épico completo |
| 054 | critical-alerts | **planned** | iOS Critical Alerts (dose crítica toca em silencioso/Focus). ADR-086 proposed. Slice 2 (push remoto) condicional a R-296. Aguarda coding |
| 055 | expo-55-target-api-36 | **W1 entregue · W2 planned (replanejado 3×)** | Deadline Google Play 2026-08-30 (API 36). **Onda 1 mergeada (PR #781, mobile v0.30.0)** — SDK 54 + target 36 + `expo-file-system` + firebase→Sentry/PostHog (ADR-090) + edge-to-edge + 051-A. **Onda 2 = SDK 55 → v0.31.0** (a spec dizia 0.30.0; a W1 consumiu esse número). 🆕 **Ampliada 2026-07-30: a W2 absorve a US8** (APIs de janela depreciadas no Android 15 — aviso do Play sobre a v0.30.0; 5 das 6 origens são lib e morrem no RN 0.83, o código próprio é `AlarmFullScreen` + 14 sheets com `StatusBar.currentHeight` → `useSafeAreaInsets()`). FR-012/013/014, PO-8/PO-9, PR 2.2. Restrição de orientação/large screen do mesmo aviso → **spec 061** |
| 056 | ai-review-tuning | **in-progress** | Tier 1 — tooling em repo externo (`ai-review.sh`); código da Fase 1 entregue em devflow `044fe1e`→`5a6b467` (clamp, filtro por pack em modo `auto`, liveness do agy, saída estruturada). PO-1/2/3 fechados 2026-08-02; SC-001 recalibrado (T027). Diferido e declarado: T014/PO-5 (A/B) sem veículo, e Fase 2 fechada por gate (parte migrou p/ 060) |
| 057 | device-activity-log | **delivered** | PR #769 (squash `1bd51566`). Heartbeat de app_version/atividade independente de push (R-239), tabela `device_activity` + RPC `upsert_device_activity` (ADR-089). 3/3 POs fechados com evidência real (iOS+Android). Recorrência AP-278 (anon EXECUTE) pega e corrigida ao vivo. RC5 1 auto-fix, RC6 clean (0 findings) |
| 058 | rc6-reflection-gate | **specified** | Tier 1 — tooling em repo externo (ai-review.sh). Gate de reflexao determinístico pos-review: regra "falsificar, nao verificar" (adaptada do open-code-review, Apache-2.0) com verificadores `tsc`/`information_schema` no lugar de um 2o LLM. Origem: 4 dos 8 PRs medidos no 034-D tiveram falso-positivo caro, todos refutaveis por ferramenta. Fronteira com a 056: 056 = quanto contexto entra, 058 = qual finding sai |
| 059 | analytics-privacy | **draft** | Tier 2 (provável). Scrubbing de dado clínico antes de sair do device (Sentry breadcrumbs/beforeSend + auditoria de payloads PostHog) + analytics respeitar consentimento LGPD (spec 046). Achados da avaliação do PR 1.3b (ADR-090): risco subiu quando o analytics passou a identificar o uid. Pré-ideação — decisão jurídica de consentimento destrava US1. NÃO planejado |
| 060 | memory-yaml-enrich | **specified** | Tier 1 — padronização e enriquecimento do YAML frontmatter de memórias em .agent/memory/ + índice compilado (`compiled_rules_index.json`) + seletor cirúrgico (`select-rules.ts`). Fase 2 da Spec 056 (pré-processamento micro) e alimentador do RC6 antes do Reflection Gate da Spec 058. ⚠️ **NÃO é pré-requisito da 058 — roda DEPOIS dela** (2026-07-29): nenhum FR da 058 consome frontmatter/índice/seleção, e a 058 em modo `annotate` produz o baseline de FP contra o qual o ganho desta spec é atribuível. Risco central é de **governança, não técnico**: `layer: hot` é orçamento (≤15/8KB, FR-010..012), senão vira o catálogo da 056 de novo com YAML por cima |
| 061 | large-screen-support | **specified** | Tier 1 **provisório** (gate de reclassificação pós-auditoria: >8 arquivos ou decisão de 2 colunas ⇒ Tier 2). Origem: aviso do Play Console sobre a v0.30.0 (resizability/orientation). Android 16 **já ignora** o lock de portrait em telas ≥600dp ⇒ o app roda em landscape hoje sem nunca ter sido testado nisso. Decisão do PO 2026-07-30: **suportar de verdade**, sem o opt-out `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` (expira em targetSdk 37 = dívida datada). Medido: 15 screens, **zero** `useWindowDimensions`, 1 `Dimensions.get()` em escopo de módulo (`FormSelect.tsx:7`). A restrição do `GmsBarcodeScanningDelegateActivity` **não é do dosiq** — vem do `expo-dev-launcher` vazando pro AAB de produção (fix isolado, fora da spec). OQ-002: rodar **depois** da 055/W2. Aguarda planning |
| 062 | android-notification-fidelity | **draft** | Tier a definir (suspeita 2). Origem: `dumpsys`/gaveta do device durante o smoke do #782 — NENHUM dos 3 itens veio de aviso de loja. **(A)** `mBypassDnd=false`: o código pede `bypassDnd:true` mas o SO ignora porque `ACCESS_NOTIFICATION_POLICY` é acesso ESPECIAL e o app nunca pede a concessão (`enabled_notification_policy_access_packages=null`). **(B)** `usage=USAGE_NOTIFICATION` em vez de `USAGE_ALARM` — volume segue o slider de notificação e não soa no silencioso; notifee 9.1.8 não expõe `audioAttributes` (exigiria canal em Kotlin via config plugin). **(C)** 🆕 push do servidor sem a marca do dosiq: plugin `expo-notifications` declara só `sounds`, sem `icon`/`color` ⇒ cai no launcher mascarado (confirmado no APK: sem `drawable/notification_icon`, sem meta-data no manifest). `smallIcon` só existe no caminho do notifee — as 2 superfícies NUNCA compartilharam ícone. Pré-existente. 🔴 O que dimensiona a spec NÃO é o nº de arquivos: canal Android é **imutável** após criado ⇒ corrigir o código não conserta a base instalada; exige id novo (`-v3`) criado DEPOIS da concessão + migração idempotente. Par Android da **spec 054** (Critical Alerts iOS). OQ-003: PO decide na W2 da 055 se entra junto |
| 063 | zero-lint-regressions | **in-progress** | Épico piloto de qualidade: zerar warnings ESLint e gates. F1 entregue (commit 5cd70df), F2 entregue na branch `feat/063-phase-2-shared-ui-and-hooks` (commit 5c39e3f, 131 warnings restantes) |



