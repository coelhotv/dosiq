# Wave 10A — Settings Extraction: View Independente de Configurações

**Status:** ⏳ PENDENTE EXECUÇÃO
**Data de criação da spec:** 2026-03-27
**Dependências:** W0-W9 ✅ (todos mergeados em main)
**Risco:** BAIXO — extração de código existente, zero lógica nova, zero mudança de banco
**Branch:** `feature/redesign/wave-10a-settings`
**Master doc:** `WAVE_10_PERFIL_HISTORICO_SETTINGS.md`

---

## Por que esta sub-wave existe

As configurações atualmente vivem como uma seção interna do ProfileRedesign ("Configurações"), acessada via sidebar/seção de navegação. Isso causa dois problemas:

1. **O Perfil fica sobrecarregado** — mistura "quem sou eu" (identidade) com "como quero que funcione" (preferências), criando uma view com responsabilidades demais.
2. **Bloqueia a Wave 10B** — para transformar o Perfil em hub centralizado, Settings precisa sair de lá primeiro.

A extração é cirúrgica: toda a lógica de Telegram, Densidade, Senha e Admin DLQ já existe no ProfileRedesign.jsx. Esta wave move essa lógica para uma view própria com layout melhorado.

---

## O que esta wave FAZ

- Cria `src/views/redesign/SettingsRedesign.jsx` — view independente de Configurações
- Cria `src/views/redesign/settings/SettingsRedesign.css` — estilos dedicados
- Modifica `src/views/redesign/ProfileRedesign.jsx` — remove seção Settings, adiciona ícone ⚙️ no header
- Modifica `src/App.jsx` — adiciona rota `settings` com lazy import + branching redesign

## O que esta wave NÃO FAZ

- ❌ NÃO toca em `Profile.jsx` (view original) — Settings separado existe APENAS no redesign
- ❌ NÃO modifica `useComplexityMode.js` — usa o hook existente diretamente
- ❌ NÃO altera banco de dados, schemas, ou services
- ❌ NÃO implementa Modo Escuro ou Biometria
- ❌ NÃO modifica BottomNavRedesign (Settings não é item do menu inferior)
- ❌ NÃO cria novo hook ou service

---

## Sprints

### S10A.1 — SettingsRedesign.jsx + CSS

**Arquivo:** `src/views/redesign/SettingsRedesign.jsx`
**Estimativa:** ~180 linhas JSX

#### Props

```jsx
/**
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback de navegação (para 'profile', 'admin-dlq')
 */
export default function SettingsRedesign({ onNavigate })
```

#### State (extraído do ProfileRedesign atual)

```jsx
const [user, setUser] = useState(null)
const [settings, setSettings] = useState(null)
const [isLoading, setIsLoading] = useState(true)
const [telegramToken, setTelegramToken] = useState(null)
const [newPassword, setNewPassword] = useState('')
const [showPasswordForm, setShowPasswordForm] = useState(false)
const [message, setMessage] = useState(null)
const [error, setError] = useState(null)
const [complexityOverride, setComplexityOverride] = useState(
  () => localStorage.getItem('mr_complexity_override') || 'auto'
)
```

#### Handlers (idênticos ao ProfileRedesign — mover, não copiar)

- `loadProfile()` — fetch user + user_settings do Supabase
- `generateTelegramToken()` — cria token UUID, upsert em user_settings
- `handleDisconnectTelegram()` — confirm dialog, null telegram_chat_id
- `handleComplexityChange(value)` — persiste override em localStorage
- `handleUpdatePassword(e)` — valida 6+ chars, updatePassword via Supabase Auth
- `handleLogout()` — signOut via Supabase Auth
- `showFeedback(msg)` — toast temporário (3s)

#### Layout (4 seções)

