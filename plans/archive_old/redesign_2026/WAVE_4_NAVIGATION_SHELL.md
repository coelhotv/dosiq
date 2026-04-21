# Wave 4 — Navigation Shell: BottomNav + Sidebar

**Status:** ✅ COMPLETO — Merged 2026-03-25 (Commit b02c0b7)
**Dependências:** Waves 0, 1, 2 e 3 DEVEM estar completas (tokens, typography, layout.redesign.css, components.redesign.css) ✅ ALL MET
**Branch:** `feature/redesign/wave-4-navigation-shell` [MERGED]
**Execução:** 4 sprints completados com sucesso
**Risco:** MÉDIO — envolve modificar App.jsx (arquivo crítico da aplicação) ✅ MITIGATED

---

## 🚩 ESTRATÉGIA DE ROLLOUT (LEIA ANTES DE EXECUTAR)

A partir desta wave, a estratégia muda de CSS scoped para **variantes explícitas de componente/view**.

**Regra fundamental para W4:**
- `BottomNav.jsx` e `BottomNav.css` **NÃO são modificados**
- Criar `BottomNavRedesign.jsx` + `BottomNavRedesign.css` como **novos arquivos**
- `Sidebar.jsx` + `Sidebar.css` são **novos arquivos** (não existem originais)
- Em `App.jsx`: branching via `isRedesignEnabled` — substituição de componente, NÃO branching interno no componente

**CRITICAL — Leia antes de modificar App.jsx:**
- App.jsx é o arquivo mais crítico do projeto. Qualquer erro nele quebra TODA a aplicação.
- A lógica de negócio existente (session, auth, navigateToProtocol, navigateToStock) NÃO muda.
- Apenas a camada de apresentação (qual componente é renderizado) muda condicionalmente.
- SEMPRE verificar com `npm run validate:agent` após qualquer mudança em App.jsx.

---

## 🧠 CONTEXTO OBRIGATÓRIO — Leia antes de codificar

### Estrutura atual do App.jsx

```
App.jsx renderiza:
1. OnboardingProvider > DashboardProvider (providers)
2. div.app-container [data-redesign={isRedesignEnabled ? 'true' : undefined}]
   - <main style={{ paddingBottom: '80px', minHeight: '100vh', position: 'relative' }}>
       renderCurrentView()
     </main>
   - <OfflineBanner />
   - {isAuthenticated && <BottomNav currentView={currentView} setCurrentView={setCurrentView} />}
   - Chat FAB
   - OnboardingWizard
   - InstallPrompt
```

### Props de navegação atuais

```jsx
// BottomNav props (interface a preservar em BottomNavRedesign)
<BottomNav currentView={currentView} setCurrentView={setCurrentView} />

// Views ativas no switch (renderCurrentView):
// 'landing', 'medicines', 'stock', 'protocols', 'treatment', 'profile',
// 'health-history', 'history', 'consultation', 'settings', 'emergency',
// 'admin-dlq', 'calendar', 'dashboard' (default)
```

### Hook useRedesign (já existe)
```jsx
import { useRedesign } from '@shared/hooks/useRedesign'
const { isRedesignEnabled } = useRedesign()
// isRedesignEnabled: boolean — true quando localStorage 'mr_redesign_preview' === '1'
// ou URL param ?redesign=1
```

---

## Sprint 4.1 — BottomNavRedesign

**Skill:** `/deliver-sprint`

### Arquivos a criar
- `src/shared/components/ui/BottomNavRedesign.jsx` (NOVO)
- `src/shared/components/ui/BottomNavRedesign.css` (NOVO)

### Arquivos NÃO modificar
- `src/shared/components/ui/BottomNav.jsx` (intacto)
- `src/shared/components/ui/BottomNav.css` (intacto)

### Implementação: BottomNavRedesign.jsx

