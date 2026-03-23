# Análise Técnica: Migração PWA → React Native

> **Tipo:** Documento técnico de alto nível — análise de viabilidade e roadmap de esforço
> **Contexto de produto:** `plans/canvas-produto-mercado.md`
> **Baseline técnico:** v3.1.0 (React 19 + Vite 7 + Supabase + Vercel Hobby)
> **Data:** 06/03/2026

---

## Sumário Executivo

A versão atual do Meus Remédios é uma PWA funcional com custo operacional R$0, cobertura cross-platform razoável e features avançadas já entregues. A migração para React Native é tecnicamente viável e reutilizaria aproximadamente **40-50% do código atual** (lógica de negócio, schemas, serviços), mas exigiria **reescrita completa da camada de UI** (~50-60% do esforço) e introduziria **custos recorrentes reais** (App Store, EAS Build, infraestrutura de backend desacoplada).

**A migração não é uma questão de "se" mas de "quando" e "com que escopo"**, e a resposta é diretamente mapeada pelos gatilhos de produto do canvas: o ponto de inflexão racional é **200-500 MAU**, quando as limitações concretas da PWA (iOS push confiável, distribuição via App Store, HealthKit/Google Fit) se tornam friccão de crescimento mensurável — não antes.

Este documento analisa o delta técnico, os blocos de esforço, os riscos e um framework de decisão para o momento certo.

---

## 1. Por que essa análise importa agora

O canvas de produto identifica três limitações estruturais da PWA que se tornam críticas em escala:

| Limitação PWA | Impacto no produto | Fase em que vira blocker |
|---------------|--------------------|--------------------------|
| **Push iOS não confiável sem instalação** | Dona Maria (persona primária, iOS prevalente no Brasil urbano acima de 50 anos) não recebe lembretes consistentes | Fase 7 — quando WhatsApp pode compensar, mas não eliminar |
| **Sem distribuição via App Store** | Descoberta orgânica por ASO inexistente, credibilidade reduzida em parcerias B2B (PSP farmacêutico exige "app nativo") | Fase de monetização B2B2C |
| **Sem acesso a APIs nativas de saúde** | HealthKit (iOS) e Google Fit (Android) — dados de PA, glicemia, peso — são diferenciais do backlog (Persona Carlos) e de parcerias com wearables | Backlog IoT |

A análise aqui feita serve como **insumo técnico para a decisão de timing**, não como mandato de migração imediata.

---

## 2. Análise da Stack Atual — O que temos

### 2.1. Mapa de código por camada

```
src/
├── features/          ~60% do código — lógica de domínio
│   ├── adherence/     cálculos de adesão, streaks, tendências
│   ├── dashboard/     analytics, insights, serviços de dashboard
│   ├── medications/   CRUD, base ANVISA, autocomplete
│   ├── protocols/     protocolos, titulação
│   └── stock/         estoque, análise de custo
│
├── schemas/           ~5% — validação Zod (platform-agnostic)
├── services/api/      ~5% — adherenceService, dlqService
│
├── shared/
│   ├── components/    ~20% — UI React (web-only: HTML/CSS/SVG)
│   ├── hooks/         ~5% — useCachedQuery, useTheme, etc.
│   ├── services/      ~3% — logService, cachedServices
│   └── utils/         ~2% — supabase client, queryCache
│
├── utils/             ~3% — dateUtils, adherenceLogic, titrationUtils
└── views/             ~5% — wrappers de views (web-only: layout HTML)

server/bot/            100% server-side — permanece inalterado
api/                   100% serverless — permanece ou migra para backend dedicado
```

### 2.2. Dependências críticas e sua portabilidade

| Dependência | Uso atual | Portabilidade para RN |
|-------------|-----------|----------------------|
| `react` 19 | Core UI | Compatível (RN usa React) |
| `@supabase/supabase-js` | Auth + DB | Compatível — SDK oficial para RN |
| `zod` 4 | Validação schemas | Compatível — pure JS |
| `framer-motion` 12 | Animações | **Incompatível** — web-only (DOM) |
| `vite` 7 | Build tool | **Incompatível** — substituído por Metro/Expo |
| `jspdf` + `jspdf-autotable` | PDF client-side | **Incompatível** — necessita alternativa |
| Web Push API (VAPID) | Notificações push | **Incompatível** — substituído por FCM/APNs |
| `Web Speech API` | Voz (Fase 8) | **Incompatível** — substituído por Expo Speech |
| `Service Worker` | PWA offline | **Não existe em RN** — substituído por AsyncStorage + network layer |
| CSS Modules / CSS vars | Estilos | **Incompatível** — substituído por StyleSheet/NativeWind |
| `@testing-library/react` | Testes de componentes | Substituído por `@testing-library/react-native` |
| `vitest` 4 | Testes unitários | Compatível para lógica pura; Jest para RN |

