# EXEC SPEC — P0.2: Termômetro de Demanda Cuidador (v1.0 — 2026-05-30)

> **STATUS: 📋 SPEC PRONTA — AGUARDANDO CONCLUSÃO DO REFACTOR dose_instances**
> **Duração**: 1 sprint (T1.1)
> **Branch base**: `feat/termometro-cuidador`
> **Referência**: UNIFIED_ROADMAP_2026.md §3 (Pré-Fase 5) + backlog_review_analysis.md §1
> **Pré-condição**: ✅ Migration `rename_beta_signups_platform_to_feature.sql` aplicada pelo PO
> **Quality Gates**: G1 (Copy Mobile + PWA) → G2 (Merge)
> **SQP vinculante**: v2.0 ([INDEX_EXEC_SPECS.md](../backlog-native_app/INDEX_EXEC_SPECS.md))
> **Plataformas**: 📱 Mobile + 🌐 PWA

---

## §0 — Contexto Estratégico

### 0.1 O que é um "Termômetro de Demanda"?

É um **painted door test** — uma feature visualmente atraente que *parece* funcional mas na verdade coleta dados de interesse real. O objetivo é medir a demanda pelo Modo Cuidador **antes** de investir ~40 SP no desenvolvimento completo (Fase 7A).

O PO explicitamente descartou a ideia de um "Cuidador-Lite" funcional:
> *"Não acredito muito no modelo 'paciente chama cuidador'. Talvez um fake button que mede interesse."*

### 0.2 Fluxo do Usuário

```
Tela de Perfil (existente)
      │
      ▼
[ Botão "Modo Cuidador" ] ── visual atraente, ícone 👨‍👩‍👧, cor accent
      │ tap
      ▼
[ Bottom Sheet Explicativa ]
  ┌─────────────────────────────────────────┐
  │ 👨‍👩‍👧 Modo Cuidador                        │
  │                                         │
  │ Em breve: cuide da rotina de            │
  │ medicamentos da sua família!            │
  │                                         │
  │ • Configure os remédios no seu celular  │
  │ • Seu familiar recebe tudo pronto       │
  │ • Receba alertas quando esquecerem      │
  │                                         │
  │ ┌─────────────────────────────────────┐ │
  │ │ 📧 seu@email.com                    │ │
  │ └─────────────────────────────────────┘ │
  │                                         │
  │ [ 🔔 Quero ser avisado quando sair ]    │
  │                                         │
  │ Já temos ___ interessados!              │
  └─────────────────────────────────────────┘
```

### 0.3 KPI de Sucesso

| Métrica | Como medir | Gate de decisão |
|---------|-----------|----------------|
| % de MAU que clicam no botão | Analytics event `caregiver_interest_tap` | >5% → validação positiva |
| % de clicks que viram signup | `beta_signups WHERE feature='caregiver_mode'` / clicks | >30% → forte sinal |
| Volume absoluto de signups | `SELECT COUNT(*) FROM beta_signups WHERE feature='caregiver_mode'` | >50 → iniciar Fase 7A |

### 0.4 Infra Existente Reutilizada

O Dosiq já possui a infra completa de waitlist:

| Componente | Path | Status |
|-----------|------|--------|
| Tabela `beta_signups` | Supabase (coluna `feature`, ex-`platform`) | ✅ Existente — migration de rename pendente |
| Handler serverless | `api/users/_handlers/beta-signup.js` | ✅ Já atualizado (aceita `feature='caregiver_mode'`) |
| Service web | `apps/web/src/shared/services/betaSignupService.js` | ✅ Já atualizado (param `feature`) |
| Rate-limiting | In-memory no handler (5 req/min por IP) | ✅ Existente |
| Unique constraint | `(lower(email), feature)` | ✅ Via migration (idempotente, 23505 silenciado) |

**Migration pendente (ação PO antes de iniciar sprint):**
- Path: `docs/migrations/rename_beta_signups_platform_to_feature.sql`
- O que faz: `ALTER TABLE beta_signups RENAME COLUMN platform TO feature` + expande CHECK para incluir `'caregiver_mode'`
- Aplicar via: Supabase SQL Editor ou MCP
- Backward compat: valor `'android'` continua válido para a landing de testers

### 0.5 Cuidados Aprendidos