```jsx
import { Calendar, Pill, Package, User } from 'lucide-react'
import './BottomNavRedesign.css'

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Hoje',       Icon: Calendar },
  { id: 'treatment',  label: 'Tratamento', Icon: Pill      },
  { id: 'stock',      label: 'Estoque',    Icon: Package   },
  { id: 'profile',    label: 'Perfil',     Icon: User      },
]

export default function BottomNavRedesign({ currentView, setCurrentView }) {
  return (
    <div className="bottom-nav-redesign-container" role="navigation" aria-label="Navegação principal">
      <nav className="bottom-nav-redesign">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`bnr-item${currentView === id ? ' bnr-item--active' : ''}`}
            onClick={() => setCurrentView(id)}
            aria-current={currentView === id ? 'page' : undefined}
            aria-label={label}
          >
            <Icon size={28} aria-hidden="true" />
            <span className="bnr-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
```

### Implementação: BottomNavRedesign.css

```css
/* ============================================
   BOTTOM NAV REDESIGN — Sanctuary Therapeutic
   Glass morphism. Mobile only (<768px).
   ============================================ */

.bottom-nav-redesign-container {
  display: block;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--glass-bg, rgba(248, 250, 251, 0.80));
  backdrop-filter: var(--glass-blur, blur(12px));
  -webkit-backdrop-filter: var(--glass-blur, blur(12px));
  border-top: 1px solid var(--color-outline-ghost, rgba(25, 28, 29, 0.10));
  padding: 0.75rem 1.5rem;
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
}

/* Ocultar em desktop — sidebar assume a navegação */
@media (min-width: 768px) {
  .bottom-nav-redesign-container {
    display: none;
  }
}

.bottom-nav-redesign {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.bnr-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 56px;
  min-height: 56px;
  padding: 0.5rem;
  color: var(--color-on-surface-variant, rgba(25, 28, 29, 0.60));
  background: none;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-lg, 1rem);
  transition: color 200ms ease-out, background 200ms ease-out, transform 150ms ease-out;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.bnr-item:hover {
  background: var(--state-hover, rgba(0, 106, 94, 0.08));
}

.bnr-item--active {
  color: var(--color-primary, #006a5e);
  transform: scale(1.05);
}

.bnr-item--active:hover {
  background: var(--color-primary-bg, rgba(0, 106, 94, 0.05));
}

.bnr-label {
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-label-sm, 0.625rem);
  font-weight: var(--font-weight-bold, 700);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider, 0.05em);
  line-height: 1;
}
```

### Critério de conclusão Sprint 4.1
- [ ] `BottomNavRedesign.jsx` criado em `src/shared/components/ui/`
- [ ] `BottomNavRedesign.css` criado em `src/shared/components/ui/`
- [ ] Lucide icons importados: Calendar, Pill, Package, User
- [ ] 4 tabs: Hoje, Tratamento, Estoque, Perfil
- [ ] Tab ativa: cor primary + scale(1.05)
- [ ] Glass background com backdrop-blur
- [ ] Oculto em ≥768px (display: none no media query)
- [ ] `BottomNav.jsx` NÃO foi modificado (verifique com `git diff src/shared/components/ui/BottomNav.jsx`)
- [ ] `aria-current="page"` no item ativo
- [ ] touch-action: manipulation aplicado (sem 300ms delay iOS)

---

## Sprint 4.2 — Desktop Sidebar

**Skill:** `/deliver-sprint`

### Arquivos a criar
- `src/shared/components/ui/Sidebar.jsx` (NOVO)
- `src/shared/components/ui/Sidebar.css` (NOVO)

### Implementação: Sidebar.jsx