### 2.3. O que é genuinamente reutilizável sem modificação

```
REUTILIZÁVEL DIRETO (~40-50% do código):

src/schemas/           100% — Zod é platform-agnostic
src/utils/             100% — dateUtils, adherenceLogic, titrationUtils
src/services/api/      100% — pure JS, sem DOM
src/features/*/services/  ~90% — lógica de negócio pura
src/features/*/utils/  100% — funções puras

REUTILIZÁVEL COM AJUSTES (~10%):

src/shared/hooks/      ~60% — lógica reutilizável, bindings de UI precisam adaptar
src/shared/services/   ~80% — lógica reutilizável, storage muda (localStorage → AsyncStorage)

NÃO REUTILIZÁVEL (~50%):

src/shared/components/ 0% — HTML/CSS/SVG → RN components
src/views/             0% — HTML layout → RN screens
src/features/*/components/  0% — mesma razão
CSS (todos os arquivos) 0% — StyleSheet API + design tokens
```

---

## 3. Arquitetura Alvo — React Native

### 3.1. Stack tecnológica proposta

| Camada | Tecnologia atual (PWA) | Tecnologia proposta (RN) | Justificativa |
|--------|------------------------|--------------------------|---------------|
| **Runtime** | React 19 + Vite | React Native 0.76+ com Expo SDK 52 | Expo acelera setup, OTA updates, EAS Build |
| **Navegação** | View-based custom (setCurrentView) | React Navigation 7 (Stack + Tab) | Padrão de fato para RN |
| **Animações** | Framer Motion 12 | React Native Reanimated 3 | GPU-accelerated, worklets na UI thread |
| **Estilos** | CSS Modules + CSS variables | NativeWind v4 (Tailwind para RN) ou StyleSheet API | NativeWind mantém DX familiar |
| **Formulários** | HTML forms + Zod | React Hook Form + Zod (mesmos schemas) | Zod reutilizado integralmente |
| **Backend** | Supabase SDK web | `@supabase/supabase-js` (suporte oficial RN) | Sem mudança |
| **Auth** | Supabase Auth (sessão automática) | Supabase Auth + SecureStore (Expo) | Tokens em storage seguro nativo |
| **Storage local** | localStorage | AsyncStorage ou MMKV (mais rápido) | MMKV recomendado para cache pesado |
| **Cache/SWR** | useCachedQuery custom | Mesma lógica + AsyncStorage | Adaptar hook existente |
| **Push notifications** | Web Push API (VAPID) | Expo Notifications (FCM + APNs) | Suporte nativo iOS e Android |
| **PDF** | jsPDF (client-side) | react-native-pdf-lib ou Expo Print | Impressão nativa ou geração via API |
| **Voz** | Web Speech API | Expo Speech (síntese) + expo-av (reconhecimento) | APIs nativas encapsuladas |
| **Build** | Vite (instantâneo) | Expo EAS Build | Cloud build, ~10-20min por build |
| **OTA Updates** | Deploy Vercel (automático) | Expo Updates (OTA para JS bundle) | Bypassa App Store para updates de JS |
| **Testes unitários** | Vitest 4 | Jest 29 + `@testing-library/react-native` | Schemas/utils continuam com Vitest se mono-repo |
| **Distribuição** | URL (zero custo) | App Store ($99/ano) + Google Play ($25 único) | Custo novo e recorrente |

### 3.2. Estrutura de projeto proposta

Duas estratégias possíveis: **mono-repo** ou **repositório separado**.

#### Opção A: Mono-repo (recomendada para este projeto)

