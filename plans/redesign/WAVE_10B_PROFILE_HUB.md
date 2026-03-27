# Wave 10B — Profile Hub + Migração de Dados para Supabase

**Status:** ⏳ PENDENTE EXECUÇÃO (aguarda entrega de 10A)
**Data de criação da spec:** 2026-03-27
**Dependências:** W0-W9 ✅ + W10A (Settings Extraction)
**Risco:** MÉDIO — inclui migration SQL (novas colunas em `user_settings`), lógica de migração localStorage → Supabase, e rewrite completo do ProfileRedesign
**Branch:** `feature/redesign/wave-10b-profile-hub`
**Master doc:** `WAVE_10_PERFIL_HISTORICO_SETTINGS.md`

---

## Por que esta sub-wave existe

O ProfileRedesign entregue na Wave 9 usa layout sidebar + seções (3 categorias com links). Após avaliação com o designer, o perfil deveria ser um **hub centralizado** — um ponto de acesso rápido que responde à pergunta: *"Quem sou eu neste sistema e o que posso acessar?"*

Além disso, os dados de perfil do paciente (nome, idade, tipo sanguíneo, localização) atualmente vivem dispersos:
- **Nome:** `auth.users.user_metadata.name` (Supabase Auth, pode estar vazio)
- **Tipo sanguíneo, alergias, contatos:** `user_settings.emergency_card` (JSONB) — também em `localStorage` via write-through
- **Idade, cidade, estado:** **NÃO existem** em lugar nenhum

Esta wave resolve ambos: visual (hub) + dados (migração para Supabase com novas colunas).

---

## O que esta wave FAZ

- Reescreve `src/views/redesign/ProfileRedesign.jsx` como hub centralizado (elimina sidebar de seções)
- Cria novos sub-componentes para o hub
- Cria coluna `emergency_card` JSONB em `user_settings` (dívida técnica — coluna nunca foi criada, emergencyCardService falhava silenciosamente)
- Adiciona colunas `display_name`, `birth_date`, `city`, `state` em `user_settings`
- Sync one-time: dados do cartão de emergência em localStorage → Supabase (no load do Profile Hub)
- Cria formulário "Editar Perfil" com persistência no Supabase
- Cria schema Zod para validação dos campos de perfil
- Redesenha o Cartão de Emergência como card visual inline no perfil
- Cria migration SQL documentada

## O que esta wave NÃO FAZ

- ❌ NÃO toca em `Profile.jsx` (view original intacta)
- ❌ NÃO modifica `Emergency.jsx` ou `EmergencyCardView.jsx` (originais intactos)
- ❌ NÃO modifica `emergencyCardService.js` (write-through pattern mantido)
- ❌ NÃO modifica `emergencyCardSchema.js` (schema de saúde mantido)
- ❌ NÃO implementa upload de avatar/foto (evitar custos de storage)
- ❌ NÃO implementa Compartilhamento/Cuidadores (roadmap Q3 2026)
- ❌ NÃO implementa seção Arquivos/Documentos (backlog)
- ❌ NÃO modifica BottomNavRedesign
- ❌ NÃO altera `useComplexityMode.js`

---

## Decisões Arquiteturais

### 1. Onde guardar dados de perfil

| Campo | Storage | Justificativa |
|-------|---------|---------------|
| `display_name` | `user_settings` (nova coluna TEXT) | Nome de exibição editável pelo usuário. Separado de `auth.user_metadata.name` para não depender de Auth Admin API |
| `birth_date` | `user_settings` (nova coluna DATE) | Calculamos idade no frontend. DATE permite queries futuras (ex: faixa etária) |
| `city` | `user_settings` (nova coluna TEXT) | Texto livre, sem validação de CEP/município |
| `state` | `user_settings` (nova coluna TEXT) | Sigla UF (2 chars) ou texto livre |
| `emergency_card` | `user_settings` (nova coluna JSONB) | **Coluna nunca foi criada!** O `emergencyCardService` já tem código completo para ler/escrever, mas falha silenciosamente (linha 152-158: detecta coluna ausente e retorna warning). Dados vivem APENAS em localStorage desde sempre. |
| `blood_type` | Dentro de `emergency_card` JSONB | Parte do schema do cartão de emergência |
| `allergies` | Dentro de `emergency_card` JSONB | Array de strings, parte do schema |
| `emergency_contacts` | Dentro de `emergency_card` JSONB | Array de objetos {name, phone, relationship} |

