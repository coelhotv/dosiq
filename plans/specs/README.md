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

## Tabela de status (atualizada 2026-09-08)

| # | Spec | Status | Evidência / Nota |
|---|------|--------|------------------|
| 001 | native-alarm-persistent | **delivered** | Alarme v1, base da 010. Sem PR registrado (2026-06-03) |
| 002 | caregiver-demand-teaser | draft | |
| 003 | patient-dose-history | **delivered** | PR #641 |
| 004 | expanded-adherence-dashboard | draft | PO 2026-06-10: não entregue como spec'ado |
| 005 | consultation-mode-profile | draft | 📌 A superfície **web existe** (`features/consultation/` + `views/Consultation.tsx`), entregue no **legado pré-specs** — por isso não há PR aqui. O escopo desta spec é o **porte mobile**, que segue não iniciado (mobile = zero). Sequenciado após o `007` (`BACKLOG_ORDER_2026H2.md` §5.4c). Absorve parte da 012 |
| 006 | public-emergency-qr-card | draft | Absorve parte da 012 (líquidos/injetáveis em meds críticos) |
| 007 | medical-pdf-report | **planned** | 📌 A geração **web existe** (`features/reports/consultationPdfService.ts` + builder + testes), do **legado pré-specs**; o escopo desta spec é o **porte mobile** (`expo-print`) — promovido para a Onda 2 (2.8b) em 2026-08-21. ✅ **Desbloqueada em 2026-08-21** (064 entregue, #808 — o builder já respeita a vigência). ✅ **Desimpedida em 2026-08-24**: a `073` fechou (#809/#810/#811) — o PDF web já descreve injetável/gotas na unidade real e respeita a cadência, então o porte não replica mais os furos. Absorve Fase E da 012 |
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
| 029 | treatment-level-titration | **delivered** | Épico fechado (F1-F6, PRs #746-751/#757/#758/#760/#765). Reescopado 2026-07-16 de migração p/ construção (AP-301). R-296, R-300. Dívida: push das 08:00 sem prova de execução (T030). |
| 030 | fix-dose-history | **delivered** | PR #668. AP-231 |
| 031 | injection-site-rotation | **delivered** | PR #675. ADR-072, CON-026 |
| 032 | biomarker-pa | **delivered** | PRs #669/#670. ADR-070 |
| 033 | mobile-history-timeline-refactor | **delivered** | PR #671. AP-193, ADR-054 |
| 034 | gemini-sunset | **in-progress** | A/B/C entregues (PRs #752-754). ADR-069 accepted. Falta 034-D (medição passiva) → decisão T051 do PO (item 2.6 do backlog H2). Série de bytes do preâmbulo fechada no `measurement.md`; o KPI que falta (caminhos não-pretendidos do RC6) exige PR de produto. |
| 035 | unified-dose-log-stock-core | **delivered** | PR #673. ADR-071, CON-026. AP-236 |
| 036 | fix-alarm-stale-snooze | **delivered** | PR #672. AP-235. Mobile-only |
| 037 | anvisa-web-ondemand | **delivered** | PRs #682/#683. ADR-073, CON-027. AP-242 |
| 038 | refactor-web-structure | **delivered** | PRs #677-680. R-279, AP-238/239/240. Refator puro |
| 039 | dose-state-machine | **in-progress** | F0-F3 entregues (PRs #689-#694). ADR-075, CON-024/029/030. Live Activities iOS+Android em prod. Falta F4 (smoke consolidado + decisão go/no-go v2, T041) e F5 (housekeeping de canais/deadcode) |
| 040 | typescript-migration | **delivered** | Épico completo 6 fases, PRs #702-731. Monorepo 100% TS. R-283/284 |
| 041 | ios-push-to-start | **delivered** | PRs #696/#697/#701. ADR-076, CON-030. Verificado em prod 2026-08-15 (`apns_liveactivity`, 21 devices ativos). Dívida: smoke formal em device iOS nunca registrado. |
| 042 | critical-audit-trail | **delivered** | PRs #699-701. ADR-077, CON-031. AP-258/259 |
| 043 | notify-improvements | **delivered** | Slice B PR #733 (AP-273) · Slice A PRs #734 (outbox+drenador, ADR-078) e #742 (cutover do daily_digest). `stock_alert` não migrou (fan-out precisa de `subject_id`) → spec 050. |
| 044 | dose-only-mode | **delivered** | Épico completo 6 fases, PRs #735-740. Modo sem controle de estoque. AP-277/281-289, R-290 |
| 045 | fix-android-soloader-crash | **delivered** | Tier 1 — crash SoLoader Android 13 |
| 046 | lgpd-consent | **delivered** | Slices A #744 · B #745/#755 · D · C #804 · fix #805. 7 POs fechados 2026-08-21. ⚡ Prune **ARMADO** em prod desde 2026-08-21, zero candidatos na base. AP-333, AP-334, R-311, R-312, ADR-093 |
| 047 | inapp-review-prompt | **specified** | Tier 1 — expo-store-review, gatilho streak≥7d. Aguarda coding |
| 048 | landing-glp1 | **specified** | Tier 1 — landing estática AEO/GEO/LLM-SEO. Aguarda coding |
| 049 | docs-revamp | **delivered** | Épico completo 5 fases (schema, frontmatter, JS→TS, limpeza, 14 docs novos). Commits finais 339620b/3e59fee/a164a93. 73/73 docs validados. |
| 050 | notification-integrity | **in-progress** | Follow-up da 043. PRs #799-#803 em prod (`208327b`/`116ef578`/`65900d0f`/`f16bdb0d`/`6b31bea3`); cutover aplicado 2026-08-20 (T033). SC-003 encerrado 25/08 — `stock_alert` migrou sem degrau. Falta PR 4 (fatiar `_reminderHelpers.ts`, move-only). ADR-078, CON-035, AP-332. `prescription_alert` tinha causa própria → spec 076 ([[AP-340]]). |
| 051 | expo-updates | **051-A delivered · 051-B ~1 sessão** | OTA (EAS Update) + kill switch de versão. ADR-082/083/091, [[CON-033]]. 051-A nos PRs #775-#779 + #781. Resta T011 (elegibilidade OTA × loja + hook no SQP), T049 (`fleet-versions.sh`), doc curto e 2 atos do PO. |
| 052 | dose-instance-medicine-snapshot | **delivered** (A+B+C) | Épico completo, PRs #761/#762/#764. `dose_instances.medicine_id` snapshot (mata falsificação retroativa de histórico clínico). ADR-084/085, R-297/R-299/R-300, AP-308..313. |
| 053 | unit-label-formatter | **delivered** (Slice A PR #767 `ab311429` · Slice B PR #768 `6ca42da9`) | Origem AP-306. Fonte única no core (`DOSAGE_UNIT_LABELS`/`INTAKE_UNIT_LABELS`) + gate `unit-label-gate.sh`. Valores de banco/enum intocados (AP-299/R-295). Épico completo. |
| 054 | critical-alerts | **planned** | iOS Critical Alerts (dose crítica toca em silencioso/Focus). ADR-086 proposed. Slice 2 (push remoto) condicional a R-296. Aguarda coding |
| 055 | expo-55-target-api-36 | **W1 delivered · W2 planned** | W1 mergeada (PRs #770-#774, #781, mobile v0.30.0): SDK 54 + target API 36 + firebase→Sentry/PostHog (ADR-090) + edge-to-edge + 051-A. Exigência do Play (API 36) cumprida; W2 sem prazo (PO 2026-08-15) = SDK 55 → v0.31.0 + US8 (`useSafeAreaInsets()`). Orientação/large screen → spec 061. |
| 056 | ai-review-tuning | **in-progress** | Tier 1 — tooling em repo externo (`ai-review.sh`). Fase 1 entregue (devflow `044fe1e`→`5a6b467`: clamp, filtro por pack em `auto`, liveness do agy, saída estruturada). PO-1/2/3 fechados; SC-001 recalibrado (T027). Fase 2 fechada por gate (parte → 060). T014/PO-5 (A/B) sem veículo — destrava por PR de produto Tier 2, não por ferramental (item 2.7 do backlog H2). |
| 057 | device-activity-log | **delivered** | PR #769 (squash `1bd51566`). Heartbeat de app_version/atividade independente de push (R-239); tabela `device_activity` + RPC `upsert_device_activity` (ADR-089). Recorrência AP-278 (anon EXECUTE) corrigida ao vivo. |
| 058 | rc6-reflection-gate | **in-progress** | Tier 1 — gate determinístico pós-review (`tsc`/PostgREST no lugar de 2º LLM); repo externo (`~/SKILLS/devflow`, `afc42ce`/`b48f085`/`2da9afb`), ligado em `annotate`, fail-open. Corpus 7/7 verde. Falta validação em campo (T014, ≥2 PRs reais) — veículo precisa de findings verificáveis por ferramenta (tipo/schema/coluna/assinatura), ex. `065` PR A ou `069-A`. Fechamento em `docs/standards/AI_REVIEW.md`. Fronteira com a 056: 056 = contexto que entra, 058 = finding que sai. |
| 059 | analytics-privacy | **draft** | Tier 2 provável. Scrubbing de dado clínico antes de sair do device (Sentry `beforeSend` + payloads PostHog) + analytics sob consentimento (046). Origem: PR 1.3b (ADR-090) — risco subiu quando o analytics passou a identificar o uid. Destrava por decisão jurídica; NÃO planejado |
| 060 | memory-yaml-enrich | **in-progress** | Tier 1 — camada de acesso única à memória DEVFLOW (schema + índice compilado + seletor) no lugar do preâmbulo truncado do RC6. PRs #815/#816/#817 (acervo inteiro: 605/605 schema-válidas). Seletor já entrou por DEFAULT fail-open (`ai-review.sh:417-468`); T035 entregue. Fase B decidiu NÃO flipar por recall (`measurement.md` da 034). Aberto: T017, T020, T021, T022, T026 (amarrado ao [[ADR-097]] `proposed`). [[R-318]] |
| 061 | large-screen-support | **specified** | Tier 1 provisório (>8 arquivos ou 2 colunas ⇒ Tier 2). Android 16 já ignora o lock de portrait em telas ≥600dp ⇒ o app roda em landscape hoje sem nunca ter sido testado. PO 2026-07-30: suportar de verdade, sem o opt-out `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` (dívida datada em targetSdk 37). Medido: 15 screens, zero `useWindowDimensions`. OQ-002: rodar depois da 055/W2 |
| 062 | android-notification-fidelity | **planned** | Tier 2, mobile-only, zero schema. 3 achados de `dumpsys` no smoke do #782 (`bypassDnd` ignorado, `USAGE_NOTIFICATION` vs `USAGE_ALARM`, push sem ícone). Dimensionada pela imutabilidade do canal Android (id `-v3` + migração). 3 fases (spike no device / audibilidade+DND / ícone do push), todas build de loja (R-314). PO 2026-08-30 fechou OQ-001/OQ-003. RC3: 8 achados (2 críticos). Par Android da 054. |
| 063 | zero-lint-regressions | **delivered** | Monorepo 100% Zero Lint (0 errors, 0 warnings). Épico completo em 13 PRs (#782-#794). Testes 164/164. Passada de fidelidade visual via constantes de módulo |
| 064 | stock-forecast-vigency | **delivered** | PR #807 (`72d5e322`, predicado `isProtocolVigentOn`) + PR #808 (`c454dcc5`, `asOf` em 8 superfícies + gate `scripts/vigency-single-source.sh`). Eixo `paused_at` fora ([[ADR-094]]). Desbloqueou a `007`; sobra validação em prod. |
| 065 | analytics-instrumentation-mobile | **planned** | Tier 2 por privacidade/LGPD (não toca banco nem UI). Fase 1 do analytics sob [[CON-034]]/[[ADR-090]] — 15 órfãos cabeados, `surface`+`treatment_id` do FATO (R-299). RC3 fatiou em 4 PRs (A/B/C/D); `plan.md`+`tasks.md` (30 tasks). Desbloqueada — `posthog-cli` validado (T001a-d). |
| 066 | camera-medicine-scan | **specified** | Tier 2 — épico multifases do spike `camera-medicine-capture.md`, mobile apenas. Tese: gargalo do 1º cadastro é DADO, não captura — CMED cabe no on-demand do [[CON-027]]; cascata L0 EAN → L1 OCR → L2 manual, sem LLM. Guardas clínicas: ordem de dose indecidível em 5,5% dos compostos. 3 NC abertos; aguarda PO. |
| 067 | critical-alarm-window-guard | **in-progress (A1+A2+B1+C delivered)** | Guarda bilateral de janela de dose crítica. PRs #795/#796/#797/#798. ADR-092 (B1 fecha IDOR do bot). Falta só B2 (`REVOKE UPDATE(status)`) — migração escrita, aplicação aguarda v0.31.1 nas lojas (`plan.md` §B2, gate PO-SEC-2); `device_activity` sem device acima de `0.30.2`. PO-8 fechada 25/08. |
| 068 | android-oem-battery-assistant | **planned** | Tier 1. Assistente anti-Doze por OEM. RC3+RC2 rodadas. Gate HÍBRIDO (Xiaomi sempre; Samsung/Motorola só se otimizado). PR 1 = card+guias+rota+re-check; US5/US6 no PR 2; telemetria no PR 3 (Tier 2 + RC-SEC). Build de loja (R-314) |
| 069 | treatment-outcome-view | **planned** | `plan.md`+`tasks.md` da Fase A (29 tasks, 2 PRs: A1 caracterização+extract, A2 prompt+throttle). Fase B não planejada — bloqueada pela `007`; SC-004 pende da `065`. |
| 070 | symptom-side-effect-log | **draft** | Diário de efeitos colaterais × degrau de titulação (conjunto fixo + escala 0–5, nunca texto livre). Não existe sintoma no monorepo hoje. Tabela nova ⇒ grants/RLS obrigatórios. Alimenta a 007 |
| 071 | injection-bodymap | **planned** | Tier 2 (web+mobile+core), zero schema. Silhueta SVG substitui `<select>` da web e chips do mobile; enum/CHECK conferidos em prod (8 sítios, glúteo → vista dorsal — R-295). 5 superfícies. RC3 26/08: 2 PRs (core+web · mobile em 2 commits). Planejada 26/08: `plan.md`+`tasks.md` (T001-T028) + `design-brief.md`. Paridade estrutural, não cromática (SC-007). [[ADR-096]] `accepted`. |
| 072 | stock-derivation-single-source | **draft** | Tier 2 provável, bloqueada pela 064. Eixos B (fonte: `getAll` × `getActive` × embed cru × `select('*')`) e C (5 derivações de resumo de estoque) que a 064 mapeou e não tocou. Prova: [[AP-333]] no PDF. Entrar só após a 064 validada em prod. |
| 073 | fix-clinical-data | **delivered** | Guarda-chuva dos furos do documento clínico (24 achados `F-1..F-24`, 3 superfícies só-web: dose × concentração, status "Ativo" literal, produto cruzado no modo consulta, cartão de emergência, página de titulação some em manutenção). 3 PRs por artefato de prova: #809 (`e628a446`, A+F+G — formatadores do PDF → core), #810 (`7be9c90d`, D+E — produto cruzado morto, cadência, janela de receita 30→14), #811 (`1c189e5c`, B+C — 2º resolvedor de status deletado, −1044 linhas). ADR-095, R-315/R-316, AP-338/AP-339. Desbloqueia `007` e `005`. |
| 074 | emergency-card-qr-web | specified | Tier 1, só web/PWA, sem backend (porte mobile é a 006). QR do cartão de emergência é ilegível (`base64(JSON)`, sem decodificador no repo) e existe em 2 versões divergentes, nenhuma com telefone do contato. Decisões do PO em D3/D4 (QR p/ download/impressão, teto 57×57 módulos, PNG ≥1024 px). |
| 076 | prescription-alert-revival | **delivered** | PRs #813 (`923d2956`) e #814 (`3e7af988`). Alerta de renovação de receita (30/7/1 dias) nunca emitiu em prod (sem gatilho serverless + coluna fantasma no filtro); revivido com janela `<=` e dedup em `notification_log`. [[AP-340]]/[[AP-341]], [[R-295]]. Incidente de processo: push direto na main, revertido em `670bb14e`. PENDENTE PO-4: 1ª linha `prescription_alert` em prod. |
| 077 | datetime-runtime-tz | draft | Tier 1 — `getTodayLocal` deriva o dia com `toISOString()` sobre uma `Date` que carrega hora de parede de SP: as operações se cancelam só sob `TZ=UTC`, então produção (Vercel) acerta e runtime `-03` devolve o dia seguinte entre 21h e meia-noite. 176 call sites no caminho de notificação. Origem: [[AP-342]], gate de pre-push vermelho no C5 do #817. Fuso da suíte já fixado em UTC; o helper e a prova de equivalência são esta spec |
| 078 | devflow-memory-revamp | **delivered** | Tier 2, 6 PRs: #818/#819 (corpus + contador), #820/#821 (escrita-de-volta do ciclo de vida), #822/#823/#824 (seletor no RC6 + A/B), #825 (`SKILL.md` em 7 skills, −42% por sessão) e #826 (ledger de conhecimento negativo). `ADR-097` voltou a `proposed` pela própria cláusula de falsificação; `ADR-098` accepted. 28/28 POs fechadas — as do Slice 4 foram demonstradas no corpo do #825 e o checkbox da spec, corrigido a posteriori em 2026-09-06. |
| 079 | memory-gate-hygiene | **delivered** | Tier 1. Três defeitos do ferramental de memória medidos na 078: `AP-349` (`sourceHash` por mtime → falso vermelho em todo merge/checkout), dívida `T023` da 060 (o `--check` não está ligado a hook) e validador que reporta um campo por vez. Um PR só — mesmo arquivo, mesmo gate. Hook decidido no P1.5: `pre-commit` via glob no `.lintstagedrc.mjs`. Pós RC4+RC3: fatiada em 2 PRs. Entregue em 2 PRs: **#827** (núcleo puro compartilhado pelos dois validadores, índice byte-idêntico fora de `meta`) e **#828** (hash de conteúdo, hook `pre-commit` por glob, mensagem acionável, pulados no stdout, `npm run validate:memory`). 6/6 POs. |
| 080 | rc6-preamble-budget | **in-progress** | Corpus de USO (citação-em-finding) + métrica + critério de parada, com `CLAUDE.md` como piso protegido. Não decide o corte (`RC6_INDEXES` fica). ADR-099 `accepted`, ADR-097 emendado com critério de saída. PR A (devflow `266c228`) e PR B (devflow `1c6582f`): gate por TAXA sobre a parcela wiki, baseline versionada, degradação corta só o wiki. PO-3 aberta (falta `--post` real do RC6 num PR com código); SC-001 pede 100%. |
| 081 | rc6-surface-scope | **superseded** | Regra por superfície já existia no CI (`paths-ignore` do `ai-review-gate.yml`) enquanto o texto mandava rodar por Tier. Encerrada 2026-09-08 sem C-mode, entregue como Tier 0: gatilho virou `paths` (allowlist) espelhando o `CODE_GLOBS`, fechando a divergência nos dois sentidos (silêncio em `scripts/*.mjs` — [[AP-348]] — e ruído em `vercel.json`/`package.json`). D2 duplicava o 2.6 do backlog / T051 da 034. Descartados: `.agent/review-surfaces.json` e emenda ao ADR-069. |