```
meus-remedios/                    (raiz — repo atual)
├── apps/
│   ├── web/                      (PWA atual — src/ atual movido para cá)
│   └── native/                   (React Native / Expo)
│       ├── app/                  (React Navigation screens)
│       ├── components/           (componentes RN-específicos)
│       └── hooks/                (hooks RN-específicos)
│
├── packages/
│   ├── core/                     (lógica compartilhada — schemas, services, utils)
│   │   ├── schemas/              (src/schemas/ atual)
│   │   ├── services/             (src/features/*/services/ + src/services/api/)
│   │   └── utils/                (src/utils/ atual)
│   └── supabase/                 (cliente Supabase compartilhado)
│
├── server/bot/                   (Telegram bot — sem mudança)
├── api/                          (Vercel serverless — sem mudança ou migração)
├── package.json                  (workspaces: ["apps/*", "packages/*"])
└── turbo.json                    (Turborepo para builds paralelos)
```

**Vantagens:** Código compartilhado real (schemas e services são a fonte única de verdade para web e native), refactor em um lugar propaga para ambos, DX unificado.

**Desvantagens:** Setup inicial mais complexo (Turborepo, workspaces), Metro bundler não entende todos os módulos Node.js.

#### Opção B: Repositório separado

```
meus-remedios-native/             (novo repo)
├── src/
│   ├── screens/                  (equivalente a views/)
│   ├── components/               (componentes RN)
│   ├── schemas/                  (copiado/symlink de schemas/ do repo web)
│   ├── services/                 (copiado/adaptado)
│   └── utils/                   (copiado/adaptado)
```

**Vantagens:** Menos complexidade de setup, equipe pode focar no RN sem impactar a PWA.

**Desvantagens:** Duplicação de código inevitável, divergência de schemas ao longo do tempo (grave risco dado que Zod/SQL devem estar sincronizados — regra R-021 e R-022).

**Decisão recomendada:** Mono-repo com Turborepo. O risco de divergência de schemas entre plataformas é o argumento mais forte — o projeto já tem regras rígidas de sincronização Zod/SQL, e duplicar os schemas em dois repos criaria exatamente o "schema drift" que o Sprint 7 post-mortem identificou como falha crítica.

---

## 4. Mapeamento Tecnológico Detalhado

### 4.1. Componentes UI — o maior bloco de esforço

Cada componente atual precisa ser reescrito. Não há atalho, mas há estratégia:

| Componente atual (Web) | Equivalente RN | Esforço | Observações |
|------------------------|----------------|---------|-------------|
| `Button.jsx` | `TouchableOpacity` / `Pressable` | Baixo | Lógica simples, só muda o primitivo |
| `Card.jsx` | `View` + `StyleSheet` | Baixo | — |
| `Modal.jsx` | `Modal` (RN built-in) ou `@gorhom/bottom-sheet` | Médio | Bottom sheet é mais idiomático em mobile |
| `Calendar.jsx` (heatmap) | `react-native-calendars` ou custom com `FlatList` | Alto | Componente complexo com lazy loading e markedDates |
| `RingGauge.jsx` (SVG) | `react-native-svg` + mesma lógica SVG | Médio | RN suporta SVG via lib; lógica de cálculo reutilizável |
| `Sparkline.jsx` (SVG) | `react-native-svg` | Médio | Mesma estratégia |
| `DoseTimeline.jsx` | Custom com `FlatList` + `react-native-svg` | Alto | Animações complexas |
| `StockBars.jsx` | Custom com `View` + `Animated` | Médio | — |
| `AlertList.jsx` | `FlatList` com `SwipeableRow` | Médio | Interação de swipe nativa |
| `SwipeRegisterItem.jsx` | `react-native-gesture-handler` | Alto | Gesture é mais complexo em RN |
| `MedicineForm.jsx` | `KeyboardAvoidingView` + `TextInput` | Médio | Keyboard handling é crítico em RN |
| `MedicineAutocomplete.jsx` | Custom com `FlatList` dropdown | Médio | — |
| `BottomNav.jsx` | React Navigation `Tab.Navigator` | Baixo | Framework cuida disso |
| `ViewModeToggle.jsx` | `SegmentedControl` (iOS) / custom | Baixo | — |
| Framer Motion animations | Reanimated 3 worklets | Alto | API completamente diferente |
| CSS tokens/themes | `useColorScheme` + design tokens JSON | Médio | Tokens JSON reutilizáveis, bindings mudam |

### 4.2. Navegação — mudança arquitetural