**Descoberta crítica (2026-03-27):** A coluna `user_settings.emergency_card` (JSONB) foi especificada e o `emergencyCardService.js` foi implementado com write-through pattern completo, mas a coluna **nunca foi criada no banco de produção**. O service detecta a ausência (erro de coluna) e falha silenciosamente, mantendo dados apenas em localStorage. Isso significa:
- Dados do cartão de emergência **não sincronizam** entre dispositivos
- Se o usuário limpar o cache do browser, perde os dados
- O bot Telegram não tem acesso aos dados de emergência

**Resolução:** A migration desta wave cria a coluna. O `emergencyCardService` passa a funcionar como projetado — **zero mudança de código no service**.

**Por que novas colunas (display_name, birth_date, etc.) ao invés de JSONB?** Dados pessoais são campos tipados, indexáveis e consultáveis diretamente em SQL. JSONB é melhor para dados complexos/aninhados como o emergency_card (que tem arrays de objetos).

**Por que não usar `auth.user_metadata`?** Atualizar user_metadata requer `supabase.auth.updateUser()` que tem limitações (rate limits, não queryável server-side). Colunas em `user_settings` são controladas pela app e protegidas por RLS.

### 2. Migração de dados existentes

**Duas migrações acontecem no primeiro load do ProfileRedesign (10B):**

**A) display_name (one-time):**
Se `user_settings.display_name` estiver `NULL`:
1. Tentar copiar de `auth.user_metadata.name` (se existir)
2. Se não, campo fica vazio — usuário preenche via "Editar Perfil"

**B) emergency_card localStorage → Supabase (one-time sync):**
Após criar a coluna JSONB, dados existentes vivem em localStorage mas não em Supabase. No load do Profile Hub:
1. Carregar via `emergencyCardService.load()` (localStorage first, como sempre)
2. Se dados vieram do localStorage (`source === 'local'`) E o `user_settings.emergency_card` no Supabase é `NULL`:
   - Re-salvar via `emergencyCardService.save()` — agora o write-through funciona e grava no Supabase
3. A partir desse ponto, dados ficam sincronizados entre localStorage e Supabase

**Nota:** Essa sync é idempotente — se já existem dados no Supabase, não sobrescreve. O `emergencyCardService.load()` já prioriza localStorage, e o `save()` faz upsert.

Para `blood_type`: vive dentro do `emergency_card` JSONB — o Profile Hub lê de lá para exibir no header. Não duplica em coluna separada.

### 3. Layout Hub vs. Sidebar

| Wave 9 (atual) | Wave 10B (novo) |
|----------------|-----------------|
| Sidebar esquerda (3 seções) + content direita | Hub single-page centralizado |
| Seções: Health, Reports, Settings | Blocos empilhados: Header → Emergency Card + Consulta → Ferramentas |
| Desktop: 240px sidebar + 1fr | Desktop: max-width ~900px, cards lado a lado onde faz sentido |
| Data-active CSS visibility | Todos os blocos visíveis simultaneamente |

### 4. Cartão de Emergência no Hub

O hub mostra um **resumo visual** do Cartão de Emergência (não o componente EmergencyCardView completo). O card:
- Exibe: tipo sanguíneo, alergias (tags), contato principal, QR code miniatura
- Click "Ver Cartão Completo" → `onNavigate('emergency')` (view existente)
- Se cartão não configurado: CTA "Configurar Cartão de Emergência"

### 5. Editar Perfil

Modal (mobile) ou seção expandível (desktop) com formulário de campos pessoais:
- Display name, data de nascimento, cidade, estado
- **NÃO inclui** campos de saúde (blood_type, allergies) — esses continuam editáveis via Emergency view
- Salva diretamente em `user_settings` via upsert

---

## Sprints

### S10B.1 — Migration SQL + Schema Zod

#### Migration SQL

**Arquivo:** `docs/migrations/010_add_profile_columns.sql`

```sql
-- Migration: Adicionar colunas de perfil + emergency_card em user_settings
-- Wave 10B — Profile Hub
-- Data: 2026-03-XX
--
-- NOTA IMPORTANTE: A coluna emergency_card foi especificada desde a criação
-- do emergencyCardService (v3.x) mas NUNCA foi criada no banco.
-- O service já tem código completo para ler/escrever nela (write-through
-- pattern com localStorage como primário). Uma vez criada, o service
-- passa a funcionar como projetado — ZERO mudança de código necessária.

-- 1. Coluna JSONB para cartão de emergência (corrige dívida técnica)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS emergency_card JSONB;

-- 2. Novas colunas para dados de perfil do usuário
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- Comentários para documentação
COMMENT ON COLUMN user_settings.emergency_card IS 'Cartão de emergência (JSONB): emergency_contacts[], allergies[], blood_type, notes, last_updated. Lido/escrito por emergencyCardService.js via write-through com localStorage.';
COMMENT ON COLUMN user_settings.display_name IS 'Nome de exibição do usuário (editável no Profile Hub)';
COMMENT ON COLUMN user_settings.birth_date IS 'Data de nascimento para cálculo de idade';
COMMENT ON COLUMN user_settings.city IS 'Cidade do usuário';
COMMENT ON COLUMN user_settings.state IS 'Estado/UF do usuário';
```