- **Bottom sheet Android**: `<Modal statusBarTranslucent>` + spacer `<View height={StatusBar.currentHeight}>` (R-233).
- **Validação e-mail**: Reutilizar o regex `EMAIL_RE` do handler (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) — já testado.
- **Hook order**: States → Memos → Effects → Handlers (R-010).
- **Mobile keyboard**: Bottom sheet com input de e-mail precisa de `KeyboardAvoidingView` ou `behavior="padding"` para não ser ocultada pelo teclado.
- **Analytics**: Se não houver SDK de analytics instalado, usar `debugLog` como placeholder até integrar.

---

## Objetivo

Implementar o termômetro de demanda com 3 componentes mínimos:
1. **Botão "Modo Cuidador"** na tela de Perfil (Mobile + PWA).
2. **Bottom sheet explicativa** com preview do valor + CTA de e-mail.
3. **Analytics event** `caregiver_interest_tap` para medir clicks.

**Fora do escopo P0.2 v1:**
- ❌ Funcionalidade real de cuidador (Fase 7A)
- ❌ Contador live de interessados na bottom sheet ("Já temos ___ interessados!")
- ❌ E-mail de confirmação automático ao interessado
- ❌ Landing page pública dedicada ao Modo Cuidador

---

## Sprint Breakdown

### Sprint T1.1 — Termômetro Cuidador (Semana ~1)

> **Gate alvo**: G1 (Copy Mobile + PWA)
> **Wave plan** (R-237):
> - **Wave 1 spawn paralelo**: T1.1 (Sonnet: botão + bottom sheet mobile), T1.2 (Haiku: botão + modal PWA)
> - **Wave 2 spawn**: T1.3 (Haiku: analytics event), T1.4 (Haiku: testes)
> - **Wave 3 inline Opus**: T1.5 (smoke PO mobile + PWA)

| # | Task | Arquivos | Agente | Complexidade |
|---|------|----------|--------|-------------|
| T1.1 | **Mobile: Botão + Bottom Sheet** — botão na ProfileScreen + CaregiverTeaser bottom sheet com input e-mail + CTA | `apps/mobile/src/features/profile/components/CaregiverTeaserButton.jsx`, `CaregiverTeaserSheet.jsx` | 🤖 Sonnet | ⭐⭐ |
| T1.2 | **PWA: Botão + Modal** — botão na tela de Perfil web + modal com mesmo conteúdo | `apps/web/src/views/ProfileView.jsx` (modify), `apps/web/src/shared/components/CaregiverTeaserModal.jsx` | 🤖 Haiku | ⭐⭐ |
| T1.3 | **Analytics event** — `caregiver_interest_tap` via `debugLog` (placeholder para SDK futuro) + `caregiver_waitlist_signup` no submit | `apps/mobile/src/features/profile/components/CaregiverTeaserSheet.jsx` (expand), `apps/web/...` (expand) | 🤖 Haiku | ⭐ |
| T1.4 | **Testes** — test do service call com mock fetch + test do CaregiverTeaserSheet render | `apps/mobile/src/features/profile/components/__tests__/CaregiverTeaserSheet.test.jsx`, `apps/web/.../__tests__/` | 🤖 Haiku | ⭐ |
| T1.5 | **Smoke PO** — validar fluxo completo mobile + PWA | (smoke) | 👤 Arquiteto | ⭐ |

**Entrega**: smoke PO (R-234) → push → `gh pr create` → merge em `feat/termometro-cuidador` → **merge em `main`**

---

## Especificações Técnicas Detalhadas

### T1.1 — `CaregiverTeaserButton.jsx` (Mobile)

```jsx
import React from 'react'
import { Pressable, Text, View, StyleSheet } from 'react-native'

/**
 * Botão visual "Modo Cuidador" na ProfileScreen.
 * Não é funcional — abre bottom sheet explicativa (painted door test).
 * Design: borda accent, ícone 👨‍👩‍👧, label "Em breve", badge "NOVO".
 */
export function CaregiverTeaserButton({ onPress }) {
  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Modo Cuidador — em breve"
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>👨‍👩‍👧</Text>
      </View>
      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Modo Cuidador</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>EM BREVE</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Cuide da rotina de medicamentos da sua família</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6366f1', // indigo accent
    backgroundColor: '#eef2ff',
  },
  iconContainer: { marginRight: 12 },
  icon: { fontSize: 28 },
  textContainer: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700', color: '#1e1b4b' },
  badge: { backgroundColor: '#6366f1', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: '#4338ca' },
  chevron: { fontSize: 22, color: '#6366f1', fontWeight: '300' },
})
```

### T1.1 — `CaregiverTeaserSheet.jsx` (Mobile Bottom Sheet)