**Atual (PWA):**
```javascript
// App.jsx — view-based, sem URL
const [currentView, setCurrentView] = useState('dashboard')
// DashboardProvider wraps everything
```

**Proposto (RN):**
```javascript
// App.tsx
const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function AppNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Hoje" component={DashboardScreen} />
      <Tab.Screen name="Tratamento" component={TreatmentStack} />
      <Tab.Screen name="Estoque" component={StockScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  )
}
```

**O DashboardProvider** (context global) é diretamente reutilizável — context API funciona identicamente em RN.

### 4.3. Push Notifications — mudança crítica de arquitetura

**Atual (PWA):**
```
Service Worker (browser) ← VAPID push ← api/notify.js (Vercel cron)
  └── Web Push API
  └── Funciona mal em iOS sem instalação PWA
```

**Proposto (RN):**
```
Expo Notifications ← FCM (Android) / APNs (iOS) ← api/notify.js (Vercel cron — sem mudança)
  └── Supabase armazena: expo_push_token (novo campo em users)
  └── api/notify.js usa Expo Push API em vez de VAPID
  └── Funciona nativo em iOS e Android, mesmo com app em background fechado
```

**Delta no schema:**
```sql
-- Adicionar ao perfil do usuário
ALTER TABLE profiles ADD COLUMN expo_push_token text;
ALTER TABLE profiles ADD COLUMN notification_channel text DEFAULT 'push'; -- push|telegram|whatsapp
```

**Delta no api/notify.js:**
```javascript
// Atual
await sendWebPush(subscription, payload) // VAPID

// Novo (RN)
await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  body: JSON.stringify({ to: expoPushToken, title, body, data }),
})
```

**Impacto no budget Vercel:** Nenhum — mesmo `api/notify.js`, apenas muda o provider de push. O budget de 6/12 functions não é afetado.

### 4.4. PDF — mudança de abordagem

**Atual:** jsPDF gera PDF 100% client-side no browser. Zero custo de servidor.

**Problema em RN:** jsPDF usa APIs de browser DOM (`document.createElementNS`, canvas) — não existe em RN.

**Opções:**

| Opção | Abordagem | Custo | Prós | Contras |
|-------|-----------|-------|------|---------|
| **Expo Print** | HTML string → PDF nativo | R$0 | Simples, mantém layout HTML atual | Menos controle sobre layout |
| **react-native-html-to-pdf** | HTML → PDF nativo | R$0 | Similar ao Expo Print | Dependência nativa |
| **Serverless endpoint** | api/pdf.js gera PDF no servidor (usa jsPDF server-side) | R$0 (dentro do budget) ou +1 function | Reutiliza código atual; geração consistente | +1 serverless function (7/12) |
| **react-native-pdf-lib** | PDF programático em RN | R$0 | Controle total | API diferente do jsPDF atual |

**Recomendação:** `Expo Print` para o MVP nativo. Renderiza HTML template → PDF nativo com compartilhamento via `expo-sharing`. A lógica de montagem do relatório (dados, cálculos, formatação) é 100% reutilizável — só o "renderer" muda.

### 4.5. Armazenamento local — mudança de mecanismo

**Atual:** `localStorage` para analytics, frequency capping de insights, preferências de tema.

**RN:** `localStorage` não existe. Opções:

| Uso atual | Solução RN | Notas |
|-----------|------------|-------|
| `mr_analytics` (analyticsService) | `@react-native-async-storage/async-storage` | API similar (key-value async) |
| Frequency capping de insights | AsyncStorage ou MMKV | MMKV é síncrono e 10x mais rápido |
| Preferências (tema, canal) | AsyncStorage | — |
| Cache SWR (useCachedQuery) | MMKV | Performance crítica para cache |
| Supabase session token | `expo-secure-store` | Tokens em keychain/keystore seguros |

**Impacto no código:** Os services que usam `localStorage` precisam receber um adaptador de storage. Padrão recomendado:

```javascript
// packages/core/utils/storageAdapter.js
// Web:
export const storage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
}

// Native (apps/native/utils/storageAdapter.js):
import { MMKV } from 'react-native-mmkv'
const store = new MMKV()
export const storage = {
  getItem: (key) => store.getString(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
}
```

Injetar o adaptador via inicialização do app (não hardcoded nos services). Essa abstração já resolve o problema de testes também (mock trivial).

### 4.6. Voz (Fase 8) — upgrade, não downgrade