```
╭─────────────────────────────────────────────────╮
│  ← Voltar         Configurações            (?)  │  ← Header com back button
╰─────────────────────────────────────────────────╯

  ╭ INTEGRAÇÕES ────────────────────────────────╮
  │                                             │
  │  ▶  Telegram                                │
  │     Receba lembretes de medicação e alertas  │
  │     diretamente no seu chat.                 │
  │                                             │
  │     [Conectar]  ou  [Desconectar]           │
  │     (estado atual: badge Conectado/Desc.)   │
  │                                             │
  ╰─────────────────────────────────────────────╯

  ╭ PREFERÊNCIAS ───────────────────────────────╮
  │                                             │
  │  ≡  Densidade da Interface                  │
  │                                             │
  │  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
  │  │ Simples │  │Automático│  │ Complexo  │  │
  │  │ Textos  │  │ Baseado  │  │ Gráficos  │  │
  │  │ maiores │  │ nos seus │  │detalhados │  │
  │  │ e foco  │  │tratament.│  │ e visões  │  │
  │  │   no    │  │  ativos  │  │ técnicas  │  │
  │  │essencial│  │ (X prot.)│  │           │  │
  │  └─────────┘  └──────────┘  └───────────┘  │
  │                                             │
  │  Modo atual: Automático (Simples — 2 prot.) │
  │                                             │
  ╰─────────────────────────────────────────────╯

  ╭ SEGURANÇA ──────────────────────────────────╮
  │                                             │
  │  🔒  Alterar Senha                          │
  │      Última alteração: --                   │
  │                               [Alterar →]   │
  │                                             │
  │      ┌ form expandível ──────────────────┐  │
  │      │ [ Nova senha (mín. 6 caracteres)] │  │
  │      │                       [Salvar]    │  │
  │      └───────────────────────────────────┘  │
  │                                             │
  ╰─────────────────────────────────────────────╯

  ╭ ÁREA ADMINISTRATIVA ────────────────────────╮  ← Condicional: admin only
  │                                             │
  │  ⚠️  Dead Letter Queue (DLQ)  ACESSO        │
  │      Gerenciar falhas de      RESTRITO      │
  │      sincronização                          │
  │                          [Ver Alertas →]    │
  │                                             │
  ╰─────────────────────────────────────────────╯

  ┌─────────────────────────────────────────────┐
  │           🚪 Sair da Conta                  │  ← Botão proeminente
  └─────────────────────────────────────────────┘

           MEUS REMÉDIOS V3.3.0 • 2026            ← Footer com versão
```

#### Regras de Layout

**Mobile (< 768px):**
- Single column, full width
- Header fixo no topo com ← back + título "Configurações"
- Seções empilhadas com gap 1rem
- Botão "Sair da Conta" full-width, estilo outlined-danger
- Footer com versão: `MEUS REMÉDIOS V${version} • ${year}`

**Desktop (≥ 768px):**
- Centralizado, max-width 640px
- Mesmo layout (não precisa de duas colunas — Settings é conteúdo linear)
- Header com "← Voltar" → navega para profile
- Cards com border-radius 1.25rem, surface-container-lowest, shadow-ambient

#### Controle de Densidade — Detalhamento

O controle de densidade é o elemento mais complexo desta view. Regras:

1. **3 opções visuais** (segmented control ou cards):
   - `simple` — "Simples": "Textos maiores e foco no essencial"
   - `auto` — "Automático": "Ajusta baseado nos seus tratamentos ativos"
   - `complex` — "Complexo": "Gráficos detalhados e visões técnicas"

2. **Indicação do modo atual:**
   - Se override = `auto`: "Modo atual: Automático (Simples — 2 protocolos ativos)" ou "(Complexo — 8 protocolos ativos)"
   - Se override = `simple`: "Modo atual: Simples (manual)"
   - Se override = `complex`: "Modo atual: Complexo (manual)"

3. **Integração com useComplexityMode:**
   - Importar `useComplexityMode` do `@dashboard/hooks/useComplexityMode.js` (hook existente, NÃO modificar — NOTE: o hook usa `useDashboard` que requer estar dentro de `DashboardProvider`, o que já é o caso pois o provider wrapa toda a app)
   - Ler `mode`, `medicineCount`, `overrideMode`, `setOverride` do hook
   - Mapear UI: Simples = `setOverride('simple')`, Automático = `setOverride(null)`, Complexo = `setOverride('complex')`