**Execução:** Manual no Supabase Dashboard (SQL Editor) antes do deploy da wave.

**Impacto da criação de `emergency_card`:**
- `emergencyCardService.save()` → write-through passa a gravar no Supabase (antes falhava silenciosamente)
- `emergencyCardService.load()` → fallback Supabase passa a retornar dados (antes sempre null)
- `EmergencyCardView`, `EmergencyCardForm`, `Emergency.jsx` → **zero mudanças** (usam o service)
- Dados existentes em localStorage são sincronizados para Supabase no próximo `save()` do usuário ou via sync one-time no Profile Hub load

#### Schema Zod

**Arquivo:** `src/schemas/userProfileSchema.js`

```javascript
import { z } from 'zod'

// Estados brasileiros (UF)
export const BRAZILIAN_STATES = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
]

const userProfileSchema = z.object({
  display_name: z.string()
    .min(2, 'Nome deve ter ao menos 2 caracteres')
    .max(200, 'Nome não pode ter mais de 200 caracteres')
    .trim(),

  birth_date: z.string()
    .date('Data de nascimento inválida')
    .nullable()
    .optional(),

  city: z.string()
    .max(100, 'Cidade não pode ter mais de 100 caracteres')
    .trim()
    .nullable()
    .optional(),

  state: z.string()
    .max(50, 'Estado não pode ter mais de 50 caracteres')
    .trim()
    .nullable()
    .optional(),
})

export function validateUserProfile(data) {
  const result = userProfileSchema.safeParse(data)
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(i => ({ field: i.path[0], message: i.message }))
    }
  }
  return { success: true, data: result.data }
}

export default userProfileSchema
```

---

### S10B.2 — ProfileRedesign.jsx Rewrite (Hub Layout)

**Arquivo:** `src/views/redesign/ProfileRedesign.jsx` (rewrite completo)
**Estimativa:** ~280-320 linhas JSX

#### Props

```jsx
/**
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback de navegação
 */
export default function ProfileRedesign({ onNavigate })
```

#### State

```jsx
// User & data
const [user, setUser] = useState(null)
const [settings, setSettings] = useState(null)
const [emergencyCard, setEmergencyCard] = useState(null)
const [isLoading, setIsLoading] = useState(true)
const [error, setError] = useState(null)

// Edit profile
const [isEditingProfile, setIsEditingProfile] = useState(false)
const [profileForm, setProfileForm] = useState({
  display_name: '',
  birth_date: '',
  city: '',
  state: '',
})
const [isSaving, setIsSaving] = useState(false)
const [message, setMessage] = useState(null)

// Modais (mantidos da Wave 9)
const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
const [isReportModalOpen, setIsReportModalOpen] = useState(false)
```

#### Handlers

```javascript
// --- Data Loading ---

async loadProfile() {
  // 1. Fetch auth user
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Fetch user_settings (inclui novas colunas de perfil)
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // 3. Migrate display_name if null (one-time)
  if (settings && !settings.display_name && user.user_metadata?.name) {
    await supabase
      .from('user_settings')
      .update({ display_name: user.user_metadata.name, updated_at: new Date() })
      .eq('user_id', user.id)
    settings.display_name = user.user_metadata.name
  }

  // 4. Load emergency card data
  const cardResult = await emergencyCardService.load()
  const cardData = cardResult.success ? cardResult.data : null

  // 5. One-time sync: localStorage → Supabase (corrige dívida técnica)
  // Se dados existem em localStorage mas não em Supabase (coluna recém-criada),
  // re-salva para ativar o write-through que antes falhava silenciosamente.
  if (cardData && cardResult.source === 'local' && settings && !settings.emergency_card) {
    emergencyCardService.save(cardData) // async, non-blocking — não precisa de await
  }

  setUser(user)
  setSettings(settings)
  setEmergencyCard(cardData)

  // 6. Initialize form with current data
  setProfileForm({
    display_name: settings?.display_name || user.user_metadata?.name || '',
    birth_date: settings?.birth_date || '',
    city: settings?.city || '',
    state: settings?.state || '',
  })
}

// --- Profile Edit ---

async handleSaveProfile(e) {
  e.preventDefault()
  const validation = validateUserProfile(profileForm)
  if (!validation.success) { setError(validation.errors[0].message); return }

  setIsSaving(true)
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      ...validation.data,
      updated_at: new Date()
    }, { onConflict: 'user_id' })

  if (error) { setError('Erro ao salvar perfil.'); return }

  setSettings(prev => ({ ...prev, ...validation.data }))
  setIsEditingProfile(false)
  showFeedback('Perfil atualizado!')
}
```