**Atual (Web Speech API):**
- Cobertura parcial: funciona no Chrome, limitado no Safari/iOS
- Reconhecimento de voz: não confiável no iOS sem instalação

**RN (Expo Speech + expo-av):**
- `expo-speech`: síntese de voz (TTS) — funciona em iOS e Android
- `@react-native-voice/voice`: reconhecimento de voz (STT) — APIs nativas do sistema
- Resultado: experiência de voz **muito superior** ao Web Speech API no mobile

Esta é uma área onde a migração para RN é claramente superior ao estado atual da PWA.

### 4.7. Telegram bot e serverless — sem mudança

O `server/bot/` (Node.js) e `api/` (Vercel serverless) são completamente independentes do frontend. A migração para RN não os afeta. O app RN consome as mesmas APIs do Supabase e os mesmos endpoints Vercel.

---

## 5. Estimativa de Esforço

### 5.1. Decomposição por bloco

| Bloco | Descrição | Esforço (Story Points) | Paralelizável? |
|-------|-----------|------------------------|----------------|
| **B1 — Setup mono-repo** | Turborepo + workspaces, extrair packages/core, configurar Metro | 8 SP | Não — base para tudo |
| **B2 — Expo + navegação** | Expo SDK, React Navigation 7, Tab + Stack navigators, deep links | 5 SP | Após B1 |
| **B3 — Auth flow** | Supabase Auth em RN, SecureStore para tokens, splash screen, onboarding | 8 SP | Após B1 |
| **B4 — Design system nativo** | NativeWind v4 (ou StyleSheet), tokens de cor/espaçamento/tipografia | 13 SP | Após B1 |
| **B5 — Componentes primitivos** | Button, Card, Modal, Input, AlertList, Badge | 8 SP | Após B4 |
| **B6 — Push notifications** | Expo Notifications, FCM/APNs config, delta no api/notify.js | 8 SP | Após B3 |
| **B7 — Screen: Dashboard** | Reconstrução do Dashboard (RingGauge, DoseTimeline, StockBars, insights) | 21 SP | Após B5 |
| **B8 — Screen: Hoje (doses)** | DoseZoneList, SwipeRegister, BatchRegister, registro retroativo | 13 SP | Após B5 |
| **B9 — Screen: Tratamento** | MedicineForm + Autocomplete ANVISA, ProtocolForm, TreatmentWizard | 13 SP | Após B5 |
| **B10 — Screen: Estoque** | StockForm, StockBars, CostChart, análise de custo | 8 SP | Após B5 |
| **B11 — Screen: Histórico** | Calendário heatmap, HealthHistory, filtros | 13 SP | Após B5 |
| **B12 — Screen: Configurações** | Preferências, canal de notificação (Telegram/WhatsApp), perfil | 5 SP | Após B5 |
| **B13 — PDF nativo** | Expo Print, HTML template, compartilhamento | 5 SP | Após B9 |
| **B14 — Cartão de emergência** | Offline card, QR code (se aplicável) | 3 SP | Após B9 |
| **B15 — Analytics nativo** | Adaptar analyticsService para AsyncStorage/MMKV | 3 SP | Após B1 |
| **B16 — Testes** | Configurar Jest + RNTL, migrar testes de componentes | 8 SP | Paralelo com B5-B12 |
| **B17 — CI/CD nativo** | EAS Build + GitHub Actions, TestFlight (iOS), Internal Testing (Android) | 5 SP | Após B3 |
| **B18 — App Store submission** | Metadados, screenshots, review da Apple/Google | 5 SP | Ao final |

**Total estimado: ~143 SP**

Com cadência de 10-15 SP/sprint (2 semanas): **~10-14 sprints = 20-28 semanas** para MVP nativo com paridade de features.

### 5.2. Fases de entrega sugeridas (se decidir migrar)

```
FASE RN-1 — Fundação (B1+B2+B3+B6+B17): ~34 SP, ~3 sprints
  Resultado: App instável mas com Auth, navegação e push funcionando
  Gate: App instalável via TestFlight/Internal Testing

FASE RN-2 — Core Features (B4+B5+B7+B8+B15+B16): ~53 SP, ~4-5 sprints
  Resultado: Dashboard + registro de doses funcionando
  Gate: DAU/MAU tracking, adesão registrável no app nativo

FASE RN-3 — Paridade (B9+B10+B11+B12+B13+B14): ~47 SP, ~3-4 sprints
  Resultado: Paridade completa com a PWA atual
  Gate: Todos os testes críticos passando (93+)

FASE RN-4 — Launch (B18): ~9 SP, ~1 sprint
  Resultado: Apps publicados nas lojas
  Gate: Aprovação Apple/Google
```