4. **Opção selecionada:** Visual de "selected" no card/botão ativo (border primary + background primary-bg)

#### Telegram — Detalhamento

Sem toggle. Dois estados claros:

**Estado: Desconectado**
```
▶  Telegram
   Receba lembretes de medicação e alertas
   diretamente no seu chat.

   [Gerar Código de Vínculo]     ← botão primary outlined

   // Após gerar:
   Envie ao bot: /start ABC12345
   [Abrir no Telegram →]         ← link externo
```

**Estado: Conectado**
```
▶  Telegram                      Conectado ●
   Receba lembretes de medicação e alertas
   diretamente no seu chat.

   [Desconectar]                 ← botão danger outlined, com confirm dialog
```

#### Admin DLQ — Detalhamento

Renderização condicional (mesmo check atual):
```jsx
{(user?.user_metadata?.role === 'admin' ||
  settings?.telegram_chat_id === import.meta.env.VITE_ADMIN_CHAT_ID) && (
  <section>...</section>
)}
```

Badge "ACESSO RESTRITO" ao lado do título. Click em "Ver Alertas" → `onNavigate('admin-dlq')`.

---

### S10A.2 — ProfileRedesign.jsx: Remover Settings + Adicionar ⚙️

**Arquivo:** `src/views/redesign/ProfileRedesign.jsx`

**Mudanças:**

1. **Remover** toda a seção `sectionSettings` (linhas 146-215 atuais):
   - Remover JSX do Telegram, Densidade, Senha, Admin DLQ
   - Remover states: `telegramToken`, `newPassword`, `showPasswordForm`, `complexityOverride`
   - Remover handlers: `generateTelegramToken`, `handleDisconnectTelegram`, `handleComplexityChange`, `handleUpdatePassword`
   - Remover imports não mais necessários (se houver)

2. **Remover** o item "Configurações" do array `SECTIONS`:
   ```jsx
   // ANTES
   const SECTIONS = [
     { id: 'health',   label: 'Saúde & Histórico',  icon: '📊' },
     { id: 'reports',  label: 'Relatórios & Dados',  icon: '📄' },
     { id: 'settings', label: 'Configurações',        icon: '⚙️' },
   ]

   // DEPOIS
   const SECTIONS = [
     { id: 'health',   label: 'Saúde & Histórico',  icon: '📊' },
     { id: 'reports',  label: 'Relatórios & Dados',  icon: '📄' },
   ]
   ```

3. **Remover** o slot `data-section="settings"` do JSX

4. **Adicionar ícone ⚙️** no header (mobile) e no panel header (desktop):

   **Mobile header:**
   ```jsx
   <div className="pr-header pr-header--mobile-only">
     <div className="pr-header__avatar" aria-hidden="true">{initials}</div>
     <div className="pr-header__info">
       <h2 className="pr-header__name">{user?.user_metadata?.name || 'Paciente'}</h2>
       {user?.email && <span className="pr-header__email">{user.email}</span>}
     </div>
     <button
       className="pr-header__settings-btn"
       onClick={() => onNavigate('settings')}
       aria-label="Configurações"
       type="button"
     >
       <Settings size={22} />
     </button>
   </div>
   ```

   **Desktop panel header:**
   ```jsx
   <div className="pr-panel__header">
     <div className="pr-panel__avatar" aria-hidden="true">{initials}</div>
     <div className="pr-panel__info">
       <span className="pr-panel__name">{user?.user_metadata?.name || 'Paciente'}</span>
       {user?.email && <span className="pr-panel__email">{user.email}</span>}
     </div>
     <button
       className="pr-panel__settings-btn"
       onClick={() => onNavigate('settings')}
       aria-label="Configurações"
       type="button"
     >
       <Settings size={20} />
     </button>
   </div>
   ```

5. **Adicionar import** de `Settings` icon:
   ```jsx
   import { LogOut, Settings } from 'lucide-react'
   ```