#### Layout — Desktop (≥ 768px)

```
╭ Sidebar ──╮ ╭──── Profile Hub (max-w: 900px) ─────────────────────────────────╮
│ Hoje      │ │                                                                  │
│ Tratam.   │ │  ╭─── Header do Perfil ────────────────────────────────────────╮ │
│ Estoque   │ │  │                                                             │ │
│ [Perfil]  │ │  │  ┌──┐   Maria Eduarda Santos                               │ │
│           │ │  │  │ME│   68 anos  •  ⊕ São Paulo, SP    [ Editar Perfil ]    │ │
│           │ │  │  └──┘   AB+ Positivo                                        │ │
│           │ │  │                                                             │ │
│           │ │  ╰─────────────────────────────────────────────────────────────╯ │
│           │ │                                                                  │
│           │ │  ╭─ Cartão Emergência ──────╮  ╭─ Modo Consulta ─────────────╮  │
│           │ │  │  IDENTIFICAÇÃO CRÍTICA   │  │                             │  │
│           │ │  │  Cartão de Emergência    │  │  👨‍⚕️ Modo Consulta Médica    │  │
│           │ │  │                          │  │                             │  │
│           │ │  │  ALERGIAS    CONDIÇÕES   │  │  Abre para editar apenas    │  │
│           │ │  │  Dipirona    HAS, DM2    │  │  informações clínicas       │  │
│           │ │  │  Látex                   │  │  relevantes e facilitar o   │  │
│           │ │  │           ┌────┐         │  │  trabalho do seu médico.    │  │
│           │ │  │  CONTATO  │ QR │         │  │                             │  │
│           │ │  │  Ricardo  │    │         │  │  [ Acessar Consulta → ]     │  │
│           │ │  │  (11)9887 └────┘         │  │                             │  │
│           │ │  │                          │  │                             │  │
│           │ │  │  [ Ver Cartão Completo ] │  ╰─────────────────────────────╯  │
│           │ │  ╰──────────────────────────╯                                    │
│           │ │                                                                  │
│           │ │  ╭─ Ferramentas de Gestão ──────────────────────────────────────╮│
│           │ │  │                                                              ││
│           │ │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                     ││
│           │ │  │  │ 📄       │ │ 📊       │ │ 📤       │                     ││
│           │ │  │  │Relatório │ │Histórico │ │ Exportar │                     ││
│           │ │  │  │  PDF     │ │ de Doses │ │  Dados   │                     ││
│           │ │  │  └──────────┘ └──────────┘ └──────────┘                     ││
│           │ │  ╰──────────────────────────────────────────────────────────────╯│
│           │ │                                                                  │
│ ┌───────┐ │ ╰──────────────────────────────────────────────────────────────────╯
│ │NovaDos│ │
│ └───────┘ │
╰───────────╯
```

#### Layout — Mobile (< 768px)

```
╭─────────────────────────────────╮
│  ←    Perfil              ⚙️    │  ← Header com back + gear icon
╰─────────────────────────────────╯

  ╭─ Avatar + Info ─────────────╮
  │                             │
  │      ┌──┐                   │
  │      │MO│  ← edit icon      │
  │      └──┘                   │
  │   Maria Oliveira            │
  │   68 anos   Tipo O+         │
  │                             │
  ╰─────────────────────────────╯

  ╭─ Cartão Emergência ─────────╮
  │  🆘 Cartão de Emergência    │
  │  Informações vitais         │
  │  acessíveis para            │
  │  socorristas e médicos. [QR]│
  │                         →   │
  ╰─────────────────────────────╯

  ╭─ Modo Consulta ─────────────╮
  │  👨‍⚕️ Modo Consulta            │
  │  Libera histórica para      │
  │  o médico.              →   │
  ╰─────────────────────────────╯

  Ferramentas de Gestão
  ╭─────────────────────────────╮
  │  📄  Relatório PDF      →  │
  │  📊  Histórico de Doses →  │
  │  📤  Exportar Dados     →  │
  ╰─────────────────────────────╯

  ╭ Bottom Nav ─────────────────╮
  │ Hoje │ Tratam│ Estoque│Perfil│
  ╰─────────────────────────────╯
```

#### Componentes do Hub

**1. Header do Perfil** (inline ou sub-componente)

