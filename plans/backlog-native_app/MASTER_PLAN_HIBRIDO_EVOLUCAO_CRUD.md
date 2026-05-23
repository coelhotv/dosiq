# Dosiq Native App — Plano Estratégico de Evolução CRUD

> **Versão atual (v4)** — Status reconciliado pós-Fase 3 (23/05/2026)
> **Autor**: Arquiteto-chefe (AI) + PO (humano)
> **Status**: 🔄 Em execução — Pré-requisitos + Fase 1 + Fase 2 + Fase 3 entregues; Fase 2.5 em fila; Fase 4 próxima

---

## 🚦 Status de Execução (snapshot 2026-05-17)

| Fase | Status | PRs principais | Quality Gates | Observações |
|------|--------|----------------|---------------|-------------|
| **Pré-requisitos** (Form Kit, useMutation, infra ANVISA) | ✅ Completa | Sprint P1.x | — | Form Kit serviu de fundação para Fases 1 e 2 sem retrabalho |
| **Fase 1 — Medicamentos** | ✅ Completa | #555-#559 (+ distill) | G1 ✅ G2 ✅ G3 ✅ | `createMedicineRepository` em `@dosiq/core/repositories/` (ADR-045); RETRO documentada em `RETRO_FASE1_CRUD_MEDICAMENTOS.md` |
| **Fase 2 — Tratamentos (Protocolos)** | ✅ Completa | #561 (PR-A T2.1) · #562 (T2.1 fan-out) · #563 (PR-A T2.2) · #564 (PR-B T2.2) · #565 (PR-C T2.2) · #566 (PR-A T2.3 — factory G2) · PR-B T2.3 (web G3) · PR final mãe→main | G1 ✅ G2 ✅ G3 🟡 (em PR final do PR-B T2.3) | Lições críticas: `isProtocolActiveOnDate` strict vs `isProtocolInPeriod`, `statusBarTranslucent` em todos `Modal`s mobile (AP-163), padronização "unidade(s)" |
| **Fase 2.5 — Status de Tratamentos** | 🆕 Planejada | A definir (sprint único `feat/treatments-status`) | G1 | Origem: gap detectado no smoke da Fase 2 — flag `active` + period `end_date < hoje` (categorização ativo/pausado/finalizado já presente na web). Spec: `EXEC_SPEC_FASE2_5_STATUS_TRATAMENTOS.md` |
| **Fase 3 — Estoque** | ✅ Completa | #574 · #576 · #578 · #579 (KPIs+Ajuste+migrations) · #580 (factory G2+G3) · #581 (PR-mãe→main) | G1 ✅ G2 ✅ G3 ✅ | `createStockRepository` + `createPurchaseRepository` em `@dosiq/core` (parity 37/37); web+mobile adotam factory; migrations §0.8 (delta negativo) + §0.9 (`unit_price` NUMERIC(12,4)) aplicadas via MCP. Lições: AP-171 (Intl.NumberFormat/Hermes), AP-172 (status estoque duplicado vs `resolveStockStatus`). `validate:agent` 830/830 |
| **Fase 4 — Perfil completo** | ⏸️ Não iniciada | — | — | Spec não escrita |
| **Fase 5 — Analíticas (Histórico, Aderência expandida, Ficha)** | ⏸️ Não iniciada | — | — | Spec não escrita |
| **Fase 6 — Avançadas (Emergência, Chatbot, PDF, mobile-only)** | ⏸️ Não iniciada | — | — | Spec não escrita |

### Lições aprendidas até aqui (consolidado de RETRO + spec histories)