6. **Manter** lógica de `loadProfile()`, `handleLogout()`, `user`, `settings`, `isLoading` (necessários para o Perfil)

7. **Manter** `isExportDialogOpen`, `isReportModalOpen` e seus modais (Reports continua no Perfil)

---

### S10A.3 — App.jsx: Rota Settings

**Arquivo:** `src/App.jsx`

**Mudanças:**

1. **Adicionar lazy import:**
   ```jsx
   const SettingsRedesign = lazy(() => import('./views/redesign/SettingsRedesign'))
   ```

2. **Adicionar case no renderView():**
   ```jsx
   case 'settings':
     return isRedesignEnabled ? (
       <Suspense fallback={<ViewSkeleton />}>
         <SettingsRedesign onNavigate={setCurrentView} />
       </Suspense>
     ) : (
       // Sem redesign, settings não existe como view separada — redirecionar para profile
       // Isso não deveria acontecer pois o link ⚙️ só existe no redesign
       (() => { setCurrentView('profile'); return null })()
     )
   ```

3. **Verificar** que o case está posicionado ANTES do default/fallback

---

### S10A.4 — CSS: SettingsRedesign.css

**Arquivo:** `src/views/redesign/settings/SettingsRedesign.css`
**Estimativa:** ~250 linhas

#### Tokens obrigatórios (do design system existente)

```css
/* Cores */
--color-primary             /* Verde saúde #006a5e */
--color-primary-bg           /* Verde claro para backgrounds selecionados */
--color-surface-container-lowest  /* Fundo dos cards */
--color-surface-container-low     /* Hover states */
--color-on-surface           /* Texto principal */
--color-outline-ghost        /* Borders sutis rgba(25,28,29,0.08) */
--color-error                /* Vermelho para disconnect/danger */
--color-error-bg             /* Background vermelho claro */

/* Tipografia */
--font-display               /* Títulos de seção */
--font-body                  /* Corpo */

/* Sombras */
--shadow-ambient             /* Elevação sutil dos cards */
```

#### Classes principais

```css
/* Container */
.sr-view { max-width: 640px; margin: 0 auto; padding: 1rem; }

/* Header */
.sr-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 0; }
.sr-header__back { /* botão ← */ }
.sr-header__title { font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; }

/* Seções */
.sr-section { margin-bottom: 1.5rem; }
.sr-section__title {
  font-family: var(--font-display);
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.sr-section__card {
  background: var(--color-surface-container-lowest);
  border-radius: 1.25rem;
  box-shadow: var(--shadow-ambient);
  padding: 1.25rem;
}

/* Telegram */
.sr-telegram { /* ... */ }
.sr-telegram__badge--connected { color: var(--color-primary); }
.sr-telegram__badge--disconnected { color: var(--color-on-surface); opacity: 0.5; }

/* Densidade — segmented control */
.sr-density__options { display: flex; gap: 0.5rem; }
.sr-density__option {
  flex: 1;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1.5px solid var(--color-outline-ghost);
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
}
.sr-density__option--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}
.sr-density__option-label { font-weight: 600; font-size: 0.875rem; }
.sr-density__option-desc { font-size: 0.75rem; opacity: 0.6; margin-top: 0.25rem; }
.sr-density__current { font-size: 0.8rem; opacity: 0.5; margin-top: 0.75rem; }

/* Senha */
.sr-password__toggle { /* botão "Alterar" */ }
.sr-password__form { /* form expandível */ }
.sr-password__input { /* input com focus: border primary */ }

/* Admin */
.sr-admin { border-left: 3px solid var(--color-warning, #f59e0b); }
.sr-admin__badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-error-bg);
  color: var(--color-error);
  padding: 2px 8px;
  border-radius: 99px;
}

/* Logout */
.sr-logout {
  margin-top: 2rem;
  text-align: center;
}
.sr-logout__btn {
  width: 100%;
  padding: 0.875rem;
  border-radius: 0.75rem;
  border: 1.5px solid var(--color-error);
  color: var(--color-error);
  font-weight: 600;
  background: transparent;
  cursor: pointer;
}
.sr-logout__btn:hover {
  background: var(--color-error-bg);
}

/* Footer */
.sr-footer {
  text-align: center;
  font-size: 0.7rem;
  opacity: 0.35;
  margin-top: 1.5rem;
  padding-bottom: 2rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Feedback messages */
.sr-message { /* toast, reutilizar padrão do pr-message */ }
```