```jsx
import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, Modal, StatusBar, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signupForBeta } from '@shared/services/betaSignupService'
import { debugLog } from '@shared/utils/debugLog'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Bottom sheet explicativa do Modo Cuidador (painted door test).
 * Captura e-mail de interessados via beta_signups (feature='caregiver_mode').
 *
 * NÃO é funcional — é um termômetro de demanda.
 */
export function CaregiverTeaserSheet({ visible, onClose }) {
  // States
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Handlers
  async function handleSubmit() {
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert('E-mail inválido', 'Digite um e-mail válido para ser notificado.')
      return
    }

    setLoading(true)
    debugLog('[CaregiverTeaser] caregiver_waitlist_signup', { email: email.trim() })

    const { success, error } = await signupForBeta(email.trim(), 'caregiver_mode')

    setLoading(false)

    if (success) {
      setSubmitted(true)
    } else {
      Alert.alert('Ops!', error || 'Não foi possível registrar. Tente novamente.')
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={{ height: StatusBar.currentHeight }} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.emoji}>👨‍👩‍👧</Text>
          <Text style={styles.title}>Modo Cuidador</Text>
          <Text style={styles.description}>
            Em breve: cuide da rotina de medicamentos da sua família!
          </Text>

          <View style={styles.features}>
            <FeatureRow icon="📱" text="Configure os remédios no seu celular" />
            <FeatureRow icon="🔗" text="Seu familiar recebe tudo pronto, sem complicação" />
            <FeatureRow icon="🔔" text="Receba alertas quando esquecerem de tomar" />
          </View>

          {submitted ? (
            <View style={styles.successContainer}>
              <Text style={styles.successEmoji}>✅</Text>
              <Text style={styles.successText}>
                Obrigado! Avisaremos quando o Modo Cuidador estiver disponível.
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                style={[styles.cta, loading && styles.ctaDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.ctaText}>
                  {loading ? 'Registrando...' : '🔔 Quero ser avisado quando sair'}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Fechar</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

function FeatureRow({ icon, text }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  handle: { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#1e1b4b', marginBottom: 8 },
  description: { fontSize: 15, textAlign: 'center', color: '#4b5563', marginBottom: 20 },
  features: { marginBottom: 20, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { fontSize: 20 },
  featureText: { fontSize: 14, color: '#374151', flex: 1 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12, color: '#111827' },
  cta: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  successContainer: { alignItems: 'center', padding: 16, gap: 8 },
  successEmoji: { fontSize: 32 },
  successText: { fontSize: 15, color: '#059669', textAlign: 'center', fontWeight: '600' },
  closeButton: { marginTop: 16, alignItems: 'center', padding: 12 },
  closeText: { fontSize: 15, color: '#6b7280' },
})
```

### Integração na ProfileScreen (Mobile)

```jsx
// Em ProfileScreen.jsx — adicionar dentro do ScrollView, após a seção existente:
import { CaregiverTeaserButton } from '../components/CaregiverTeaserButton'
import { CaregiverTeaserSheet } from '../components/CaregiverTeaserSheet'

// Dentro do componente:
const [showCaregiverTeaser, setShowCaregiverTeaser] = useState(false)

// No render, após a seção de alarmes (ou como último item antes de "Sobre"):
<CaregiverTeaserButton onPress={() => {
  debugLog('[Profile] caregiver_interest_tap')
  setShowCaregiverTeaser(true)
}} />
<CaregiverTeaserSheet
  visible={showCaregiverTeaser}
  onClose={() => setShowCaregiverTeaser(false)}
/>
```

### T1.2 — PWA: CaregiverTeaserModal (Web)

Mesmo conceito visual, adaptado para web. Reutiliza `signupForBeta(email, 'caregiver_mode')` diretamente.

```jsx
// CaregiverTeaserModal.jsx — componente lazy-loaded no ProfileView.jsx
import { signupForBeta } from '@shared/services/betaSignupService'

export function CaregiverTeaserModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { success, error } = await signupForBeta(email.trim(), 'caregiver_mode')
    setLoading(false)
    if (success) setSubmitted(true)
    else alert(error)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="caregiver-teaser-modal" onClick={(e) => e.stopPropagation()}>
        <span className="modal-emoji">👨‍👩‍👧</span>
        <h2>Modo Cuidador</h2>
        <p>Em breve: cuide da rotina de medicamentos da sua família!</p>
        {/* ... features list ... */}
        {submitted ? (
          <p className="success">✅ Avisaremos quando estiver disponível!</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" required />
            <button type="submit" disabled={loading}>
              {loading ? 'Registrando...' : '🔔 Quero ser avisado quando sair'}
            </button>
          </form>
        )}
        <button className="close" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}
```