### 5.3. Custo de manutenção futura (dual-stack)

Se mantiver a PWA em paralelo durante a migração (estratégia de strangler fig), há custo de manutenção dual:
- Toda nova feature precisaria ser implementada em **ambas as plataformas** (ou adiada para o app nativo)
- O mono-repo com `packages/core` minimiza isso — lógica de negócio e schemas são implementados uma vez

**Recomendação:** Congelar novas features na PWA ao iniciar RN-2 (Core Features). Manter a PWA funcional mas sem evolução até paridade ser atingida.

---

## 6. Novas Capacidades Desbloqueadas

A migração para RN não é só uma reescrita — ela habilita features impossíveis ou muito limitadas na PWA:

### 6.1. Push Notifications iOS confiáveis

A maior limitação real da PWA hoje. No iOS, push web só funciona de forma confiável em apps instalados **e** apenas a partir do iOS 16.4. O app nativo recebe push em qualquer estado (background, fechado) via APNs — exatamente o que Dona Maria precisa para não perder a losartana.

### 6.2. HealthKit (iOS) e Google Fit (Android)

Persona Carlos (executivo com Apple Watch) é habilitada. Leitura automática de:
- Pressão arterial (Omron + Apple Watch)
- Glicemia (FreeStyle LibreLink, OneTouch Reveal)
- Peso (Withings, Garmin)
- Passos e sono (correlações com adesão)

Correlação "Sua PA estava 150x95 no dia em que perdeu 2 doses de losartana" torna-se possível.

### 6.3. Bluetooth Low Energy (BLE)

Smart pill boxes (Pillsy, AdhereTech) comunicam via BLE. Detecção automática de abertura do compartimento → dose registrada sem interação manual. Relevante para o backlog de IoT.

### 6.4. Biometria para autenticação

Face ID / Touch ID para autenticação rápida — crítico para usuário que abre o app múltiplas vezes ao dia para registrar doses. Via `expo-local-authentication`.

### 6.5. Widgets na tela home

iOS e Android suportam widgets. Um widget "Próximas doses" na tela home — sem abrir o app — é uma funcionalidade de alto valor para adesão. Via `react-native-widget-extension` (iOS) ou Glance Widgets (Android).

### 6.6. App Store SEO (ASO)

Distribuição via lojas com busca por "lembrete de remédio", "controle diabetes", "hipertensão app" — maior discoverability do que uma URL de PWA.

### 6.7. Modo offline-first robusto

Service Workers são limitados e complexos. RN com AsyncStorage + React Query offline mode entrega uma experiência offline genuinamente consistente — crítico para pacientes em áreas com conectividade intermitente.

---

## 7. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Divergência de schemas (PWA vs. RN)** | Alta (sem mono-repo) | Crítico | Mono-repo com `packages/core` como fonte única |
| **Metro bundler incompatibilidade** | Média | Alto | Configurar `metro.config.js` para resolver workspaces; usar `moduleNameMapper` |
| **Expo managed workflow limitações** | Baixa | Médio | Avaliar bare workflow se precisar de módulos nativos customizados (BLE, HealthKit) |
| **Apple Review delay** | Alta (primeira submissão: 1-7 dias) | Médio | Usar TestFlight para beta, planejar 2 semanas de buffer para submissão |
| **Reanimated 3 complexity** | Alta | Médio | DoseTimeline e SwipeRegister são os componentes mais arriscados — prototipas antes de comprometer |
| **Expo EAS Build custo** | Baixa | Médio | Free tier: 30 builds/mês (suficiente para desenvolvimento). Pago: $29/mês para produção |
| **NativeWind v4 estabilidade** | Média | Baixo | Alternativa: StyleSheet puro com design tokens JSON — mais verboso mas estável |
| **react-native-mmkv incompatibilidade com Expo Go** | Alta | Baixo | Usar Expo dev client (EAS) em vez do Expo Go para desenvolvimento |
| **Web Speech API → expo-av gap** | Baixa | Baixo | Expo Speech e Voice têm boa cobertura; degradação graceful mantida |