```jsx
<div className="ph-header">
  <div className="ph-header__avatar">{initials}</div>
  <div className="ph-header__info">
    <h1 className="ph-header__name">{displayName}</h1>
    <div className="ph-header__meta">
      {age && <span className="ph-header__age">{age} anos</span>}
      {bloodType && bloodType !== 'desconhecido' && (
        <span className="ph-header__blood-type">{bloodType}</span>
      )}
      {location && <span className="ph-header__location">📍 {location}</span>}
    </div>
  </div>
  <button className="ph-header__edit-btn" onClick={() => setIsEditingProfile(true)}>
    Editar Perfil
  </button>
</div>
```

**Dados derivados:**
```javascript
// Nome de exibição: settings.display_name → user_metadata.name → email → 'Paciente'
const displayName = settings?.display_name
  || user?.user_metadata?.name
  || user?.email
  || 'Paciente'

// Iniciais: primeiras 2 letras de palavras do nome
const initials = displayName
  .split(' ').filter(Boolean).slice(0, 2)
  .map(w => w[0].toUpperCase()).join('')

// Idade: calculada a partir de birth_date
const age = useMemo(() => {
  if (!settings?.birth_date) return null
  const birth = parseLocalDate(settings.birth_date)
  const today = new Date()
  let years = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years--
  return years
}, [settings?.birth_date])

// Tipo sanguíneo: lido do emergency_card
const bloodType = emergencyCard?.blood_type

// Localização: city + state
const location = useMemo(() => {
  const parts = [settings?.city, settings?.state].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}, [settings?.city, settings?.state])
```

**2. Card de Emergência (resumo)**

```jsx
<div className="ph-emergency-card">
  <div className="ph-emergency-card__header">
    <span className="ph-emergency-card__label">IDENTIFICAÇÃO CRÍTICA</span>
    <h3>Cartão de Emergência</h3>
  </div>

  {emergencyCard ? (
    <>
      <div className="ph-emergency-card__body">
        <div className="ph-emergency-card__data">
          {/* Alergias como tags */}
          {emergencyCard.allergies?.length > 0 && (
            <div className="ph-emergency-card__field">
              <span className="ph-emergency-card__field-label">ALERGIAS</span>
              <div className="ph-emergency-card__tags">
                {emergencyCard.allergies.map((a, i) => (
                  <span key={i} className="ph-emergency-card__tag ph-emergency-card__tag--danger">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Contato principal */}
          {emergencyCard.emergency_contacts?.[0] && (
            <div className="ph-emergency-card__field">
              <span className="ph-emergency-card__field-label">CONTATO DE EMERGÊNCIA</span>
              <span className="ph-emergency-card__contact-name">
                {emergencyCard.emergency_contacts[0].name}
                — {emergencyCard.emergency_contacts[0].relationship}
              </span>
              <a href={`tel:${emergencyCard.emergency_contacts[0].phone}`}
                 className="ph-emergency-card__contact-phone">
                📞 {emergencyCard.emergency_contacts[0].phone}
              </a>
            </div>
          )}
        </div>

        {/* QR miniatura */}
        <div className="ph-emergency-card__qr">
          <EmergencyQRCode cardData={emergencyCard} medications={activeMedications} miniature />
        </div>
      </div>

      <button className="ph-emergency-card__action"
              onClick={() => onNavigate('emergency')}>
        Ver Cartão Completo →
      </button>
    </>
  ) : (
    <div className="ph-emergency-card__empty">
      <p>Você ainda não configurou seu cartão de emergência.</p>
      <button className="ph-emergency-card__cta"
              onClick={() => onNavigate('emergency')}>
        Configurar Agora
      </button>
    </div>
  )}
</div>
```

**Nota sobre EmergencyQRCode:** O componente existente precisa aceitar uma prop `miniature` para renderizar em tamanho reduzido (~80px). Se isso adicionar complexidade desnecessária, podemos simplesmente renderizar um placeholder visual de QR (um ícone de QR) que linka para a view completa.

**3. Card Modo Consulta**

```jsx
<div className="ph-consultation-card" onClick={() => onNavigate('consultation')}>
  <div className="ph-consultation-card__icon">👨‍⚕️</div>
  <div className="ph-consultation-card__content">
    <h3>Modo Consulta Médica</h3>
    <p>Abre um resumo clínico otimizado para compartilhar com seu médico durante a consulta.</p>
  </div>
  <span className="ph-consultation-card__chevron">→</span>
</div>
```

**4. Grid Ferramentas de Gestão**

```jsx
<section className="ph-tools">
  <h2 className="ph-tools__title">Ferramentas de Gestão</h2>
  <div className="ph-tools__grid">
    <ToolCard icon="📄" label="Relatório PDF"
              description="Gerar relatório completo dos últimos 30 dias"
              onClick={() => setIsReportModalOpen(true)} />
    <ToolCard icon="📊" label="Histórico de Doses"
              description="Calendário, adesão e heatmap"
              onClick={() => onNavigate('health-history')} />
    <ToolCard icon="📤" label="Exportar Dados"
              description="Formato CSV ou JSON para outros sistemas"
              onClick={() => setIsExportDialogOpen(true)} />
  </div>
</section>
```