```jsx
import { Calendar, Pill, Package, User, Plus } from 'lucide-react'
import './Sidebar.css'

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Hoje',       Icon: Calendar },
  { id: 'treatment',  label: 'Tratamentos', Icon: Pill      },
  { id: 'stock',      label: 'Estoque',    Icon: Package   },
  { id: 'profile',    label: 'Perfil',     Icon: User      },
]

export default function Sidebar({ currentView, setCurrentView }) {
  return (
    <aside className="sidebar" aria-label="Menu lateral">
      <div className="sidebar-brand">
        <span className="sidebar-brand-title">Dosiq</span>
        <span className="sidebar-brand-subtitle">Santuário Terapêutico</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`sidebar-nav-item${currentView === id ? ' sidebar-nav-item--active' : ''}`}
            onClick={() => setCurrentView(id)}
            aria-current={currentView === id ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-add-btn"
          onClick={() => setCurrentView('medicines')}
          aria-label="Adicionar medicamento"
        >
          <Plus size={18} aria-hidden="true" />
          <span>Adicionar Med.</span>
        </button>
      </div>
    </aside>
  )
}
```

### Implementação: Sidebar.css

```css
/* ============================================
   SIDEBAR — Sanctuary Therapeutic
   Desktop only (≥768px). Fixed left column.
   ============================================ */

.sidebar {
  display: none; /* Oculto em mobile */
  position: fixed;
  left: 0;
  top: 0;
  width: 16rem; /* 256px */
  height: 100vh;
  background: var(--color-surface-container-low, #f2f4f5);
  padding: 1.5rem 0.75rem;
  flex-direction: column;
  gap: 0.25rem;
  z-index: 50;
  overflow-y: auto;
  border-right: 1px solid var(--color-outline-ghost, rgba(25, 28, 29, 0.08));
}

@media (min-width: 768px) {
  .sidebar {
    display: flex;
  }
}

/* Brand area */
.sidebar-brand {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.75rem 1rem 1.5rem;
}

.sidebar-brand-title {
  font-family: var(--font-display, 'Public Sans', sans-serif);
  font-size: var(--text-title-lg, 1.125rem);
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-primary, #006a5e);
  line-height: 1.2;
}

.sidebar-brand-subtitle {
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-label-sm, 0.625rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--color-outline, #6d7a76);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider, 0.05em);
}

/* Nav area */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-nav-item, 1rem);
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-body-lg, 1rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--color-on-surface-variant, #3e4946);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 200ms ease-out;
  width: 100%;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.sidebar-nav-item:hover {
  background: var(--color-surface, #f8fafb);
  color: var(--color-on-surface, #191c1d);
}

.sidebar-nav-item--active {
  background: var(--color-primary, #006a5e);
  color: var(--color-on-primary, #ffffff);
  box-shadow: var(--gradient-primary-shadow, 0 8px 24px rgba(0, 106, 94, 0.20));
  font-weight: var(--font-weight-semibold, 600);
}

.sidebar-nav-item--active:hover {
  background: var(--color-primary-dark, #005047);
  color: var(--color-on-primary, #ffffff);
}

/* Footer area */
.sidebar-footer {
  padding-top: 1rem;
  border-top: 1px solid var(--color-outline-ghost, rgba(25, 28, 29, 0.08));
}

.sidebar-add-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--gradient-primary, linear-gradient(135deg, #006a5e, #008577));
  color: var(--color-on-primary, #ffffff);
  border: none;
  border-radius: var(--radius-button, 1.25rem);
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-body-lg, 1rem);
  font-weight: var(--font-weight-semibold, 600);
  cursor: pointer;
  transition: all 200ms ease-out;
  box-shadow: var(--gradient-primary-shadow, 0 8px 24px rgba(0, 106, 94, 0.20));
  -webkit-tap-highlight-color: transparent;
}

.sidebar-add-btn:hover {
  transform: scale(1.02);
}

.sidebar-add-btn:active {
  transform: scale(0.98);
}
```

### Critério de conclusão Sprint 4.2
- [ ] `Sidebar.jsx` criado em `src/shared/components/ui/`
- [ ] `Sidebar.css` criado em `src/shared/components/ui/`
- [ ] Oculto em mobile (display: none), visível em ≥768px (display: flex)
- [ ] Largura: 16rem (256px)
- [ ] Brand com título "Dosiq" (Public Sans bold, primary) + subtítulo
- [ ] 4 nav items com ícones Lucide + labels
- [ ] Item ativo: bg primary + text white + shadow
- [ ] Botão "Adicionar Med." com gradient primary no rodapé
- [ ] `aria-current="page"` no item ativo