#### CSS do ícone ⚙️ no ProfileRedesign (adicionar ao ProfileRedesign.css)

```css
/* Gear icon button — mobile header */
.pr-header__settings-btn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-on-surface);
  opacity: 0.5;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, background 0.15s;
}
.pr-header__settings-btn:hover {
  opacity: 1;
  background: var(--color-surface-container-low);
}

/* Gear icon button — desktop panel header */
.pr-panel__settings-btn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-on-surface);
  opacity: 0.4;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, background 0.15s;
}
.pr-panel__settings-btn:hover {
  opacity: 1;
  background: var(--color-surface-container-low);
}
```

---

## Ordem de Execução dos Sprints

| Sprint | Descrição | Deps |
|--------|-----------|------|
| S10A.1 | Criar SettingsRedesign.jsx + SettingsRedesign.css | — |
| S10A.2 | Modificar ProfileRedesign.jsx (remover settings, adicionar ⚙️) | S10A.1 |
| S10A.3 | Adicionar rota settings no App.jsx | S10A.1 |
| S10A.4 | CSS refinements + testes manuais | S10A.1-3 |

**S10A.1 e S10A.2 podem ser commitados juntos** (são complementares e formam uma unidade lógica).
**S10A.3 pode ser commitado separado** (integração com App.jsx).

---

## Checklist de Validação

- [ ] SettingsRedesign renderiza todas as 4 seções (Integrações, Preferências, Segurança, Admin)
- [ ] Telegram: "Gerar Código" funciona, exibe token, link "Abrir no Telegram" correto
- [ ] Telegram: "Desconectar" com confirm dialog funciona
- [ ] Densidade: 3 opções (Simples / Automático / Complexo) com visual de selecionado
- [ ] Densidade: mostra modo atual com contagem de protocolos
- [ ] Densidade: override persiste em localStorage (recarregar página mantém seleção)
- [ ] Alterar Senha: form expandível, validação 6+ chars, feedback de sucesso
- [ ] Admin DLQ: visível apenas para admin, badge "ACESSO RESTRITO", navega para admin-dlq
- [ ] Logout: botão funciona, redireciona para landing/login
- [ ] Versão: exibe versão correta do app
- [ ] ProfileRedesign: seção Settings removida, ícone ⚙️ visível e funcional
- [ ] App.jsx: rota `settings` funciona com lazy loading + Suspense
- [ ] Desktop: Settings centralizado (max-width 640px)
- [ ] Mobile: Settings full-width com back button funcional
- [ ] ESLint: 0 errors
- [ ] Views originais: Profile.jsx inalterado, sem regressão

---

## Mapeamento de Arquivos

| Arquivo | Ação | Sprint |
|---------|------|--------|
| `src/views/redesign/SettingsRedesign.jsx` | CRIAR | S10A.1 |
| `src/views/redesign/settings/SettingsRedesign.css` | CRIAR | S10A.1 |
| `src/views/redesign/ProfileRedesign.jsx` | MODIFICAR | S10A.2 |
| `src/views/redesign/profile/ProfileRedesign.css` | MODIFICAR (+ gear icon CSS) | S10A.2 |
| `src/App.jsx` | MODIFICAR (+ lazy import + case) | S10A.3 |

**Arquivos NÃO tocados:**
- `src/views/Profile.jsx`
- `src/views/HealthHistory.jsx`
- `src/views/Emergency.jsx`
- `src/features/dashboard/hooks/useComplexityMode.js`
- `src/shared/components/ui/BottomNavRedesign.jsx`
- Qualquer schema ou service