---

## Estrutura de Diretórios (Resultado Final)

```
apps/mobile/src/
  features/
    profile/
      components/
        CaregiverTeaserButton.jsx             ← [NEW] botão visual na ProfileScreen
        CaregiverTeaserSheet.jsx              ← [NEW] bottom sheet explicativa
        __tests__/
          CaregiverTeaserSheet.test.jsx        ← [NEW]
      screens/
        ProfileScreen.jsx                      ← [MODIFY] +import + state + render do teaser

apps/web/src/
  shared/
    components/
      CaregiverTeaserModal.jsx                 ← [NEW] modal web (lazy-loaded)
    services/
      betaSignupService.js                     ← [ALREADY UPDATED] param feature
  views/
    ProfileView.jsx                            ← [MODIFY] +import + botão + modal render

docs/
  migrations/
    rename_beta_signups_platform_to_feature.sql ← [NEW — JÁ CRIADO] migration de rename
```

---

## Quality Gates — P0.2 Termômetro Cuidador

### G1 — Gate de Cópia (Mobile + PWA)

| Critério | Validação |
|----------|-----------|
| Migration aplicada pelo PO (column `platform` → `feature`) | Confirmação PO via Supabase SQL Editor |
| Botão "Modo Cuidador" visível na ProfileScreen mobile | Smoke PO mobile |
| Bottom sheet abre ao toque com R-233 (statusBarTranslucent) | Smoke PO Android API 24 |
| Input de e-mail funcional (keyboard avoiding, validação) | Smoke PO mobile |
| CTA "Quero ser avisado" insere em `beta_signups` com `feature='caregiver_mode'` | Query Supabase: `SELECT * FROM beta_signups WHERE feature='caregiver_mode'` |
| Mensagem de sucesso exibida após signup | Smoke PO |
| E-mail duplicado = sucesso silencioso (idempotente, 23505) | Smoke PO: submeter 2x mesmo email |
| PWA: botão + modal funcional na tela de perfil web | Smoke PO web |
| Landing page existente (testers Play Store) ainda funciona com `feature='android'` | Smoke PO web: testar landing |
| Analytics event `caregiver_interest_tap` no log (debugLog) | Log do simulador |
| `rtk lint` 0 erros | Output colado |
| `rtk npm run validate:agent` 100% green | Output colado |
| **Smoke PO (R-234) concluído antes de `gh pr create`** | Confirmação PO |

### G2 — Gate Final

| Critério | Validação |
|----------|-----------|
| G1 100% pass | Gate Report |
| `npm run build` web OK | Output colado |
| `npx expo export` mobile OK | Output colado |
| DEVFLOW C5 aplicado pós-merge | `.agent/` audit |
| PR mergeado em `main` com aprovação PO (R-060) | Confirmação PO |

---

## Delegação de Agentes

| Task ID | Agente | Motivo |
|---------|--------|--------|
| T1.1 | 🤖 Sonnet ⭐⭐ | Bottom sheet com input + fetch + states (complexidade moderada, pattern R-233 claro) |
| T1.2, T1.3, T1.4 | 🤖 Haiku ⭐ | Modal web simples + analytics placeholder + testes espelhados |
| T1.5 | 👤 Arquiteto (Opus) | Smoke PO cross-platform + integração |

---

## Riscos Especiais

> [!WARNING]
> **betaSignupService no mobile**: O service existente usa `fetch('/api/users/beta-signup', ...)` com path relativo. No mobile, isso **não funciona** — precisa da URL completa (`https://dosiq.app/api/users/beta-signup`). Verificar se já há um `API_BASE_URL` configurado no mobile (provavelmente em `nativeSupabaseClient.js` ou `config.js`). Se não houver, criar constante em `apps/mobile/src/config.js`.

> [!WARNING]
> **Teclado no bottom sheet**: Em Android, o teclado virtual pode cobrir o input de e-mail dentro da bottom sheet. Usar `KeyboardAvoidingView` com `behavior="padding"` dentro do `Modal`, ou `ScrollView` com `keyboardShouldPersistTaps="handled"`.

---

## Changelog

### v1.0 — 2026-05-30 (criação)
- Sprint T1.1 com 5 tasks
- Reutiliza infra existente (beta_signups + handler + service)
- Migration rename `platform` → `feature` criada e code updated
- Quality gates G1/G2
- Riscos: API URL no mobile, teclado em bottom sheet