**ToolCard** — componente interno inline (não precisa de arquivo separado):

```jsx
function ToolCard({ icon, label, description, onClick }) {
  return (
    <button className="ph-tool-card" onClick={onClick} type="button">
      <span className="ph-tool-card__icon">{icon}</span>
      <span className="ph-tool-card__label">{label}</span>
      {description && <span className="ph-tool-card__desc">{description}</span>}
    </button>
  )
}
```

**Layout do grid:**
- Desktop: 3 colunas (`grid-template-columns: repeat(3, 1fr)`)
- Mobile: lista vertical (1 coluna, cada card como row com icon + label + chevron)

**5. Formulário Editar Perfil**

Modal simples (reutilizar componente `Modal` existente):

```jsx
<Modal isOpen={isEditingProfile} onClose={() => setIsEditingProfile(false)}>
  <form className="ph-edit-form" onSubmit={handleSaveProfile}>
    <h2>Editar Perfil</h2>

    <label className="ph-edit-form__field">
      <span>Nome</span>
      <input type="text" value={profileForm.display_name}
             onChange={e => setProfileForm(f => ({...f, display_name: e.target.value}))}
             placeholder="Seu nome" required />
    </label>

    <label className="ph-edit-form__field">
      <span>Data de Nascimento</span>
      <input type="date" value={profileForm.birth_date}
             onChange={e => setProfileForm(f => ({...f, birth_date: e.target.value}))} />
    </label>

    <div className="ph-edit-form__row">
      <label className="ph-edit-form__field">
        <span>Cidade</span>
        <input type="text" value={profileForm.city}
               onChange={e => setProfileForm(f => ({...f, city: e.target.value}))}
               placeholder="Ex: São Paulo" />
      </label>

      <label className="ph-edit-form__field">
        <span>Estado</span>
        <select value={profileForm.state}
                onChange={e => setProfileForm(f => ({...f, state: e.target.value}))}>
          <option value="">Selecionar</option>
          {BRAZILIAN_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </label>
    </div>

    <div className="ph-edit-form__actions">
      <Button variant="ghost" onClick={() => setIsEditingProfile(false)}>Cancelar</Button>
      <Button type="submit" disabled={isSaving}>
        {isSaving ? 'Salvando...' : 'Salvar'}
      </Button>
    </div>
  </form>
</Modal>
```

**Regras do formulário:**
- Nome é obrigatório (min 2 chars)
- Birth date, city, state são opcionais
- Estado: select com UFs brasileiras (27 opções)
- Validação via `validateUserProfile()` antes de salvar
- Upsert em `user_settings` (onConflict: 'user_id')
- Após salvar: atualizar state local, fechar modal, mostrar feedback

---

### S10B.3 — ProfileRedesign.css Rewrite

**Arquivo:** `src/views/redesign/profile/ProfileRedesign.css` (rewrite completo)
**Estimativa:** ~400 linhas

#### Tokens obrigatórios

```css
/* Mesmos tokens do design system existente */
--color-primary              /* #006a5e */
--color-primary-container    /* Verde claro */
--color-primary-bg           /* Background primário sutil */
--color-surface-container-lowest  /* Cards */
--color-surface-container-low     /* Hover */
--color-on-surface           /* Texto */
--color-on-primary           /* Texto sobre primary */
--color-outline-ghost        /* Borders sutis */
--color-error                /* Vermelho danger */
--color-error-bg             /* Background vermelho */
--font-display               /* Títulos */
--font-body                  /* Corpo */
--shadow-ambient             /* Sombra sutil */
```

#### Estrutura de classes

