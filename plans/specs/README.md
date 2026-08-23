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

## Tabela de status (atualizada 2026-08-22)

| # | Spec | Status | Evidência / Nota |
|---|------|--------|------------------|
| 001 | native-alarm-persistent | **delivered** | Alarme v1, base da 010. Sem PR registrado (2026-06-03) |
| 002 | caregiver-demand-teaser | draft | |
| 003 | patient-dose-history | **delivered** | PR #641 |
| 004 | expanded-adherence-dashboard | draft | PO 2026-06-10: não entregue como spec'ado |
| 005 | consultation-mode-profile | draft | 📌 A superfície **web existe** (`features/consultation/` + `views/Consultation.tsx`), entregue no **legado pré-specs** — por isso não há PR aqui. O escopo desta spec é o **porte mobile**, que segue não iniciado (mobile = zero). Sequenciado após o `007` (`BACKLOG_ORDER_2026H2.md` §5.4c). Absorve parte da 012 |
| 006 | public-emergency-qr-card | draft | Absorve parte da 012 (líquidos/injetáveis em meds críticos) |
| 007 | medical-pdf-report | **planned** | 📌 A geração **web existe** (`features/reports/consultationPdfService.ts` + builder + testes), do **legado pré-specs**; o escopo desta spec é o **porte mobile** (`expo-print`) — promovido para a Onda 2 (2.8b) em 2026-08-21. ✅ **Desbloqueada em 2026-08-21** (064 entregue, #808 — o builder já respeita a vigência). ⚠️ Antes do porte, ver a `073`: o PDF web ainda descreve injetável/gotas como "comprimido" e dose semanal como "1x/dia" — portar antes disso replicaria os furos no mobile. Absorve Fase E da 012 |
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
| 046 | lgpd-consent | **delivered** | Slices A #744 · B #745/#755 · D · C #804 · fix #805. 7 POs fechados 2026-08-21. ⚡ Prune **ARMADO** em prod desde 2026-08-21, zero candidatos na base. AP-333, AP-334, R-311, R-312, ADR-093 |
| 047 | inapp-review-prompt | **specified** | Tier 1 — expo-store-review, gatilho streak≥7d. Aguarda coding |
| 048 | landing-glp1 | **specified** | Tier 1 — landing estática AEO/GEO/LLM-SEO. Aguarda coding |
| 049 | docs-revamp | **delivered** | Épico completo 5 fases (F1 schema, F2 frontmatter 54 docs, F3 JS→TS 58 docs, F4 limpeza estrutural, F5 14 docs novos + 2 rewrites). Commits finais: 339620b (sprint 5.3 part 2), 3e59fee (frontmatter fixes), a164a93 (INDEX.md regeneração). 73/73 docs validados |
| 050 | notification-integrity | **in-progress** | PRs #799 (`208327b`, US4 — SC-005 verificado em prod 2026-08-20), #800 (`116ef578`, `subject_id` na outbox — ADR-078, CON-035) e #801 (`65900d0f`, fan-out do `stock_alert`, inerte até o cutover). #802 (`f16bdb0d`, `stock_expiry_alert` por LOTE + `id` no select de `stock`, inerte). Todo o código dos 5 PRs está em prod e o **cutover foi aplicado em 2026-08-20** (T033 — `OUTBOX_KINDS` com os dois kinds de estoque; 1º ciclo pela fila em 21/08). Falta o **SC-003** (T034, semana 21–27/08) e o PR 4 (fatiar `_reminderHelpers.ts`, move-only). #803 (`6b31bea3`, claim atômico do lembrete de dose — AP-332, o carimbo vira reivindicação antes do dispatch). Follow-up da 043; raiz da US4 na 064 |
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
| 064 | stock-forecast-vigency | **delivered** | PR #807 (`72d5e322`, predicado canônico `isProtocolVigentOn`) + PR #808 (`c454dcc5`, `asOf` em `calculateDailyIntake`/`stockDoseMetrics`, 8 superfícies, PDF clínico pela data de referência e gate `scripts/vigency-single-source.sh` no `lint`). Smoke do PO ok em PDF e custo mensal; `/estoque` auditado no código. Eixo `paused_at` fora ([[ADR-094]]). Desbloqueou a `007`; sobra a validação em prod |
| 065 | analytics-instrumentation-mobile | **planned** | Tier 2 por privacidade/LGPD (não toca banco nem UI). Fase 1 do analytics: fecha o mobile sob [[CON-034]]/[[ADR-090]] — 15 órfãos cabeados, `surface`+`treatment_id` do FATO (R-299), super property `mode`/`app_env`. RC3 fatiou em **4 PRs (A/B/C/D)**, droppabilidade D→C→B→A nunca; `plan.md`+`tasks.md` (30 tasks). ✅ **Desbloqueada** — `posthog-cli` instalado, autenticado e validado (T001a-d, 2026-08-13); armadilha dos dois prefixos documentada em `tasks.md` |
| 066 | camera-medicine-scan | **specified** | Tier 2 — épico multifases do spike `camera-medicine-capture.md`, mobile apenas. Tese: o gargalo do 1º cadastro é DADO, não captura — a CMED (26.001 apresentações, ~603 KB gzip) cabe no on-demand do [[CON-027]] sem infra nova; cascata L0 EAN → L1 OCR → L2 manual, sem LLM (parser cobre 92,0%). 🔴 Guardas clínicas medidas: ordem de dose indecidível em 5,5% dos compostos e laboratório não é identidade de genérico. 3 NC abertos; aguarda decisão do PO |
| 067 | critical-alarm-window-guard | **in-progress (A1+A2+B1+C delivered)** | Guarda bilateral de janela de dose crítica. PRs #795 (A1 visibilidade do skip) · #796 (A2 guarda + telemetria) · #797 (B1 skip e pausa/retomada por RPC, ADR-092, fecha IDOR do bot) · #798 (C instante na origem + higiene do trail). ⏸ **Falta só B2** — `REVOKE UPDATE(status)`: migração escrita, aplicação aguarda adoção da v0.31.1 nas lojas (gatilho em `plan.md` §B2, gate PO-SEC-2) |
| 068 | android-oem-battery-assistant | **draft** | Assistente anti-Doze por fabricante (`Build.MANUFACTURER`) no onboarding Android. Origem: dossiê ASO Play (pilar de maior rejeição crítica — 260 menções, 68,8% em 1★-2★). UI-only, zero schema ⇒ elegível a Gemini. Não toca canal (isso é a 062) |
| 069 | treatment-outcome-view | **draft** | "Está funcionando": peso × degrau de titulação × adesão. **2 fases** — A (captura de biomarcador pendurada no ritual da dose) é pré-requisito de B (curva), porque hoje não há nudge nenhum e a curva nasceria vazia. Cálculo no core p/ a 007 reusar. R-299 |
| 070 | symptom-side-effect-log | **draft** | Diário de efeitos colaterais × degrau de titulação (conjunto fixo + escala 0–5, nunca texto livre). Não existe sintoma no monorepo hoje. Tabela nova ⇒ grants/RLS obrigatórios. Alimenta a 007 |
| 071 | injection-bodymap | **draft** | Silhueta SVG de sítio de injeção (web hoje é `<select>`; mobile já é chips). Zero migração. 🔴 8 sítios reais incluem **glúteo** e não têm quadrante abdominal — o dossiê ASO errou o enum (R-295) |
| 072 | stock-derivation-single-source | **draft** | Tier 2 provável, **bloqueada pela 064**. Eixos B (fonte: `getAll` × `getActive` × embed cru × `select('*')`) e C (5 derivações de resumo de estoque) que a 064 mapeou e deliberadamente não tocou. Prova de que morde: [[AP-333]] no PDF, que empresta o valor derivado pelo dashboard em vez de calcular. A unificação já está declarada num docstring do core e não foi entregue (função privada, sem `export`). Entrar só após a 064 validada em prod |
| 073 | fix-clinical-data | **in-progress** | Guarda-chuva dos furos do documento clínico: 24 achados (`F-1..F-24`) com `file:line`, em 3 superfícies só-web. **PDF real da conta de teste conferido contra o banco (21/08): 4 dos 5 tratamentos saem com dose errada** — dose é multiplicada pela concentração mesmo quando já é massa/UI (Lantus 10 UI vira "1.000 UI/mL", erro de 2 ordens de grandeza), status "Ativo" é string literal (tratamento vencido sai Ativo na pág. 2 e Vencido na pág. 5) e a página de estoque do MESMO PDF calcula a cadência semanal certa que a pág. 2 erra em 50×. Também: modo consulta faz produto cruzado e dobra a posologia; cartão de emergência lista encerrado e colapsa 2 tratamentos em 1. Medido em prod: 9 protocolos vencidos ainda "ativos", 2 medicamentos com 2 tratamentos, 15 vigentes não-diários. **F-24: a página de titulação existe no código e some justamente para quem TERMINOU de titular** — o gate é `calculateTitrationData ≠ null`, que retorna null em manutenção; a conta de teste tem 12 degraus e zero seção. **RC3 (22/08):** guard calibrado por PR e fatiamento fechado em **3 PRs** agrupados por artefato de prova — PR 1 “o documento” (A+F+G, fecha com UM PDF regerado), PR 2 “a conta” (D+E, fecha com fixture de 2 protocolos vigentes do mesmo medicamento), PR 3 “fonte única” (B+C, fecha por grep de deleção). +2 achados do RC3: `formatDailyDose` é o 3º formatador doente e o farol `vigency-single-source.sh` não alcança `emergency/` nem `consultation/`. **Planejada (22/08):** `plan.md` + `tasks.md` com T001..T047; PO decidiu cartão com duas linhas, título “Receitas a renovar” e adesão com vigência por dia. §8 confirma no banco que não existe tabela `prescriptions` (item 5.7 do backlog, gate próprio). §9: sweep de rótulo não é sweep de dado. Bloqueia a `007` e a `005`. **PR 1/3 ENTREGUE (#809, `e628a446`)** — slices A+F+G: formatadores locais do PDF deletados em favor do core (Lantus volta a sair `10 UI`), vigência única com a isenção `:171` do farol REVOGADA, escada de titulação COMPLETA (a 1ª entrega tinha só o contador `4/4`; o PO pegou no smoke) e `pdfSafe` cp1252 — a fonte UTF-8 prevista no plano era **desnecessária**. POs 1/2/8/9/10/11 fechadas com o PDF real reconferido pelo PO. RC6 7/7 chunks, 1 high (R-299) corrigido. Nasceram **R-315** e **AP-338**. **Faltam PR 2** (D+E — cartão de emergência e modo consulta, rebase obrigatório em `main`) **e PR 3** (B+C — fonte única de status de receita, ADR-095) |
| 074 | emergency-card-qr-web | specified | QR do cartão de emergência da web é ilegível (`base64(JSON)` sem nenhum decodificador no repo) e existe em 2 versões divergentes (widget do Perfil × página do Cartão), nenhuma com o telefone do contato. Medido: texto puro dá 49×49 contra 73×73 de hoje, com mais dado. Tier 1, só web/PWA, sem backend — o porte mobile é a 006. Decisões do PO: QR fica p/ download/impressão, widget do Perfil vira atalho, teto de 57×57 módulos com corte da lista (D3) e PNG com faixa de texto a ≥1024 px (D4 — hoje 256 px borra na impressão). |