---

## Sprint 4.3 — Atualização do App.jsx

**Skill:** `/deliver-sprint`

### Arquivo a modificar
- `src/App.jsx`

### ⚠️ ATENÇÃO CRÍTICA
- Leia o arquivo App.jsx INTEIRO antes de modificar
- Altere APENAS as partes indicadas abaixo
- NÃO altere a lógica de session, auth, navigate, views
- Execute `npm run validate:agent` imediatamente após

### Mudanças em App.jsx

**1. Adicionar imports lazy no topo (após os imports existentes de lazy views):**

```jsx
const BottomNavRedesign = lazy(() => import('@shared/components/ui/BottomNavRedesign'))
const Sidebar = lazy(() => import('@shared/components/ui/Sidebar'))
```

**2. Modificar o bloco `return (...)` dentro de AppInner:**

Localizar o bloco atual:
```jsx
return (
  <OnboardingProvider>
    <DashboardProvider>
      <div className="app-container" data-redesign={isRedesignEnabled ? 'true' : undefined}>
        <main style={{ paddingBottom: '80px', minHeight: '100vh', position: 'relative' }}>
          {renderCurrentView()}
          <footer ...> </footer>
        </main>

        <OfflineBanner />

        {isAuthenticated && (
          <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
        )}
        ...
```

Substituir por:
```jsx
return (
  <OnboardingProvider>
    <DashboardProvider>
      <div className="app-container" data-redesign={isRedesignEnabled ? 'true' : undefined}>

        {/* Sidebar — desktop, apenas usuários com flag ativo */}
        {isAuthenticated && isRedesignEnabled && (
          <Suspense fallback={null}>
            <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
          </Suspense>
        )}

        <main
          className={isAuthenticated && isRedesignEnabled ? 'app-main main-with-sidebar' : 'app-main'}
          style={{ paddingBottom: isRedesignEnabled ? undefined : '80px', minHeight: '100vh', position: 'relative' }}
        >
          {renderCurrentView()}
          <footer style={{ textAlign: 'center', marginTop: 'var(--space-8)', paddingBottom: 'var(--space-8)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
            {' '}
          </footer>
        </main>

        <OfflineBanner />

        {/* BottomNav: redesign para flag users, original para outros */}
        {isAuthenticated && (
          isRedesignEnabled ? (
            <Suspense fallback={null}>
              <BottomNavRedesign currentView={currentView} setCurrentView={setCurrentView} />
            </Suspense>
          ) : (
            <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
          )
        )}
        ...
```

**Nota sobre o `<footer>`:** Preservar o footer exatamente como está (incluindo o comentário dentro e o `{' '}`). Apenas mova-o para dentro do novo `<main>`.

**3. Adicionar CSS para .app-main em `src/shared/styles/layout.redesign.css`:**

Ao final do arquivo `layout.redesign.css`, adicionar:
```css
/* App shell — sidebar offset e padding de main */
.app-main {
  min-height: 100vh;
  position: relative;
}

[data-redesign="true"] .app-main {
  padding-bottom: 80px; /* espaço para BottomNavRedesign em mobile */
}

@media (min-width: 768px) {
  [data-redesign="true"] .main-with-sidebar {
    margin-left: 16rem; /* 256px — largura da sidebar */
    padding-bottom: 0; /* sem bottom nav em desktop */
  }
}
```

### Critério de conclusão Sprint 4.3
- [ ] `BottomNavRedesign` e `Sidebar` importados com `lazy()` + `Suspense fallback={null}` em App.jsx
- [ ] Sidebar renderizada apenas quando `isAuthenticated && isRedesignEnabled`
- [ ] BottomNavRedesign renderizada apenas quando `isAuthenticated && isRedesignEnabled` (BottomNav legada quando flag off)
- [ ] main recebe classe `main-with-sidebar` apenas quando `isAuthenticated && isRedesignEnabled`
- [ ] Usuários SEM flag: app idêntica ao estado anterior (BottomNav original, sem sidebar, padding 80px)
- [ ] Usuários COM flag: sidebar visível no desktop, BottomNavRedesign no mobile, main offset corretamente
- [ ] `npm run validate:agent` passa (0 erros lint, testes passando)
- [ ] Build sem erros (`npm run build`)