---

## 8. Análise de Custos — Delta Real

### 8.1. Custos atuais (PWA)

| Item | Custo mensal |
|------|-------------|
| Vercel Hobby | R$0 |
| Supabase Free Tier | R$0 |
| **Total** | **R$0** |

### 8.2. Custos novos com React Native

| Item | Custo | Frequência | Observação |
|------|-------|------------|------------|
| Apple Developer Program | $99/ano (~R$500/ano) | Anual | Obrigatório para publicar na App Store |
| Google Play Developer | $25 (~R$130) | Único | Taxa única de registro |
| Expo EAS Build (Free) | R$0 | Mensal | 30 builds/mês — suficiente para desenvolvimento |
| Expo EAS Build (Production) | $29/mês (~R$145/mês) | Mensal | Se builds ilimitados necessários em produção |
| **Total mínimo** | **~R$500/ano** | Anual | Apenas Apple + Google Play |
| **Total confortável** | **~R$2.240/ano** | Anual | Inclui EAS Build Production |

**Impacto no princípio "custo R$0":** O produto continua **gratuito para o usuário** — o custo de desenvolvimento/distribuição é absorvido pelo criador. A promessa ao paciente não muda.

### 8.3. Supabase — sem mudança

O SDK do Supabase tem suporte oficial para React Native. Free tier (500MB, 5GB bandwidth) é suficiente para até ~500 usuários ativos — o gatilho de migração para RN é anterior a esse limite.

---

## 9. Framework de Decisão — Quando Migrar

### 9.1. Gatilhos de produto (quando a migração se justifica)

| Gatilho | Indicador mensurável | Status atual |
|---------|---------------------|--------------|
| **Push iOS comprovadamente limitando adesão** | >20% dos usuários iOS reportam não receber lembretes; churn D7 de iOS maior que Android | Não atingido |
| **App Store demandado por parceiro B2B** | PSP farmacêutico ou plano de saúde exige "app nativo listado na loja" como pré-requisito contratual | Não atingido |
| **MAU estagnado na PWA** | MAU < crescimento esperado por >3 meses após WhatsApp ativo, e evidência de fricção de instalação | Não atingido |
| **HealthKit/Google Fit demandado** | >15% dos usuários solicitam integração com wearables | Não atingido |
| **200+ MAU ativos** | Volume que justifica investimento em distribuição nativa | Em progresso |

### 9.2. Pré-condições técnicas (o que deve estar pronto antes de migrar)

```
[ ] Mono-repo configurado (Turborepo + workspaces)
[ ] packages/core extraído e testado (schemas, services, utils)
[ ] 100% dos testes críticos passando no core (sem regressão durante extração)
[ ] Expo + React Navigation prototipado (spike de 1 sprint)
[ ] EAS Build configurado e build de desenvolvimento funcionando
[ ] Supabase Auth testado em RN com SecureStore
[ ] Push Notifications testadas em dispositivo real iOS (FCM não é suficiente — testar APNs)
```

### 9.3. Decisão recomendada

```
HOJE (v3.1.0 — <50 MAU):
  NÃO migrar. Focar em Fases 6, 7, 8 na PWA.
  A PWA ainda tem capacidade de crescimento significativa,
  especialmente com WhatsApp (Fase 7) compensando limitações de iOS push.

FASE 7 (WhatsApp ativo — 50-200 MAU):
  Realizar SPIKE de 1 sprint (B1+B2+B3 parcial):
  - Configurar mono-repo
  - Prototipar Expo com Auth e navegação
  - Validar EAS Build
  - Testar push nativo iOS com dispositivo real
  → Acumular conhecimento sem comprometer entregas de produto

FASE 8 / PÓS-FASE 8 (200+ MAU, evidência de limitação iOS):
  Decisão GO/NO-GO baseada nos gatilhos acima.
  Se GO: iniciar RN-1 (Fundação) em paralelo com manutenção da PWA.
  Se NO-GO: continuar PWA até próximo ciclo de avaliação (a cada 100 MAU).

BACKLOG (500+ MAU, parceria B2B confirmada):
  Migração completa justificada. Iniciar RN-2 (Core Features).
  PWA entra em modo manutenção (sem novas features).
```

---