```css
/* ── Container ────────────────────────────── */
.ph-view { max-width: 900px; margin: 0 auto; padding: 1rem; }

/* ── Header do Perfil ─────────────────────── */
.ph-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--color-surface-container-lowest);
  border-radius: 1.5rem;
  box-shadow: var(--shadow-ambient);
}
.ph-header__avatar {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-container));
  color: var(--color-on-primary);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display);
  font-size: 1.25rem; font-weight: 700;
  flex-shrink: 0;
}
.ph-header__name {
  font-family: var(--font-display);
  font-size: 1.5rem; font-weight: 700;
  margin: 0;
}
.ph-header__meta {
  display: flex; gap: 0.75rem; align-items: center;
  font-size: 0.85rem; opacity: 0.6;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}
.ph-header__blood-type {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  padding: 2px 8px;
  border-radius: 99px;
  font-weight: 600;
  font-size: 0.75rem;
}
.ph-header__edit-btn {
  margin-left: auto;
  padding: 0.5rem 1rem;
  border: 1.5px solid var(--color-outline-ghost);
  border-radius: 0.75rem;
  background: transparent;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

/* ── Mobile header (com gear icon, mantido de 10A) ─── */
.ph-mobile-header {
  display: flex; align-items: center; gap: 0.75rem; padding: 1rem 0;
}

/* ── Cards principais (Emergency + Consulta) ────── */
.ph-cards-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1.5rem;
}

/* Emergency Card resumo */
.ph-emergency-card {
  background: var(--color-surface-container-lowest);
  border-radius: 1.5rem;
  box-shadow: var(--shadow-ambient);
  overflow: hidden;
}
.ph-emergency-card__header {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-container));
  color: var(--color-on-primary);
  padding: 1rem 1.25rem;
}
.ph-emergency-card__label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.8;
}
.ph-emergency-card__body {
  display: flex; gap: 1rem; padding: 1rem 1.25rem;
}
.ph-emergency-card__tag {
  display: inline-block;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 99px;
  margin: 2px;
}
.ph-emergency-card__tag--danger {
  background: var(--color-error-bg);
  color: var(--color-error);
}
.ph-emergency-card__action {
  display: block; width: 100%; padding: 0.75rem;
  border: none; border-top: 1px solid var(--color-outline-ghost);
  background: transparent;
  color: var(--color-primary);
  font-weight: 500; cursor: pointer;
  text-align: center;
}

/* Consultation Card */
.ph-consultation-card {
  background: var(--color-surface-container-lowest);
  border-radius: 1.5rem;
  box-shadow: var(--shadow-ambient);
  padding: 1.25rem;
  cursor: pointer;
  display: flex; flex-direction: column; gap: 0.75rem;
}

/* ── Ferramentas Grid ─────────────────────── */
.ph-tools { margin-top: 2rem; }
.ph-tools__title {
  font-family: var(--font-display);
  font-size: 1rem; font-weight: 600;
  margin-bottom: 1rem;
}
.ph-tools__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.ph-tool-card {
  background: var(--color-surface-container-lowest);
  border-radius: 1.25rem;
  box-shadow: var(--shadow-ambient);
  padding: 1.25rem;
  border: none; cursor: pointer;
  text-align: center;
  display: flex; flex-direction: column;
  align-items: center; gap: 0.5rem;
}
.ph-tool-card__icon { font-size: 1.5rem; }
.ph-tool-card__label { font-weight: 600; font-size: 0.875rem; }
.ph-tool-card__desc { font-size: 0.75rem; opacity: 0.5; }

/* ── Edit Profile Modal ───────────────────── */
.ph-edit-form { padding: 1rem; }
.ph-edit-form__field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem; }
.ph-edit-form__field span { font-size: 0.8rem; font-weight: 500; opacity: 0.7; }
.ph-edit-form__field input,
.ph-edit-form__field select {
  padding: 0.625rem 0.75rem;
  border: 1.5px solid var(--color-outline-ghost);
  border-radius: 0.75rem;
  font-size: 1rem;
}
.ph-edit-form__field input:focus,
.ph-edit-form__field select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0,106,94,0.12);
  outline: none;
}
.ph-edit-form__row { display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem; }
.ph-edit-form__actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }

/* ── Responsive ───────────────────────────── */
@media (max-width: 767px) {
  .ph-header { flex-direction: column; text-align: center; }
  .ph-header__avatar { width: 56px; height: 56px; font-size: 1.1rem; }
  .ph-header__edit-btn { margin-left: 0; width: 100%; }
  .ph-header__meta { justify-content: center; }

  .ph-cards-row { grid-template-columns: 1fr; }

  .ph-tools__grid { grid-template-columns: 1fr; }
  .ph-tool-card {
    flex-direction: row; text-align: left;
    padding: 1rem; gap: 0.75rem;
  }
  .ph-tool-card__icon { font-size: 1.25rem; }

  .ph-edit-form__row { grid-template-columns: 1fr; }
}
```

---

### S10B.4 — App.jsx Adjustments (se necessário)

**Provável:** Nenhuma mudança necessária em App.jsx — a rota `profile` já renderiza ProfileRedesign quando `isRedesignEnabled`, e a 10A já terá adicionado a rota `settings`. O rewrite do ProfileRedesign não muda a interface pública (mesmo `onNavigate` prop).

**Possível:** Se o componente EmergencyQRCode precisar de prop `miniature`, verificar se pode ser adicionada sem breaking change. Se não, usar alternativa (ícone de QR estático).

---