---

## Sprint 4.4 — Page Transitions (AnimatePresence)

**Skill:** `/deliver-sprint`

**Dependência:** Sprint 4.3 DEVE estar completo (App.jsx atualizado).

### Arquivo a modificar
- `src/App.jsx`

### Mudança em App.jsx

Localizar a função `renderCurrentView()` e envolver seu retorno com AnimatePresence **apenas quando isRedesignEnabled**.

**Localizar o bloco no return de AppInner:**
```jsx
<main
  className={...}
  style={...}
>
  {renderCurrentView()}
  <footer ...>
```

**Substituir `{renderCurrentView()}` por:**
```jsx
{isRedesignEnabled ? (
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={currentView}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {renderCurrentView()}
    </motion.div>
  </AnimatePresence>
) : (
  renderCurrentView()
)}
```

**Adicionar import no topo de App.jsx (junto aos outros imports React):**
```jsx
import { motion, AnimatePresence } from 'framer-motion'
```

**Nota:** `framer-motion` já está instalado (v12). Usar import de `framer-motion` (NÃO de `motion/react`).

### Critério de conclusão Sprint 4.4
- [ ] `motion` e `AnimatePresence` importados de `framer-motion`
- [ ] Transição de views com fade suave + translate Y quando flag ativo
- [ ] Usuários SEM flag: sem AnimatePresence, comportamento idêntico ao atual
- [ ] Transição com `mode="wait"` (espera exit antes do enter)
- [ ] Duração: 250ms max (não impactar percepção de velocidade)
- [ ] `npm run validate:agent` passa

---

## Checklist Final Wave 4

### Verificações de arquivo
```bash
# Deve existir:
ls src/shared/components/ui/BottomNavRedesign.jsx
ls src/shared/components/ui/BottomNavRedesign.css
ls src/shared/components/ui/Sidebar.jsx
ls src/shared/components/ui/Sidebar.css

# NÃO deve ter sido modificado:
git diff src/shared/components/ui/BottomNav.jsx
git diff src/shared/components/ui/BottomNav.css
```

### Smoke test com flag OFF (comportamento atual)
- [ ] App carrega normalmente sem erros no console
- [ ] BottomNav original visível (4 tabs com SVG paths)
- [ ] Sem sidebar visível em qualquer viewport
- [ ] main com padding-bottom 80px (espaço para BottomNav)
- [ ] Navegação entre views funciona

### Smoke test com flag ON (`?redesign=1`)
- [ ] Mobile (<768px): BottomNavRedesign visível (glass, Lucide icons)
- [ ] Desktop (≥768px): Sidebar visível na esquerda, BottomNavRedesign oculta
- [ ] Desktop: main content offset por 256px (sidebar não sobrepõe conteúdo)
- [ ] Tab ativa highlightada em primary color
- [ ] Page transitions suaves entre views
- [ ] Navegação funciona em ambas as UIs (BottomNav e Sidebar)

### Testes e qualidade
- [ ] `npm run validate:agent` passa (≥539 testes, 0 erros lint)
- [ ] `npm run build` sem erros
- [ ] PR criado aguardando review Gemini Code Assist

---

## Referências

- `plans/redesign/EXEC_SPEC_GRADUAL_ROLLOUT.md` — estratégia de rollout
- `plans/redesign/MASTER_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md` — seção 9 (Wave 4)
- `src/shared/contexts/RedesignContext.jsx` — provider do flag
- `src/shared/hooks/useRedesign.js` — hook de consumo
- `src/shared/styles/layout.redesign.css` — classes de grid e layout (a atualizar no Sprint 4.3)