## 10. Plano de Spike Recomendado (1 Sprint)

Antes de qualquer decisão de migração, um spike de 1 sprint (2 semanas) deve ser executado para validar as hipóteses técnicas de maior risco:

### Sprint Spike-RN (após Fase 7 estar em produção)

**Objetivos:**

1. **Validar mono-repo** — Configurar Turborepo, extrair `packages/core` com schemas e services, garantir que os 93 testes críticos passam sem modificação após extração.

2. **Validar Expo + Auth** — Instalar Expo SDK, configurar Supabase Auth com SecureStore, testar login/logout em dispositivo real iOS e Android.

3. **Validar push nativo iOS** — Configurar APNs (certificado Apple), testar Expo Notifications recebendo push com app em background no iPhone real. Este é o ponto de maior risco — se não funcionar no device real, toda a premissa da migração é questionável.

4. **Validar DoseTimeline com Reanimated 3** — Recriar apenas o componente `DoseTimeline` em RN com Reanimated. Este é o componente de maior risco de animação — se funcionar bem, o resto é escalável.

5. **Medir DX** — Avaliar ciclo de desenvolvimento: hot reload com Metro vs. Vite, tempo de build EAS vs. Vite build.

**Entregáveis do spike:**
- Repositório mono-repo configurado
- Testes críticos passando no `packages/core`
- App RN minimal rodando em iOS e Android com Auth
- Push notification recebida em iPhone real
- `DoseTimeline` prototipado com Reanimated 3
- Documento de achados: o que funcionou, o que surpreendeu, estimativa revisada

**Custo:** 1 sprint de desenvolvimento. Não impacta o roadmap principal da PWA se feito em paralelo.

---

## Apêndice A — Tabela de Compatibilidade de Dependências

| Pacote | Versão atual | Status RN | Alternativa se necessário |
|--------|-------------|-----------|---------------------------|
| `react` | 19 | Compatível (RN 0.76 usa React 19) | — |
| `@supabase/supabase-js` | latest | Compatível | — |
| `zod` | 4 | Compatível | — |
| `framer-motion` | 12 | Incompatível | `react-native-reanimated` 3 |
| `jspdf` | latest | Incompatível | `expo-print` + `expo-sharing` |
| `jspdf-autotable` | latest | Incompatível | Template HTML para `expo-print` |
| `react-router-dom` | (não usado — custom nav) | N/A | `react-navigation` 7 |
| `@testing-library/react` | latest | Incompatível | `@testing-library/react-native` |
| `vitest` | 4 | Incompatível para RN | Jest 29 (para componentes RN); Vitest mantido para `packages/core` |
| `node-telegram-bot-api` | latest | N/A (server-side) | Sem mudança |
| `date-fns` ou nativas | — | Compatível | — |

---

## Apêndice B — Capacidades PWA vs. React Native

| Capacidade | PWA (atual) | React Native | Vantagem |
|------------|-------------|--------------|----------|
| Push iOS confiável | Parcial (iOS 16.4+ instalado) | Total (APNs nativo) | RN |
| Push Android | Total | Total | Empate |
| App Store | Não | Sim | RN |
| Widgets tela home | Não | Sim | RN |
| HealthKit / Google Fit | Não | Sim | RN |
| Bluetooth (smart pillbox) | Limitado (Web Bluetooth) | Total (BLE) | RN |
| Biometria (Face ID) | Limitado (WebAuthn) | Total | RN |
| Offline robusto | Limitado (SW complexo) | Sólido (AsyncStorage) | RN |
| Voz (STT/TTS) | Parcial (iOS limitado) | Total (APIs nativas) | RN |
| Distribuição (URL) | Total | Apenas lojas | PWA |
| Tempo para primeira versão | 0 (já existe) | 20-28 semanas | PWA |
| Custo de distribuição | R$0 | R$500+/ano | PWA |
| Hot reload DX | Excelente (Vite HMR) | Bom (Metro, melhorado no RN 0.76) | PWA |
| Bundle updates sem App Store | N/A | Sim (Expo OTA) | RN |
| Instalação sem loja | Sim (URL) | Não | PWA |
| Acessível sem instalar nada | Sim | Não | PWA |

---

*Documento criado em: 06/03/2026*
*Para leitura junto com: `plans/canvas-produto-mercado.md`, `plans/ROADMAP_v4.md`*