## Ordem de Execução dos Sprints

| Sprint | Descrição | Deps |
|--------|-----------|------|
| S10B.1 | Migration SQL + userProfileSchema.js | — (SQL executado manualmente antes) |
| S10B.2 | ProfileRedesign.jsx rewrite (hub layout + handlers) | S10B.1 (schema) |
| S10B.3 | ProfileRedesign.css rewrite | S10B.2 |
| S10B.4 | Ajustes App.jsx + testes + refinements | S10B.2-3 |

**S10B.1 e S10B.2 podem ser commitados juntos** (schema + componente que o usa).

---

## Pré-requisitos de Deploy

1. **Executar migration SQL** no Supabase Dashboard antes de deployar o código
2. A migration é **aditiva** (ADD COLUMN IF NOT EXISTS) — zero risco de quebra
3. Colunas novas são nullable — sem impacto em dados existentes
4. RLS policies existentes de `user_settings` já cobrem as novas colunas (row-level, não column-level)

---

## Checklist de Validação

### Dados & Persistência
- [ ] Migration SQL executada sem erros
- [ ] `user_settings` tem colunas: emergency_card (JSONB), display_name, birth_date, city, state
- [ ] Coluna `emergency_card` JSONB funciona — `emergencyCardService.save()` grava no Supabase (não mais warning)
- [ ] Sync one-time: dados de localStorage migrados para Supabase no load do Profile Hub
- [ ] Formulário "Editar Perfil" salva em `user_settings` via upsert
- [ ] Migração one-time: display_name populado a partir de user_metadata.name
- [ ] `validateUserProfile()` rejeita nome < 2 chars
- [ ] Campos opcionais (birth_date, city, state) aceitam null/vazio

### Profile Hub
- [ ] Header mostra: iniciais, nome, idade (calculada), tipo sanguíneo, localização
- [ ] Idade calculada corretamente a partir de birth_date
- [ ] Tipo sanguíneo lido de emergency_card (sem duplicação)
- [ ] Botão "Editar Perfil" abre modal com formulário
- [ ] Após salvar, header atualiza imediatamente (sem reload)

### Cartão de Emergência (resumo + sync)
- [ ] Card mostra: alergias (tags), contato principal (nome + tel), QR miniatura
- [ ] Click "Ver Cartão Completo" navega para emergency view
- [ ] Se cartão não configurado: CTA "Configurar Agora"
- [ ] Dados lidos via emergencyCardService.load() (offline-first mantido)
- [ ] Após sync: salvar/editar cartão na Emergency view persiste no Supabase (verificar no dashboard)

### Modo Consulta
- [ ] Card descritivo com texto explicativo
- [ ] Click navega para consultation view

### Ferramentas de Gestão
- [ ] 3 cards: Relatório PDF, Histórico de Doses, Exportar Dados
- [ ] Relatório PDF abre modal (ReportGenerator)
- [ ] Histórico de Doses navega para health-history
- [ ] Exportar Dados abre modal (ExportDialog)
- [ ] Desktop: grid 3 colunas | Mobile: lista vertical

### Ícone ⚙️ (herança de 10A)
- [ ] Gear icon visível no header (mobile e desktop)
- [ ] Click navega para settings

### Layout Responsivo
- [ ] Desktop: cards Emergency + Consulta lado a lado
- [ ] Mobile: cards empilhados, avatar centralizado
- [ ] Breakpoint 768px funciona corretamente

### Não-regressão
- [ ] Profile.jsx original inalterado
- [ ] Emergency.jsx original inalterado
- [ ] emergencyCardService inalterado (write-through mantido)
- [ ] ESLint: 0 errors
- [ ] Testes existentes passam

---

## Mapeamento de Arquivos

| Arquivo | Ação | Sprint |
|---------|------|--------|
| `docs/migrations/010_add_profile_columns.sql` | CRIAR | S10B.1 |
| `src/schemas/userProfileSchema.js` | CRIAR | S10B.1 |
| `src/views/redesign/ProfileRedesign.jsx` | REWRITE | S10B.2 |
| `src/views/redesign/profile/ProfileRedesign.css` | REWRITE | S10B.3 |

**Arquivos NÃO tocados:**
- `src/views/Profile.jsx`
- `src/views/Emergency.jsx`
- `src/features/emergency/services/emergencyCardService.js`
- `src/features/emergency/components/EmergencyCardView.jsx`
- `src/features/emergency/components/EmergencyCardForm.jsx`
- `src/schemas/emergencyCardSchema.js`
- `src/features/dashboard/hooks/useComplexityMode.js`
- `src/App.jsx` (sem mudanças esperadas)
- `src/shared/components/ui/BottomNavRedesign.jsx`