1. **Quality Gates G1→G2→G3 funcionam** — bug encontrado em mobile (G1) não chegou na web (G3) graças à ordem cópia→extract→adopt.
2. **Cavecrew distribution (ADR-044) bom equilíbrio** — Opus arquiteta o sensível inline, Sonnet/Haiku paralelizam tasks mecânicas. Tempo de sprint caiu vs. sequencial.
3. **Smoke PO ANTES de abrir PR** (pattern adotado pós-Fase 1) reduz churn de fixes com Gemini. Push pra EAS OK; HOLD em `gh pr create` até PO validar.
4. **Modal Android < 8 precisa `statusBarTranslucent`** (AP-163) — bug recorrente; sweep aplicado em todos sheets Fase 1+2 (PR #566).
5. **Spec viva** — atualizar `EXEC_SPEC_*` ao longo da execução (não só no kickoff) evita gaps de paridade voltarem como surpresa.

---

## ✏️ Original (v3, 14/05/2026)

> **Versão Final (v3)** — Todas as decisões aprovadas pelo Product Owner
> **Data**: 14 de maio de 2026
> **Autor**: Arquiteto-chefe (AI) + PO (humano)
> **Status**: ✅ Pronto para planejamento de execução

---

## Sumário Executivo

O Dosiq é um PWA de gerenciamento de medicamentos com ~223 arquivos de features na web e ~46 no mobile nativo. O mobile atualmente suporta somente visualização de entidades e registro de doses. Este documento define a **abordagem estratégica** para expandir o app nativo para suportar CRUDs completos de todas as entidades do produto, com meta de médio prazo de paridade total — e visão de longo prazo onde o mobile ultrapassa a web com features exclusivas (camera, HealthKit, widgets).

---

## 1. Diagnóstico: Mapa de Maturidade

| Domínio | Web (PWA) | Mobile (Nativo) | Gap |
|---------|-----------|-----------------|-----|
| **Medicamentos** | CRUD completo + busca ANVISA + laboratórios | ❌ Nenhum | 🔴 Total |
| **Protocolos (tratamentos)** | CRUD + titulação + plano terapêutico + lembretes | Read-only (listagem ativa) | 🟠 Alto |
| **Estoque** | CRUD + compras + previsão reposição + análise custos | Read-only (saldo) | 🟠 Alto |
| **Doses** | Registro completo | ✅ Registro completo | 🟢 Paridade |
| **Perfil** | CRUD + avatar + configurações | Somente config de notificações, sem edição | 🟠 Alto |
| **Cartão de Emergência** | CRUD + geração QR + compartilhamento | ❌ Nenhum | 🔴 Total |
| **Aderência** | Padrões + risco + trends + análise temporal | Gauge-ring + streak (sem expansão de períodos) | 🟡 Médio |
| **Histórico de Doses** | Navegação histórica diária (healthHistory) | ❌ Nenhum | 🔴 Total |
| **Ficha Médica** | Visualização resumo do paciente + export PDF | ❌ Nenhum | 🔴 Total |
| **Relatórios/Export** | PDF + compartilhamento | ❌ Nenhum | 🔴 Total |
| **Chatbot** | Assistente com contexto (Groq SDK) | ❌ Nenhum | 🔴 Total |
| **Notificações** | Inbox + push + DLQ | Inbox + push | 🟡 Médio |

### Números

| Métrica | Web | Mobile | Ratio |
|---------|-----|--------|-------|
| Feature domains | 15 | 6 | 2.5× |
| Feature files (js/jsx) | ~223 | ~46 | 4.8× |
| Service files | 30+ | 5 | 6× |
| CRUD operations | Completo | Doses only | — |

---

## 2. Filosofia: "Service-First, Screen-Second"

Cada CRUD segue um pipeline determinístico:

```
Schema (Zod)  →  Service Factory  →  Hook  →  Screen
   @dosiq/core      shared-data       feature     feature
```

A camada de serviço é a unidade de trabalho, não a tela. Isso garante que:
- A lógica de negócio é testável em isolamento
- O mesmo service pode ser compartilhado entre plataformas (via factory)
- Telas são apenas projeções visuais dos dados + ações do service

---

## 3. Estratégia de Services: Híbrida Progressiva (Opção C)

Cada domínio percorre 3 estágios sequenciais, com quality gates obrigatórios entre cada um:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Estágio 1      │     │  Estágio 2       │     │  Estágio 3      │
│  COPIAR         │────▶│  EXTRAIR         │────▶│  MIGRAR         │
│                 │     │                  │     │                 │
│  Service local  │     │  Factory em      │     │  Web adota      │
│  no mobile      │     │  @dosiq/         │     │  factory        │
│  (fork do web)  │     │  shared-data     │     │  compartilhado  │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                      │                         │
    ┌────▼────┐            ┌────▼────┐               ┌────▼────┐
    │ Gate G1 │            │ Gate G2 │               │ Gate G3 │
    └─────────┘            └─────────┘               └─────────┘
```

### Quality Gates Mandatórios

#### G1 — Gate de Cópia (mobile recebe service novo)

| Critério | Bloqueante |
|----------|-----------|
| Schema Zod do `@dosiq/core` cobre 100% dos campos | ✅ |
| Service nativo tem testes unitários equivalentes aos da web | ✅ |
| CRUD funcional no simulador iOS + Android | ✅ |
| `validate:agent` web continua 100% green | ✅ |

#### G2 — Gate de Extração (service migra para `shared-data`)

| Critério | Bloqueante |
|----------|-----------|
| Factory aceita `{ supabase, getUserId }` — zero import direto | ✅ |
| Mobile usa factory extraído — testes passam | ✅ |
| Web continua com service local (sem migração na mesma PR) | ✅ |
| Diff do service extraído vs original < 5% (exceto wiring) | ✅ |

#### G3 — Gate de Migração (web adota factory compartilhado)

| Critério | Bloqueante |
|----------|-----------|
| Todos os testes da web passam com novo import | ✅ |
| Smoke test manual na web confirma CRUD funcional | ✅ |
| Service local da web deletado, zero referência residual | ✅ |
| `npm run build` (web) + `npx expo export` (mobile) OK | ✅ |

> [!CAUTION]
> **Regra de ouro**: Nunca mais de 1 domínio em transição simultânea. Completar Medicamentos end-to-end (G1 → G2 → G3) antes de iniciar Protocolos.

---

## 4. Base ANVISA + Laboratórios: Supabase Storage + Cache

### Estratégia: Download Assíncrono + Cache Local

Ambas as bases (medicamentos 1.34 MB + laboratórios 14 KB) serão hospedadas no **Supabase Storage** (bucket público) com versionamento por path.

```
Supabase Storage/
  dosiq-assets/                       ← bucket público
    anvisa/
      v1/
        medicineDatabase.json         ← 1.34 MB, 6.816 registros
        laboratoryDatabase.json       ← 14 KB
        manifest.json                 ← { version: "1", checksum: "sha256...", updatedAt: "..." }
```

### Por que Supabase Storage (e não Vercel Blob)

| Critério | Supabase Storage ✅ | Vercel Blob |
|----------|-------------------|-------------|
| Proximidade regional | `sa-east-1` (São Paulo) — latência mínima | Edge node mais próximo |
| Ecossistema | Toda infra Dosiq já no Supabase | Boa para frontend web |
| Free Tier bandwidth | 5 GB/mês (suficiente para ~3.600 downloads) | 10 GB/mês |
| Risco de pause | Zero — projeto ativo diariamente | N/A |
| Operações | Ilimitadas (REST API) | 10K simples + 2K avançadas |

### Implementação no Mobile

```javascript
// Hook: useMedicineDatabase()
// 1. GET manifest.json (< 1 KB) — versão check
// 2. Se versão local === remota → usa AsyncStorage cache
// 3. Se versão diferente → baixa JSON → salva em AsyncStorage
// 4. Fallback: formulário manual sem autocomplete se offline + sem cache
```

**Benefício principal**: Atualização da base ANVISA **sem publicar novo build** na App Store / Play Store.

---

## 5. Concorrência Web ↔ App: Supabase como Fonte da Verdade

```
┌──────────────┐       ┌──────────────┐
│   Web (PWA)  │       │  Mobile App  │
│  SWR Cache   │       │ AsyncStorage │
│      ↕       │       │      ↕       │
│  supabase    │       │  supabase    │
│  (browser)   │       │  (native)    │
└──────┬───────┘       └──────┬───────┘
       └──────────┬───────────┘
          ┌───────▼───────┐
          │   Supabase    │
          │  PostgreSQL   │
          │   + RLS       │
          └───────────────┘
```

| Princípio | Regra |
|-----------|-------|
| Fonte da verdade | Supabase — sem sync P2P |
| Conflitos | Last-write-wins (sem detection na v1) |
| Cache reads | TTL curto (30-60s) + revalidate on focus |
| Mutations (C/U/D) | Online-only — erro claro se sem internet |
| Doses | Exceção: queue local + sync ao reconectar (já existe) |
| Futuro | Supabase Realtime para push-based sync |

---

## 6. UX Cross-Platform: Paridade de Resultado, Divergência de Interação

### Camada idêntica (lógica)
- Validação Zod (`@dosiq/core`)
- Regras de negócio (cálculo de estoque, aderência)
- Queries Supabase (mesmos selects)
- Resultados de cálculo

### Camada diferente (interação)

| Aspecto | Web | Mobile |
|---------|-----|--------|
| Formulários | Modals/drawers | Telas full-screen (stack) |
| Busca ANVISA | Dropdown inline | Tela de busca com FlatList |
| Ações em lista | Botões visíveis | Swipe gestures + long press |
| Feedback | Visual | Haptics + visual |
| Ações secundárias | Menus contextuais | Bottom sheets nativos |
| Date/Time | Inputs com popup | Pickers nativos do SO |
| Identidade visual | `design-tokens` compartilhados | Mesmos tokens + adaptações de contraste e paradigmas nativos |

### Visão Mobile-First (Pós-Paridade)

| Feature | Plataforma | Valor |
|---------|-----------|-------|
| 📸 Camera OCR | iOS/Android | Escanear caixas de medicamento / receitas |
| ❤️ HealthKit / Health Connect | iOS/Android | Integração com dados de saúde do dispositivo |
| 🚨 Critical Alerts | iOS | Notificações urgentes para doses esquecidas |
| 📱 Widgets | iOS/Android | Próxima dose + streak na home screen |
| 📍 Geolocation | iOS/Android | Lembrete ao passar perto da farmácia |
| ⌚ WatchOS/WearOS | Wearables | Complicação para próxima dose |

> Essas features devem ser planejadas na arquitetura desde agora (módulos nativos isolados em `platform/`), mesmo que a implementação venha após paridade.

---

## 7. Form Kit: Build In-House (State + Zod)

Abordagem: construir componentes de formulário internamente, mantendo consistência com o padrão já usado na web (controlled state + validação Zod manual).

> [!NOTE]
> `react-hook-form` é open-source e gratuito, mas optar por construir internamente garante:
> 1. Zero dependência extra no bundle nativo
> 2. Controle total sobre comportamento e animações
> 3. Consistência com a web (que também usa state + Zod manual)
> 4. Conhecimento completo da codebase (sem caixa preta)

### Componentes do Kit

| Componente | Responsabilidade |
|-----------|-----------------|
| `FormInput` | Input de texto com label, error, helper text |
| `FormSelect` | Picker nativo com opções |
| `FormDatePicker` | DateTimePicker nativo (modo date) |
| `FormTimePicker` | DateTimePicker nativo (modo time) |
| `FormAutocomplete` | Navega para tela de busca, retorna seleção |
| `FormSection` | Agrupador visual com título |
| `FormActions` | Submit/Cancel fixos no bottom safe area |
| `useFormState(schema)` | Hook: state management + Zod validation |

### Padrão de Uso

```jsx
function MedicineFormScreen({ route }) {
  const { values, errors, handleChange, validate } = useFormState(medicineCreateSchema)
  
  const handleSubmit = async () => {
    if (!validate()) return // scroll ao primeiro erro
    await medicineService.create(values)
    navigation.goBack()
  }
  
  return (
    <FormSection title="Dados do Medicamento">
      <FormInput name="name" label="Nome" value={values.name} error={errors.name} onChange={handleChange} />
      <FormAutocomplete label="Buscar na ANVISA" onSelect={handleAnvisaSelect} />
      ...
      <FormActions onSubmit={handleSubmit} onCancel={navigation.goBack} />
    </FormSection>
  )
}
```

---

## 8. Chatbot Mobile

### Fase 1: Groq SDK (Consistência com Web)
- Mesma API que a web usa atualmente
- Context builder adaptado para dados disponíveis no mobile
- UI nativa com bottom sheet ou tela dedicada

### Futuro: Spike de On-Device Inference

> [!TIP]
> **Referência do PO**: [Google AI Edge Gallery](https://github.com/google-ai-edge/gallery) — modelos rodando localmente no iPhone.
>
> **Candidatos para avaliação:**
> - **LiteRT + Gemma 4**: inference local via TensorFlow Lite Runtime
> - **Apple Intelligence**: APIs nativas de IA do iOS 18+
> - **Gemini Nano**: on-device via Google AI Edge SDK
>
> **Benefícios de on-device**: zero latência, funciona offline, privacidade total dos dados de saúde.
> **Trade-offs**: tamanho do modelo no bundle (100-500 MB), qualidade vs. cloud models, compatibilidade de dispositivos.
>
> Recomendação: spike dedicado de 1 sprint após Fase 6, com benchmark de qualidade vs. Groq.

---

## 9. Fases de Evolução

> Sprints semanais. Estimativas em semanas.

### Pré-Requisitos (Fundação) — ~2-3 semanas

| Item | Entrega |
|------|---------|
| Kit de Form Components | `FormInput`, `FormSelect`, `FormDatePicker`, `FormTimePicker`, `FormAutocomplete`, `FormSection`, `FormActions` |
| Hook `useFormState(schema)` | State + Zod validation + error scroll |
| Hook `useMutation()` | Loading, error, optimistic updates, toast feedback, cache invalidation |
| Infra ANVISA | Supabase Storage bucket + hook `useMedicineDatabase()` |

---

### Fase 1 — Medicamentos — ~2-3 semanas

| Item | Detalhes |
|------|---------|
| CRUD Medicamento | create, read, update, delete |
| Busca ANVISA | Tela de busca com autocomplete (medicamentos + laboratórios) |
| Detalhes | Tela de detalhes do medicamento |
| Formulário | Criação/edição full-screen stack |
| Validação | `medicineSchema` via Zod |
| Proteção | Confirmação de exclusão com verificação de dependências |
| **Quality Gates** | **G1 → G2 → G3 (end-to-end antes de Fase 2)** |

---

### Fase 2 — Protocolos / Tratamentos — ~2-3 semanas

| Item | Detalhes |
|------|---------|
| CRUD Protocolo | create, read, update, delete |
| Plano terapêutico | Agrupador (select existente ou criar novo) |
| Frequência | Pickers nativos (diário/semanal/etc) |
| Time schedule | Picker nativo de horários |
| Período | Start/end date com DatePicker nativo |
| ⏸️ Titulação | **Postergada** — requer audit na web primeiro |
| **Quality Gates** | **G1 → G2 → G3** |

---

### Fase 2.5 — Status de Tratamentos (Ativo / Pausado / Finalizado) — ~1 sprint

> Adicionada em 17/05/2026 após smoke da Fase 2 revelar gap de paridade com web.

| Item | Detalhes |
|------|---------|
| TabBar Ativos/Pausados/Finalizados | Espelha `TreatmentTabBar` da web; counts por tab |
| Helper canônico `resolveTreatmentStatus` | Em `@dosiq/core/utils/treatmentStatus.js`; web adopt no mesmo PR (G1 implícito) |
| Botão Pausar / Retomar no detail | `protocolService.update({ active })` via `useProtocolMutation.toggleActive` |
| Card visual por status | Pausado (opacity + chip cinza); Finalizado (bg cinza claro + badge "Finalizado em DD MMM YYYY") |
| Smoke | iOS + Android API 24 obrigatório (cobertura dos 3 status) |
| Spec | `EXEC_SPEC_FASE2_5_STATUS_TRATAMENTOS.md` |

---

### Fase 3 — Estoque — ~2 semanas

| Item | Detalhes |
|------|---------|
| CRUD Compras | Registro de compra (preço, quantidade, data, lote) |
| Indicadores | Previsão de reposição |
| Análise | Custo médio unitário |
| **Quality Gates** | **G1 → G2 → G3** |

---

### Fase 4 — Perfil Completo — ~1-2 semanas

| Item | Detalhes |
|------|---------|
| Edição | Dados pessoais (nome, data nasc., etc.) |
| Avatar | Upload/gerenciamento |
| Configurações | Tema, notificações (expandir o que já existe) |
| **Quality Gates** | **G1 → G2 → G3** |

---

### Fase 5 — Features Analíticas — ~2-3 semanas

| Item | Detalhes |
|------|---------|
| Histórico de Doses | Navegação histórica diária (healthHistory) |
| Aderência expandida | Expansão de períodos, visualizações temporais, trends |
| Ficha Médica | Resumo do paciente (read-only com export básico) |

---

### Fase 6 — Features Avançadas — ~3-4 semanas

| Item | Detalhes |
|------|---------|
| Cartão de Emergência | CRUD + QR code nativo + compartilhamento |
| Chatbot | Fase 1: Groq SDK com contexto do paciente |
| PDF Nativo | Geração de relatórios (react-native-pdf ou equivalente) |
| Mobile-only | Início dos spikes: camera, HealthKit, widgets |

---

### Timeline Visual

```
Semana  1  2  3   4  5  6   7  8   9 10  11  12 13 14  15 16 17  18 19 20 21
        ├──────┤  ├────────┤  ├────┤  ├──┤  ├────┤  ├──────┤  ├─────────────┤
        Pré-Req   Fase 1     Fase2  F2.5  Fase3   Fase 4    Fase 5    Fase 6
        Fundação  Medic. ✅  Trat. 🆕  Est.   Perfil    Analít.   Avançadas
        ✅        G1G2G3 ✅  G1G2G3 ✅
```

**Total estimado revisado: 15-21 semanas** (Fase 2.5 = +1 sprint)

---

## 10. Testes

### Pirâmide

```
                    ╱╲
                   ╱  ╲     E2E (Maestro/Detox) — happy path
                  ╱    ╲
                 ╱──────╲
                ╱        ╲   Integration — hooks + services mockados
               ╱          ╲
              ╱────────────╲
             ╱              ╲  Unit — services puros + schemas
            ╱                ╲  (compartilhados via @dosiq/core)
           ╱──────────────────╲
```

### Cobertura por Gate

| Gate | Cobertura mínima |
|------|-----------------|
| G1-Copy | Service 100% + hook 80% |
| G2-Extract | Factory 100% + integration web+mobile |
| G3-Migrate | Regressão web 0% (mesmos testes, novo import) |

---

## 11. Offline / Edge Cases

| Cenário | Comportamento |
|---------|---------------|
| CRUD sem internet | ❌ Erro claro: "Sem conexão. Tente novamente." |
| Leitura sem internet | ✅ Cache AsyncStorage (snapshot do último fetch) |
| Registrar dose sem internet | ✅ Queue local + sync ao reconectar (existente) |
| Busca ANVISA sem internet + sem cache | Formulário manual (sem autocomplete) |
| Edit concorrente web + mobile | Last-write-wins |

---

## 12. Evolução do Monorepo

### Atual → Alvo

```diff
  packages/
    core/          → schemas Zod + utils puros
    shared-data/   → Supabase factories + cache
+     createMedicineRepository.js      ← Fase 1 G2
+     createProtocolRepository.js      ← Fase 2 G2
+     createStockRepository.js         ← Fase 3 G2
+     createProfileRepository.js       ← Fase 4 G2
      createUserSessionRepository.js   ← Existente (padrão de referência)
      createNotificationLogRepository.js ← Existente
    config/        → Config factories
    design-tokens/ → Tokens visuais
    storage/       → Storage abstractions
```

> Cada factory recebe `{ supabase, getUserId }` — zero singletons, zero imports de plataforma.

---

## 13. Riscos e Mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Regressão web ao extrair services | Alta | Alto | Quality gates G2/G3 obrigatórios |
| Inconsistência de schemas | Média | Alto | Fonte única em `@dosiq/core` |
| Complexidade de formulários nativos | Alta | Alto | Form Kit como pré-requisito |
| Hermes/Polyfill issues | Média | Médio | R-168 + teste por service |
| Performance FlatList (listas grandes) | Média | Médio | Virtualização + paginação |
| Apple review (dados remotos ANVISA) | Baixa | Alto | Dados públicos, não código |
| Titulação instável na web | Média | Médio | Postergada — audit primeiro |

---

## Registro de Decisões (16/16 Aprovadas)

| # | Decisão | Status |
|---|---------|--------|
| D1 | Filosofia Service-First, Screen-Second | ✅ |
| D2 | Opção C (Híbrida Progressiva) com gates G1/G2/G3 | ✅ |
| D3 | ANVISA + Laboratórios: download + cache | ✅ |
| D4 | Hosting: Supabase Storage (bucket público) | ✅ |
| D5 | Supabase como fonte da verdade, last-write-wins | ✅ |
| D6 | CRUD online-only na v1 (doses exceção com queue) | ✅ |
| D7 | Sequência: Med → Proto → Estoque → Perfil → Analíticas → Avançadas | ✅ |
| D8 | Titulação postergada (audit web primeiro) | ✅ |
| D9 | Meta: paridade total médio prazo, mobile supera web longo prazo | ✅ |
| D10 | Design tokens compartilhados + adaptações nativas SO | ✅ |
| D11 | Emergência na Fase 6 (features avançadas) | ✅ |
| D12 | Chatbot previsto no mobile (Fase 6, Groq SDK) | ✅ |
| D13 | Sprints semanais | ✅ |
| D14 | Chatbot futuro: spike on-device (LiteRT/Gemma4/Apple Intelligence) | ✅ |
| D15 | Form Kit: build in-house (state + Zod, zero libs externas) | ✅ |
| D16 | Nunca mais de 1 domínio em transição simultânea | ✅ |

---

> **Próximo passo**: Com este documento aprovado, o próximo artefato será o **Execution Spec da Fase Pré-Requisitos** — detalhando file-by-file o que será construído no Form Kit, `useMutation`, e infraestrutura ANVISA.
