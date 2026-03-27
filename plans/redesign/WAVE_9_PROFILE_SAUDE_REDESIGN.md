# Wave 9 — Perfil & Saúde Redesign: Santuário Terapêutico

**Status:** ⏳ PENDENTE
**Data de criação da spec:** 2026-03-27
**Dependências:** W0 ✅ W1 ✅ W2 ✅ W3 ✅ W4 ✅ W5 ✅ W6 ✅ W6.5 ✅ W7 ✅ W7.5 ✅ W8 ✅ (todos mergeados em main)
**Branch:** `feature/redesign/wave-9-profile-saude`
**Risco:** BAIXO — nenhum hook compartilhado novo; lógica de negócio intocada; as views redesenhadas são wrappers visuais sobre os serviços existentes.

---

## Por que esta wave existe

`Profile.jsx` atual usa glassmorphism pesado (`glass-bg`, `glass-blur`, `glass-border`, `glass-card`) com avatar em gradiente rosa→cyan e bordas 1px em todas as seções. Isso contradiz diretamente o princípio de **"flat utility layout"** da Product Strategy.

`HealthHistory.jsx` e `Emergency.jsx` usam variáveis de cor do sistema neon (`--color-primary: #ec4899`, `--neon-*`, `--glow-*`) nos seus CSS, quebrando a coerência visual com as views já redesenhadas (Dashboard, Tratamentos, Estoque).

A pergunta central do Perfil é: **"Como configurar minha experiência?"** — e a view atual falha porque o glassmorphism cria distração visual em uma área que deveria ser serena e utilitária.

O redesign entrega:
- **Avatar com initials** em gradiente `primary → primary-container` (Verde Saúde, sem neon)
- **Seções como blocos tonais** — separação por tom de superfície, sem bordas 1px, sem glass
- **ProfileLink como sanctuary list item** — ícone em container `secondary-fixed`, chevron Lucide, hover tonal
- **HealthHistory e Emergency** com paleta atualizada (tokens novos, sem variáveis neon)

---

## O que esta wave FAZ

- Cria `src/views/redesign/profile/ProfileHeaderRedesign.jsx` + CSS
- Cria `src/views/redesign/profile/ProfileSectionRedesign.jsx` + CSS
- Cria `src/views/redesign/profile/ProfileLinkRedesign.jsx` + CSS
- Cria `src/views/redesign/ProfileRedesign.jsx` + `ProfileRedesign.css`
- Cria `src/views/redesign/HealthHistoryRedesign.jsx` + `HealthHistoryRedesign.css`
- Cria `src/views/redesign/EmergencyRedesign.jsx` + `EmergencyRedesign.css`
- Atualiza `src/App.jsx`: adiciona lazy imports + branching `isRedesignEnabled` nos casos `profile`, `health-history`, `history` e `emergency`

## O que esta wave NÃO FAZ

- ❌ NÃO toca em `Profile.jsx`, `HealthHistory.jsx`, `Emergency.jsx` (views originais intactas)
- ❌ NÃO modifica `ProfileHeader.jsx`, `ProfileSection.jsx`, `ProfileLink.jsx` (componentes originais intactos)
- ❌ NÃO modifica `Profile.css` original em `src/views/profile/`
- ❌ NÃO altera serviços (`emergencyCardService`, `supabase`, `signOut`, `updatePassword`)
- ❌ NÃO altera schemas Zod
- ❌ NÃO altera `HealthHistory.jsx` — a view redesenhada **importa e renderiza** o componente original, apenas envolvendo-o com override de CSS
- ❌ NÃO implementa dark mode
- ❌ NÃO cria nova lógica de autenticação

---

## Decisão Arquitetural: Layout Mobile vs. Desktop

> **Problema resolvido:** Com a Sidebar de navegação (W4) já ativa no desktop, a view de Perfil não pode ser mais uma lista vertical de itens — criaria dois menus em cascata visual, ambos parecendo navegação mas com papéis distintos.
>
> **Regra:** Sidebar = navegação entre seções da app. Profile = configuração da conta. São contextos diferentes e o layout deve comunicar isso.

### Mobile (< 768px): Lista Única

No mobile, o Perfil é acessado via bottom nav. Não há sidebar — a lista vertical funciona perfeitamente como única camada de navegação secundária.

```
╭ Bottom Nav ────────────────────────╮
│ Hoje │ Tratam. │ Estoque │ [Perfil]│
╰─────────────────────────────────────╯

  ↓ tela principal

╭──────────────────────────────────────╮
│  ● DM  Dona Maria                    │
│        email@email.com               │
╰──────────────────────────────────────╯

  SAÚDE & HISTÓRICO
  ────────────────────────────────────
  ○ 📊  Minha Saúde              ›
  ○ 🆘  Cartão de Emergência     ›
  ○ 👨‍⚕️  Consulta Médica          ›

  RELATÓRIOS & DADOS
  ────────────────────────────────────
  ○ 📄  Relatório PDF            ›
  ○ 📤  Exportar Dados           ›

  CONFIGURAÇÕES
  ────────────────────────────────────
  ○ 🤖  Telegram      [Conectado ▸]
  ○ 📐  Densidade    [Automático ▾]
  ○ 🔒  Alterar Senha  [Alterar →]

  [ Sair da Conta ]
```

### Desktop (≥ 768px): Duas Colunas — Painel + Conteúdo

No desktop, a sidebar já ocupa o lado esquerdo da tela. O Perfil resolve o problema com layout **duas colunas internas**: painel de categorias (esquerda) + conteúdo da categoria ativa (direita). Esse é o padrão de macOS Settings, iOS Settings em iPad, e Windows Settings.

```
╭ Sidebar ──╮ ╭──── Conteúdo Principal (max-w: 900px) ──────────────────────╮
│ Hoje      │ │                                                              │
│ Tratam.   │ │ ╭── Painel (240px) ───╮  ╭── Conteúdo Ativo ─────────────╮ │
│ Estoque   │ │ │  ● DM               │  │  SAÚDE & HISTÓRICO            │ │
│ [Perfil]  │ │ │  Dona Maria         │  │  ──────────────────────────── │ │
│           │ │ │  email@email.com    │  │  ○ 📊  Minha Saúde       ›   │ │
│           │ │ │                     │  │  ○ 🆘  Cartão Emergência  ›   │ │
│           │ │ │  ─────────────────  │  │  ○ 👨‍⚕️  Consulta Médica   ›   │ │
│           │ │ │  [Saúde & Histórico]│  │                               │ │
│           │ │ │   Relatórios        │  ╰───────────────────────────────╯ │
│           │ │ │   Configurações     │                                     │
│           │ │ │                     │                                     │
│           │ │ │  ─────────────────  │                                     │
│           │ │ │  [Sair da Conta]    │                                     │
│           │ │ ╰─────────────────────╯                                     │
╰───────────╯ ╰──────────────────────────────────────────────────────────────╯
```

**Como funciona:**
- O **painel esquerdo** (240px) é fixo: avatar compacto + lista de categorias como nav links + botão logout
- O **painel direito** (flex:1) renderiza o conteúdo da categoria ativa (`activeSection` state)
- Ao entrar na view, `activeSection` default é `'health'` (Saúde & Histórico)
- Clicar numa categoria no painel esquerdo atualiza `activeSection` — **não navega para fora**
- Clicar em um item do painel direito (ex: "Minha Saúde") executa `onNavigate()` normalmente

**Implementação:** state `activeSection` + media query CSS + renderização condicional do conteúdo direito.
**NÃO usar React Router** — manter view-based navigation. O `activeSection` é local ao ProfileRedesign.

---

## Layout Visual Alvo — Notas de Implementação

**Mobile (single column):**
- Avatar block: `surface-container-lowest` + ambient shadow, radius 2rem
- Seções: sem card — label uppercase + lista com `surface-container-lowest` + radius 1.25rem
- `ProfileLink`: ícone em container circular `secondary-fixed` (36px), chevron `ChevronRight` Lucide
- Hover: `surface-container-low` (sem borda, sem glow)
- "Sair da Conta": ghost button, borda `color-error`, cor `color-error`

**Desktop (two-column):**
- `.pr-layout` = `display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem; align-items: start`
- Painel esquerdo: avatar compacto + categorias como nav links (`pr-panel-nav__item`) + logout
- Painel direito: título da seção ativa + lista de itens (os mesmos `ProfileLinkRedesign`)
- Item ativo no painel: `background: primary-bg; color: primary; font-weight: 600`
- Ambos os painéis têm `background: surface-container-lowest`, radius 1.5rem, ambient shadow

---

## Regras Absolutas para este Wave

> **Leia antes de escrever qualquer linha de código.**

1. **NÃO usar glassmorphism** — `backdrop-filter`, `glass-bg`, `glass-blur`, `glass-border`, `glass-card` são proibidos em todos os arquivos desta wave.
2. **NÃO usar variáveis neon** — `--neon-*`, `--glow-*`, `--color-primary: #ec4899` não existem no redesign.
3. **NÃO usar bordas 1px** como separador estrutural — usar tonal shift (`background: var(--color-surface-container-low)`) ou espaçamento.
4. **Toda cor via CSS var** — nunca `color: #006a5e` diretamente. Sempre `color: var(--color-primary)`.
5. **Ícones Lucide emparelhados com texto** — `ChevronRight` para chevrons, nunca emoji `›` como affordance única.
6. **Border-radius mínimo `md` (0.75rem)** — nunca usar `sm` ou `xs`.
7. **NÃO instalar pacotes novos** — `lucide-react` já está instalado desde W1.
8. **Manter lazy loading** — todos os componentes importados em `App.jsx` usam `lazy()` + `Suspense` + `ViewSkeleton`.
9. **NÃO modificar views originais** — apenas criar variantes em `src/views/redesign/`.

---

## Manifesto de Arquivos

| Arquivo | Operação | Sprint |
|---------|---------|--------|
| `src/views/redesign/profile/ProfileHeaderRedesign.jsx` | CRIAR | 9.1 |
| `src/views/redesign/profile/ProfileSectionRedesign.jsx` | CRIAR | 9.1 |
| `src/views/redesign/profile/ProfileLinkRedesign.jsx` | CRIAR | 9.1 |
| `src/views/redesign/profile/ProfileRedesign.css` | CRIAR | 9.1 |
| `src/views/redesign/ProfileRedesign.jsx` | CRIAR | 9.2 |
| `src/views/redesign/HealthHistoryRedesign.jsx` | CRIAR | 9.3 |
| `src/views/redesign/HealthHistoryRedesign.css` | CRIAR | 9.3 |
| `src/views/redesign/EmergencyRedesign.jsx` | CRIAR | 9.4 |
| `src/views/redesign/EmergencyRedesign.css` | CRIAR | 9.4 |
| `src/App.jsx` | MODIFICAR (lazy imports + branching) | 9.5 |

### Arquivos NUNCA tocar nesta wave

```
src/views/Profile.jsx                              ← original intocado
src/views/profile/Profile.css                      ← original intocado
src/views/profile/ProfileHeader.jsx                ← original intocado
src/views/profile/ProfileSection.jsx               ← original intocado
src/views/profile/ProfileLink.jsx                  ← original intocado
src/views/HealthHistory.jsx                        ← original intocado
src/views/HealthHistory.css                        ← original intocado
src/views/Emergency.jsx                            ← original intocado
src/views/Emergency.css                            ← original intocado
src/features/emergency/                            ← lógica intocada
src/features/export/                               ← intocado
src/features/reports/                              ← intocado
src/shared/utils/supabase.js                       ← intocado
src/schemas/                                       ← intocados
```

---

## Sprint 9.1 — Sub-componentes do Profile Redesign

**Arquivos a criar:**
- `src/views/redesign/profile/ProfileHeaderRedesign.jsx`
- `src/views/redesign/profile/ProfileSectionRedesign.jsx`
- `src/views/redesign/profile/ProfileLinkRedesign.jsx`
- `src/views/redesign/profile/ProfileRedesign.css`

### Objetivo

Criar os três sub-componentes utilitários do Profile com o design system Santuário. Eles serão importados apenas por `ProfileRedesign.jsx` (S9.2).

---

### ProfileRedesign.css

Arquivo único de CSS para os sub-componentes e para a view principal. Todos os seletores usam prefixo `pr-` para evitar colisões com as classes originais.

```css
/* ============================================================
   ProfileRedesign.css — Wave 9
   Flat utility layout, sem glass, sem neon.
   Mobile: lista única. Desktop (≥768px): duas colunas.
   Prefixo: pr- (profile redesign)
   ============================================================ */

/* ── View wrapper ─────────────────────────────────────────── */

.pr-view {
  padding: var(--space-4);
  padding-bottom: 100px;
  max-width: 900px;
  margin: 0 auto;
}

/* ── Layout: mobile single column → desktop two columns ───── */

.pr-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .pr-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: var(--space-6);
    align-items: start;
  }
}

/* ── Left panel (desktop only) ───────────────────────────── */

.pr-panel {
  background: var(--color-surface-container-lowest);
  border-radius: 1.5rem;
  box-shadow: var(--shadow-ambient);
  overflow: hidden;
  /* Mobile: não aparece como painel separado — o header e nav ficam inline */
}

/* Avatar compacto dentro do painel esquerdo */
.pr-panel__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4);
  border-bottom: 1px solid var(--color-outline-ghost, rgba(25,28,29,0.08));
}

.pr-panel__avatar {
  width: 44px;
  height: 44px;
  min-width: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-container));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-on-primary);
  flex-shrink: 0;
}

.pr-panel__info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.pr-panel__name {
  font-family: var(--font-body);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-panel__email {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-on-surface);
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Navigation links no painel esquerdo */
.pr-panel__nav {
  padding: var(--space-2) 0;
}

.pr-panel-nav__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 12px var(--space-4);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 150ms ease-out;
  min-height: 48px;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-on-surface);
  opacity: 0.7;
  border-radius: 0;
}

.pr-panel-nav__item:hover {
  background: var(--color-surface-container-low);
  opacity: 1;
}

.pr-panel-nav__item--active {
  background: var(--color-primary-bg, rgba(0,106,94,0.08));
  color: var(--color-primary);
  font-weight: 600;
  opacity: 1;
}

.pr-panel-nav__item--active:hover {
  background: var(--color-primary-bg, rgba(0,106,94,0.12));
}

.pr-panel-nav__icon {
  font-size: 1rem;
  line-height: 1;
  flex-shrink: 0;
}

/* Logout no rodapé do painel */
.pr-panel__logout {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-outline-ghost, rgba(25,28,29,0.08));
}

.pr-panel__logout-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 10px var(--space-2);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-error);
  min-height: 44px;
  border-radius: 0.75rem;
  transition: background 150ms ease-out;
  text-align: left;
}

.pr-panel__logout-btn:hover {
  background: var(--color-error-bg, #ffdad6);
}

/* ── Right content panel ──────────────────────────────────── */

.pr-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── Avatar Block (mobile — aparece acima da lista) ────────── */

.pr-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-surface-container-lowest);
  border-radius: 1.5rem;
  box-shadow: var(--shadow-ambient);
}

/* Em desktop, o pr-header fica dentro do .pr-panel — escondemos o standalone */
@media (min-width: 768px) {
  .pr-header--mobile-only {
    display: none;
  }
}

.pr-header__avatar {
  width: 52px;
  height: 52px;
  min-width: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-container));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-on-primary);
}

.pr-header__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pr-header__name {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-header__email {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--color-on-surface);
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Sections ─────────────────────────────────────────────── */

.pr-section {
  margin-bottom: var(--space-4);
}

.pr-section__title {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-on-surface);
  opacity: 0.45;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 var(--space-2) var(--space-2);
  padding: 0;
}

.pr-section__content {
  background: var(--color-surface-container-lowest);
  border-radius: 1.25rem;
  overflow: hidden;
  box-shadow: var(--shadow-ambient);
}

/* ── List Items (ProfileLink) ─────────────────────────────── */

.pr-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-4);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-outline-ghost, rgba(25,28,29,0.08));
  cursor: pointer;
  text-align: left;
  transition: background 150ms ease-out;
  min-height: 56px;
}

.pr-link:last-child {
  border-bottom: none;
}

.pr-link:hover {
  background: var(--color-surface-container-low);
}

.pr-link:active {
  background: var(--color-surface-container);
}

.pr-link__icon-wrap {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 50%;
  background: var(--color-secondary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pr-link__icon-emoji {
  font-size: 1rem;
  line-height: 1;
}

.pr-link__label {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-on-surface);
  flex: 1;
}

.pr-link__detail {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--color-on-surface);
  opacity: 0.5;
  margin-right: var(--space-2);
}

.pr-link__chevron {
  color: var(--color-on-surface);
  opacity: 0.3;
  flex-shrink: 0;
}

/* ── Telegram inline block ────────────────────────────────── */

.pr-telegram {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-outline-ghost, rgba(25,28,29,0.08));
}

.pr-telegram__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
}

.pr-telegram__icon-wrap {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 50%;
  background: var(--color-secondary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.pr-telegram__label {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-on-surface);
  flex: 1;
}

.pr-telegram__badge {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 99px;
}

.pr-telegram__badge--connected {
  background: var(--color-primary-bg, rgba(0,106,94,0.1));
  color: var(--color-primary);
}

.pr-telegram__badge--disconnected {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
  opacity: 0.6;
}

.pr-telegram__expand {
  padding: 0 var(--space-4) var(--space-3) calc(36px + var(--space-3) + var(--space-3));
}

.pr-telegram__code {
  font-size: 0.875rem;
  color: var(--color-on-surface);
  opacity: 0.7;
}

.pr-telegram__link {
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
}

.pr-telegram__link:hover {
  text-decoration: underline;
}

.pr-telegram__disconnect-btn {
  background: none;
  border: none;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-error);
  cursor: pointer;
  padding: 0;
}

/* ── Densidade (Complexity select) ───────────────────────── */

.pr-density {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-outline-ghost, rgba(25,28,29,0.08));
}

.pr-density__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
}

.pr-density__icon-wrap {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 50%;
  background: var(--color-secondary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.pr-density__label {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-on-surface);
  flex: 1;
}

.pr-density__select {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-on-surface);
  background: var(--color-surface-container-low);
  border: 1px solid var(--color-outline-ghost, rgba(25,28,29,0.15));
  border-radius: 0.75rem;
  padding: 6px 10px;
  cursor: pointer;
  min-height: 36px;
}

/* ── Alterar Senha ────────────────────────────────────────── */

.pr-password {
  padding: var(--space-4);
}

.pr-password__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
}

.pr-password__icon-wrap {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 50%;
  background: var(--color-secondary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.pr-password__label {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-on-surface);
  flex: 1;
}

.pr-password__toggle {
  background: none;
  border: none;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-primary);
  cursor: pointer;
  padding: 0;
}

.pr-password__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-2);
  padding-left: calc(36px + var(--space-3) + var(--space-3));
}

.pr-password__input {
  font-family: var(--font-body);
  font-size: 1rem;
  padding: 12px 16px;
  border: 1px solid var(--color-outline-ghost, rgba(25,28,29,0.15));
  border-radius: 0.75rem;
  background: var(--color-surface-container-low);
  color: var(--color-on-surface);
  min-height: 48px;
  outline: none;
}

.pr-password__input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 106, 94, 0.12);
}

/* ── Feedback messages ───────────────────────────────────── */

.pr-message {
  padding: var(--space-3) var(--space-4);
  border-radius: 0.75rem;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: var(--space-4);
}

.pr-message--success {
  background: var(--color-success-bg, #ecfdf5);
  color: var(--color-success, #22c55e);
}

.pr-message--error {
  background: var(--color-error-bg, #ffdad6);
  color: var(--color-error, #ba1a1a);
}

/* ── Logout (mobile — abaixo de tudo) ────────────────────── */

.pr-logout {
  margin-top: var(--space-4);
  margin-bottom: var(--space-6);
}

/* Em desktop, o logout está no painel esquerdo — esconde o botão mobile */
@media (min-width: 768px) {
  .pr-logout--mobile-only {
    display: none;
  }
}

.pr-logout__btn {
  width: 100%;
  padding: 14px var(--space-4);
  border-radius: 1.25rem;
  border: 1.5px solid var(--color-error);
  background: transparent;
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-error);
  cursor: pointer;
  min-height: 56px;
  transition: background 200ms ease-out;
}

.pr-logout__btn:hover {
  background: var(--color-error-bg, #ffdad6);
}

.pr-logout__btn:active {
  background: var(--color-error-container, #ffdad6);
}
```

---

### ProfileHeaderRedesign.jsx

```jsx
// src/views/redesign/profile/ProfileHeaderRedesign.jsx
import './ProfileRedesign.css'

/**
 * Cabeçalho do perfil redesenhado — Santuário Terapêutico.
 * Avatar com initials em gradiente verde, sem glassmorphism.
 */
export default function ProfileHeaderRedesign({ name, email }) {
  // Gera initials: "Dona Maria" → "DM", "Carlos" → "C"
  const initials = (name || email || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div className="pr-header">
      <div className="pr-header__avatar" aria-hidden="true">
        {initials}
      </div>
      <div className="pr-header__info">
        <h2 className="pr-header__name">{name || 'Paciente'}</h2>
        {email && <span className="pr-header__email">{email}</span>}
      </div>
    </div>
  )
}
```

---

### ProfileSectionRedesign.jsx

```jsx
// src/views/redesign/profile/ProfileSectionRedesign.jsx
import './ProfileRedesign.css'

/**
 * Seção de perfil redesenhada — tonal surface, sem glass, sem borda.
 */
export default function ProfileSectionRedesign({ title, children }) {
  return (
    <div className="pr-section">
      <h3 className="pr-section__title">{title}</h3>
      <div className="pr-section__content">{children}</div>
    </div>
  )
}
```

---

### ProfileLinkRedesign.jsx

```jsx
// src/views/redesign/profile/ProfileLinkRedesign.jsx
import { ChevronRight } from 'lucide-react'
import './ProfileRedesign.css'

/**
 * Item de navegação do perfil redesenhado — sanctuary list item.
 * Ícone em container secondary-fixed, chevron Lucide.
 *
 * @param {string} icon - Emoji do ícone (mantido para compatibilidade com original)
 * @param {string} label - Texto do item
 * @param {string} [detail] - Detalhe opcional (ex: status)
 * @param {Function} onClick - Callback de clique
 */
export default function ProfileLinkRedesign({ icon, label, detail, onClick }) {
  return (
    <button className="pr-link" onClick={onClick} type="button">
      <span className="pr-link__icon-wrap" aria-hidden="true">
        <span className="pr-link__icon-emoji">{icon}</span>
      </span>
      <span className="pr-link__label">{label}</span>
      {detail && <span className="pr-link__detail">{detail}</span>}
      <ChevronRight className="pr-link__chevron" size={18} aria-hidden="true" />
    </button>
  )
}
```

---

## Sprint 9.2 — ProfileRedesign View Principal

**Arquivo:** `src/views/redesign/ProfileRedesign.jsx`

### Objetivo

Criar a view principal do perfil com o design Santuário. Reutiliza toda a lógica de `Profile.jsx` (estados, handlers, supabase calls) mas renderiza com os sub-componentes redesenhados (`ProfileHeaderRedesign`, `ProfileSectionRedesign`, `ProfileLinkRedesign`) e o CSS da S9.1.

### Regras críticas de implementação

1. **NÃO copiar lógica de negócio** — importar os serviços diretamente como em `Profile.jsx`. A lógica de `handleLogout`, `generateTelegramToken`, `handleComplexityChange`, etc. deve ser idêntica.
2. **Usar hooks na ordem correta:** States → Memos → Effects → Handlers (obrigatório por CLAUDE.md).
3. O bloco de Telegram, Densidade e Senha é renderizado inline (não como `ProfileLink`) porque tem interatividade interna — mas com o CSS `.pr-telegram`, `.pr-density`, `.pr-password`.
4. **Importar CSS via `./profile/ProfileRedesign.css`** — o CSS está no sub-diretório.

### Implementação completa

```jsx
// src/views/redesign/ProfileRedesign.jsx
import { useState, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { supabase, signOut, updatePassword } from '@shared/utils/supabase'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import ExportDialog from '@features/export/components/ExportDialog'
import ReportGenerator from '@features/reports/components/ReportGenerator'
import ProfileHeaderRedesign from './profile/ProfileHeaderRedesign'
import ProfileSectionRedesign from './profile/ProfileSectionRedesign'
import ProfileLinkRedesign from './profile/ProfileLinkRedesign'
import './profile/ProfileRedesign.css'

// ── Definição das seções de navegação ─────────────────────────────────────────
// Usada pelo painel esquerdo (desktop) e para identificar qual conteúdo renderizar.
const SECTIONS = [
  { id: 'health',   label: 'Saúde & Histórico',  icon: '📊' },
  { id: 'reports',  label: 'Relatórios & Dados',  icon: '📄' },
  { id: 'settings', label: 'Configurações',        icon: '⚙️' },
]

export default function ProfileRedesign({ onNavigate }) {
  // ── States ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [telegramToken, setTelegramToken] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [complexityOverride, setComplexityOverride] = useState(
    () => localStorage.getItem('mr_complexity_override') || 'auto'
  )
  // Controla qual seção está ativa no layout desktop duas colunas.
  // No mobile, todas as seções são exibidas empilhadas — este state é ignorado.
  const [activeSection, setActiveSection] = useState('health')

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadProfile()
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (!error && data) setSettings(data)
      else if (error && error.code !== 'PGRST116') console.error(error)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try { await signOut() } catch (err) { console.error(err) }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) { setError('Senha deve ter no mínimo 6 caracteres'); return }
    try {
      await updatePassword(newPassword)
      showFeedback('Senha atualizada com sucesso!')
      setNewPassword('')
      setShowPasswordForm(false)
    } catch (err) {
      setError('Erro ao atualizar senha: ' + err.message)
    }
  }

  const generateTelegramToken = async () => {
    const token = window.crypto.randomUUID().split('-')[0].toUpperCase()
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, verification_token: token, updated_at: new Date() }, { onConflict: 'user_id' })
      if (error) throw error
      setTelegramToken(token)
    } catch (err) {
      console.error(err)
      setError('Erro ao gerar token. Tente novamente.')
    }
  }

  const handleDisconnectTelegram = async () => {
    if (!window.confirm('Deseja desconectar o Telegram? Você parará de receber notificações.')) return
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ telegram_chat_id: null, verification_token: null, updated_at: new Date() })
        .eq('user_id', user.id)
      if (error) throw error
      setSettings((prev) => ({ ...prev, telegram_chat_id: null }))
      setTelegramToken(null)
      showFeedback('Telegram desconectado!')
    } catch (err) {
      console.error(err)
      setError('Erro ao desconectar Telegram.')
    }
  }

  const handleComplexityChange = (value) => {
    setComplexityOverride(value)
    if (value === 'auto') localStorage.removeItem('mr_complexity_override')
    else localStorage.setItem('mr_complexity_override', value)
  }

  const showFeedback = (msg) => {
    setMessage(msg)
    setError(null)
    setTimeout(() => setMessage(null), 3000)
  }

  // ── Render guard ─────────────────────────────────────────────────────────────
  if (isLoading) return <Loading />

  const isTelegramConnected = !!settings?.telegram_chat_id
  const initials = (user?.user_metadata?.name || user?.email || 'P')
    .split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

  // ── Blocos de conteúdo de cada seção ─────────────────────────────────────────
  // Extraídos como constantes para reutilizar em mobile (todas empilhadas)
  // e desktop (apenas a seção ativa renderizada no painel direito).

  const sectionHealth = (
    <ProfileSectionRedesign title="Saúde & Histórico">
      <ProfileLinkRedesign icon="📊" label="Minha Saúde"          onClick={() => onNavigate('health-history')} />
      <ProfileLinkRedesign icon="🆘" label="Cartão de Emergência" onClick={() => onNavigate('emergency')} />
      <ProfileLinkRedesign icon="👨‍⚕️" label="Modo Consulta Médica" onClick={() => onNavigate('consultation')} />
    </ProfileSectionRedesign>
  )

  const sectionReports = (
    <ProfileSectionRedesign title="Relatórios & Dados">
      <ProfileLinkRedesign icon="📄" label="Relatório PDF"  onClick={() => setIsReportModalOpen(true)} />
      <ProfileLinkRedesign icon="📤" label="Exportar Dados" onClick={() => setIsExportDialogOpen(true)} />
    </ProfileSectionRedesign>
  )

  const sectionSettings = (
    <ProfileSectionRedesign title="Configurações">
      {/* Telegram */}
      <div className="pr-telegram">
        <div className="pr-telegram__row">
          <span className="pr-telegram__icon-wrap" aria-hidden="true">🤖</span>
          <span className="pr-telegram__label">Telegram</span>
          <span className={`pr-telegram__badge pr-telegram__badge--${isTelegramConnected ? 'connected' : 'disconnected'}`}>
            {isTelegramConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
        {isTelegramConnected ? (
          <div className="pr-telegram__expand">
            <button className="pr-telegram__disconnect-btn" onClick={handleDisconnectTelegram} type="button">
              Desconectar
            </button>
          </div>
        ) : (
          <div className="pr-telegram__expand">
            {!telegramToken ? (
              <button className="pr-telegram__disconnect-btn" style={{ color: 'var(--color-primary)' }} onClick={generateTelegramToken} type="button">
                Gerar código de vínculo
              </button>
            ) : (
              <div>
                <p className="pr-telegram__code" style={{ margin: '0 0 4px' }}>
                  Envie ao bot: <code>/start {telegramToken}</code>
                </p>
                <a href={`https://t.me/meus_remedios_bot?start=${telegramToken}`} target="_blank" rel="noreferrer" className="pr-telegram__link">
                  Abrir no Telegram
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Densidade */}
      <div className="pr-density">
        <div className="pr-density__row">
          <span className="pr-density__icon-wrap" aria-hidden="true">📐</span>
          <span className="pr-density__label">Densidade</span>
          <select className="pr-density__select" value={complexityOverride} onChange={(e) => handleComplexityChange(e.target.value)} aria-label="Selecionar densidade da interface">
            <option value="auto">Automático</option>
            <option value="simple">Confortável</option>
            <option value="moderate">Normal</option>
            <option value="complex">Compacto</option>
          </select>
        </div>
      </div>

      {/* Alterar Senha */}
      <div className="pr-password">
        <div className="pr-password__row">
          <span className="pr-password__icon-wrap" aria-hidden="true">🔒</span>
          <span className="pr-password__label">Alterar Senha</span>
          <button className="pr-password__toggle" onClick={() => setShowPasswordForm(!showPasswordForm)} type="button">
            {showPasswordForm ? 'Cancelar' : 'Alterar'}
          </button>
        </div>
        {showPasswordForm && (
          <form className="pr-password__form" onSubmit={handleUpdatePassword}>
            <input type="password" placeholder="Nova senha (mín. 6 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-password__input" autoComplete="new-password" />
            <Button type="submit" disabled={!newPassword}>Salvar</Button>
          </form>
        )}
      </div>

      {/* Admin DLQ */}
      {user?.user_metadata?.role === 'admin' && (
        <ProfileLinkRedesign icon="🛠️" label="Admin DLQ" onClick={() => onNavigate('admin-dlq')} />
      )}
    </ProfileSectionRedesign>
  )

  // Mapa sectionId → bloco JSX (usado no painel direito desktop)
  const sectionContent = { health: sectionHealth, reports: sectionReports, settings: sectionSettings }

  return (
    <div className="pr-view">

      {/* Feedback — sempre visível acima do layout */}
      {message && <div className="pr-message pr-message--success">{message}</div>}
      {error   && <div className="pr-message pr-message--error">{error}</div>}

      <div className="pr-layout">

        {/* ── COLUNA ESQUERDA (painel de navegação — desktop) / HEADER COMPACTO ── */}
        <aside className="pr-panel">

          {/* Avatar + nome no painel */}
          <div className="pr-panel__header">
            <div className="pr-panel__avatar" aria-hidden="true">{initials}</div>
            <div className="pr-panel__info">
              <span className="pr-panel__name">{user?.user_metadata?.name || 'Paciente'}</span>
              {user?.email && <span className="pr-panel__email">{user.email}</span>}
            </div>
          </div>

          {/* Nav de categorias (clicável no desktop; no mobile, rola a página) */}
          <nav className="pr-panel__nav" aria-label="Seções do perfil">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`pr-panel-nav__item${activeSection === s.id ? ' pr-panel-nav__item--active' : ''}`}
                onClick={() => setActiveSection(s.id)}
                aria-current={activeSection === s.id ? 'page' : undefined}
              >
                <span className="pr-panel-nav__icon" aria-hidden="true">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          {/* Logout — rodapé do painel esquerdo (desktop) */}
          <div className="pr-panel__logout">
            <button className="pr-panel__logout-btn" onClick={handleLogout} type="button">
              <LogOut size={16} aria-hidden="true" />
              Sair da Conta
            </button>
          </div>
        </aside>

        {/* ── COLUNA DIREITA (conteúdo) ── */}
        <div className="pr-content">

          {/*
            Mobile: avatar standalone aparece acima das seções.
            Desktop: avatar já está no painel esquerdo — classe mobile-only esconde este bloco.
          */}
          <div className="pr-header pr-header--mobile-only">
            <div className="pr-header__avatar" aria-hidden="true">{initials}</div>
            <div className="pr-header__info">
              <h2 className="pr-header__name">{user?.user_metadata?.name || 'Paciente'}</h2>
              {user?.email && <span className="pr-header__email">{user.email}</span>}
            </div>
          </div>

          {/*
            Desktop: renderiza apenas a seção ativa (activeSection).
            Mobile: renderiza todas as seções empilhadas.

            Estratégia: usamos CSS para controlar a visibilidade, não lógica JS,
            para evitar desmontagem/remontagem de componentes com estado interno
            (ex: showPasswordForm).

            Cada seção tem data-section="[id]" e o CSS esconde as inativas no desktop.
          */}
          <div data-section="health"   className="pr-section-slot" data-active={activeSection === 'health'   ? 'true' : undefined}>{sectionHealth}</div>
          <div data-section="reports"  className="pr-section-slot" data-active={activeSection === 'reports'  ? 'true' : undefined}>{sectionReports}</div>
          <div data-section="settings" className="pr-section-slot" data-active={activeSection === 'settings' ? 'true' : undefined}>{sectionSettings}</div>

          {/* Logout — mobile only (no desktop está no painel esquerdo) */}
          <div className="pr-logout pr-logout--mobile-only">
            <button className="pr-logout__btn" onClick={handleLogout} type="button">
              Sair da Conta
            </button>
          </div>
        </div>

      </div>

      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} />
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)}>
        <ReportGenerator onClose={() => setIsReportModalOpen(false)} />
      </Modal>
    </div>
  )
}
```

### CSS adicional para `.pr-section-slot` (adicionar ao final de ProfileRedesign.css)

```css
/* ── Section slot: desktop mostra apenas a seção ativa ───── */

/* Mobile: todos os slots visíveis, empilhados */
.pr-section-slot {
  display: block;
}

/* Desktop: esconde slots inativos */
@media (min-width: 768px) {
  .pr-section-slot {
    display: none;
  }
  .pr-section-slot[data-active="true"] {
    display: block;
  }
}
```

> **Por que CSS em vez de renderização condicional JS?**
> Se usarmos `{activeSection === 'settings' && sectionSettings}`, ao alternar de seção o componente seria
> desmontado e remontado — perdendo estados como `showPasswordForm`. Com CSS visibility via `data-active`,
> os componentes permanecem montados e os estados são preservados.
> No mobile todos os slots são visíveis independente de `activeSection`.

### Checklist S9.2

- [ ] Todos os handlers são idênticos em comportamento ao `Profile.jsx` original
- [ ] `activeSection` state inicia em `'health'`
- [ ] `SECTIONS` array definido como constante fora do componente (evita recriação)
- [ ] Layout desktop: `.pr-layout` com `grid-template-columns: 240px 1fr` via media query no CSS
- [ ] Painel esquerdo: avatar compacto + 3 nav items + logout com `LogOut` icon Lucide
- [ ] Nav item ativo: classe `pr-panel-nav__item--active` + `aria-current="page"`
- [ ] Painel direito: `data-section` + `data-active` slots controlados por CSS (não JS condicional)
- [ ] Mobile: `.pr-header--mobile-only` visível, painel esquerdo renderiza como card com avatar
- [ ] Desktop: `.pr-header--mobile-only` escondido via CSS, logout `.pr-logout--mobile-only` escondido
- [ ] Avatar mostra initials multi-letras — ex: "Dona Maria" → "DM"
- [ ] Seções usam `ProfileSectionRedesign` (tonal surface, sem glass)
- [ ] Links usam `ProfileLinkRedesign` (chevron Lucide, container icon)
- [ ] Mensagens de feedback acima do layout (sempre visíveis)
- [ ] NÃO há nenhuma referência a `--neon-*`, `--glow-*`, `glass-*`
- [ ] NÃO há nenhum `color: #` (hex inline) — sempre `var(--color-*)`

---

## Sprint 9.3 — HealthHistoryRedesign

**Arquivo:** `src/views/redesign/HealthHistoryRedesign.jsx`
**Arquivo CSS:** `src/views/redesign/HealthHistoryRedesign.css`

### Objetivo

`HealthHistory.jsx` é um componente complexo (250+ linhas com Virtuoso, AdherenceHeatmap, SparklineAdesao, Calendar). Reescrever completamente seria alto risco sem ganho proporcional.

**Estratégia:** criar um wrapper que:
1. Importa e renderiza `HealthHistory` original
2. Aplica override de CSS scoped em `.hhr-wrapper` para substituir variáveis neon pelas variáveis novas

Isso garante que toda a lógica de dados, Virtuoso, lazy loading e Calendar permaneça inalterada.

### Regras críticas

- **NÃO reimplementar a lógica de HealthHistory** — apenas wrappear
- O override CSS usa especificidade de classe (`.hhr-wrapper .calendar-*`) para sobrepor o CSS original sem removê-lo
- Manter `key="health-history"` ao renderizar (necessário para resetar estado ao navegar)

### HealthHistoryRedesign.css

```css
/* ============================================================
   HealthHistoryRedesign.css — Wave 9
   Override de tokens neon/glass → Santuário nos componentes
   internos de HealthHistory.
   Escopo: .hhr-wrapper (wrapper container)
   ============================================================ */

.hhr-wrapper {
  /* Substitui background neon pelo surface tonal */
  --color-primary: var(--color-primary); /* já definido em tokens.redesign.css */
  background: transparent;
}

/* ── Calendar heat map colors ─────────────────────────────── */

/* Dias com doses tomadas (status "full") */
.hhr-wrapper .calendar-day--full,
.hhr-wrapper .calendar-day--taken {
  background: var(--color-primary) !important;
  color: var(--color-on-primary) !important;
  /* Remove qualquer box-shadow/glow neon */
  box-shadow: none !important;
}

/* Dias com doses parciais */
.hhr-wrapper .calendar-day--partial {
  background: var(--color-secondary-fixed) !important;
  color: var(--color-on-surface) !important;
  box-shadow: none !important;
}

/* Dias sem doses */
.hhr-wrapper .calendar-day--missed,
.hhr-wrapper .calendar-day--empty {
  background: var(--color-error-bg, #ffdad6) !important;
  color: var(--color-error) !important;
  box-shadow: none !important;
}

/* Dia selecionado */
.hhr-wrapper .calendar-day--selected {
  outline: 2px solid var(--color-primary) !important;
  outline-offset: 2px !important;
  box-shadow: none !important;
}

/* Hoje */
.hhr-wrapper .calendar-day--today {
  border: 2px solid var(--color-primary) !important;
  box-shadow: none !important;
}

/* ── AdherenceHeatmap colors ──────────────────────────────── */

.hhr-wrapper .heatmap-cell--high {
  background: var(--color-primary) !important;
  box-shadow: none !important;
}

.hhr-wrapper .heatmap-cell--medium {
  background: var(--color-primary-fixed) !important;
  box-shadow: none !important;
}

.hhr-wrapper .heatmap-cell--low {
  background: var(--color-warning, #f59e0b) !important;
  box-shadow: none !important;
}

.hhr-wrapper .heatmap-cell--none {
  background: var(--color-surface-container-high) !important;
}

/* ── SparklineAdesao ──────────────────────────────────────── */

/* Recharts svg paths — sobrepõe a cor da linha */
.hhr-wrapper .recharts-line-curve {
  stroke: var(--color-primary) !important;
  filter: none !important; /* remove neon glow filter */
}

.hhr-wrapper .recharts-area-area {
  fill: var(--color-primary) !important;
  opacity: 0.1 !important;
  filter: none !important;
}

.hhr-wrapper .recharts-dot {
  fill: var(--color-primary) !important;
  stroke: var(--color-surface-container-lowest) !important;
  filter: none !important;
}

/* ── Stats card row ───────────────────────────────────────── */

.hhr-wrapper .health-history__stat-card,
.hhr-wrapper .stat-card {
  background: var(--color-surface-container-lowest) !important;
  border: none !important;
  box-shadow: var(--shadow-ambient) !important;
  border-radius: 1.25rem !important;
  /* Remove glass */
  backdrop-filter: none !important;
}

.hhr-wrapper .health-history__stat-value,
.hhr-wrapper .stat-value {
  color: var(--color-primary) !important;
  font-family: var(--font-display) !important;
  font-weight: 700 !important;
  /* Remove neon glow em texto */
  text-shadow: none !important;
  filter: none !important;
}

/* ── Log entries ─────────────────────────────────────────── */

.hhr-wrapper .log-entry,
.hhr-wrapper .health-history__log-item {
  background: var(--color-surface-container-lowest) !important;
  border: none !important;
  border-bottom: 1px solid var(--color-outline-ghost, rgba(25,28,29,0.08)) !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

/* ── Page header ─────────────────────────────────────────── */

.hhr-wrapper .health-history__header,
.hhr-wrapper .page-header {
  background: transparent !important;
  backdrop-filter: none !important;
  border: none !important;
}
```

### HealthHistoryRedesign.jsx

```jsx
// src/views/redesign/HealthHistoryRedesign.jsx
import HealthHistory from '../HealthHistory'
import './HealthHistoryRedesign.css'

/**
 * Wrapper redesenhado para HealthHistory.
 *
 * Estratégia: envolve o HealthHistory original em .hhr-wrapper,
 * que aplica overrides CSS substituindo tokens neon/glass pelo
 * design system Santuário. Nenhuma lógica de dados é alterada.
 *
 * @param {Object} props - Mesmos props de HealthHistory
 * @param {Function} props.onNavigate - Callback de navegação
 */
export default function HealthHistoryRedesign({ onNavigate }) {
  return (
    <div className="hhr-wrapper">
      <HealthHistory onNavigate={onNavigate} />
    </div>
  )
}
```

### Checklist S9.3

- [ ] `HealthHistoryRedesign.jsx` tem menos de 20 linhas — apenas wrapper + CSS import
- [ ] `.hhr-wrapper` não interfere no layout (display block, sem padding/margin próprio)
- [ ] Cores do calendário usam tokens `--color-primary`, `--color-error`, `--color-warning` (sem hex inline)
- [ ] `backdrop-filter` e `box-shadow` neon removidos via override
- [ ] SparklineAdesao tem `filter: none` para remover `drop-shadow` neon
- [ ] A view original `HealthHistory.jsx` NÃO foi modificada

---

## Sprint 9.4 — EmergencyRedesign

**Arquivo:** `src/views/redesign/EmergencyRedesign.jsx`
**Arquivo CSS:** `src/views/redesign/EmergencyRedesign.css`

### Objetivo

Mesma estratégia de wrapper do S9.3. `Emergency.jsx` é funcional e correto — apenas sua paleta visual usa variáveis neon. O wrapper aplica overrides CSS.

### EmergencyRedesign.css

```css
/* ============================================================
   EmergencyRedesign.css — Wave 9
   Override de tokens neon/glass → Santuário na view Emergency.
   Escopo: .er-wrapper
   ============================================================ */

.er-wrapper {
  background: transparent;
}

/* ── Emergency card container ────────────────────────────── */

.er-wrapper .emergency-card,
.er-wrapper .emergency-card-view,
.er-wrapper .emergency-view {
  background: var(--color-surface-container-lowest) !important;
  border: none !important;
  box-shadow: var(--shadow-ambient) !important;
  border-radius: 2rem !important;
  backdrop-filter: none !important;
}

/* ── Cabeçalho do cartão de emergência ───────────────────── */

.er-wrapper .emergency-card__header,
.er-wrapper .emergency-header {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-container)) !important;
  /* Remove neon glow do header */
  box-shadow: none !important;
  filter: none !important;
}

.er-wrapper .emergency-card__title,
.er-wrapper .emergency-title {
  color: var(--color-on-primary) !important;
  font-family: var(--font-display) !important;
  font-weight: 700 !important;
  text-shadow: none !important;
}

/* ── Campos de informação ─────────────────────────────────── */

.er-wrapper .emergency-card__field,
.er-wrapper .emergency-field {
  background: var(--color-surface-container-low) !important;
  border: none !important;
  border-radius: 0.75rem !important;
  box-shadow: none !important;
}

.er-wrapper .emergency-card__field-label,
.er-wrapper .emergency-field-label {
  color: var(--color-on-surface) !important;
  opacity: 0.5 !important;
  font-family: var(--font-body) !important;
  font-weight: 500 !important;
  font-size: 0.75rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.06em !important;
}

.er-wrapper .emergency-card__field-value,
.er-wrapper .emergency-field-value {
  color: var(--color-on-surface) !important;
  font-family: var(--font-body) !important;
  font-weight: 400 !important;
  /* Remove neon text effects */
  text-shadow: none !important;
  filter: none !important;
}

/* ── Alerta crítico (tag roja) ────────────────────────────── */

.er-wrapper .emergency-alert,
.er-wrapper .emergency-critical-tag {
  background: var(--color-error-bg, #ffdad6) !important;
  color: var(--color-error) !important;
  border: none !important;
  box-shadow: none !important;
  filter: none !important;
  border-radius: 99px !important;
}

/* ── Form de edição ───────────────────────────────────────── */

.er-wrapper .emergency-form input,
.er-wrapper .emergency-form textarea,
.er-wrapper .emergency-card-form input,
.er-wrapper .emergency-card-form textarea {
  background: var(--color-surface-container-low) !important;
  border: 1px solid var(--color-outline-ghost, rgba(25,28,29,0.15)) !important;
  border-radius: 0.75rem !important;
  color: var(--color-on-surface) !important;
  font-family: var(--font-body) !important;
  box-shadow: none !important;
}

.er-wrapper .emergency-form input:focus,
.er-wrapper .emergency-card-form input:focus,
.er-wrapper .emergency-form textarea:focus,
.er-wrapper .emergency-card-form textarea:focus {
  border-color: var(--color-primary) !important;
  box-shadow: 0 0 0 3px rgba(0, 106, 94, 0.12) !important;
  outline: none !important;
}

/* ── Botão de editar / salvar ─────────────────────────────── */

.er-wrapper .emergency-edit-btn {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-container)) !important;
  color: var(--color-on-primary) !important;
  border: none !important;
  border-radius: 1.25rem !important;
  box-shadow: 0 8px 24px rgba(0, 106, 94, 0.20) !important;
  /* Remove neon glow */
  filter: none !important;
}
```

### EmergencyRedesign.jsx

```jsx
// src/views/redesign/EmergencyRedesign.jsx
import Emergency from '../Emergency'
import './EmergencyRedesign.css'

/**
 * Wrapper redesenhado para Emergency.
 *
 * Envolve a view original em .er-wrapper para aplicar
 * overrides CSS do design system Santuário.
 * Toda a lógica offline/localStorage permanece inalterada.
 *
 * @param {Object} props - Mesmos props de Emergency
 * @param {Function} props.onNavigate - Callback de navegação
 */
export default function EmergencyRedesign({ onNavigate }) {
  return (
    <div className="er-wrapper">
      <Emergency onNavigate={onNavigate} />
    </div>
  )
}
```

### Checklist S9.4

- [ ] `EmergencyRedesign.jsx` tem menos de 20 linhas — apenas wrapper
- [ ] Header do cartão usa `gradient primary → primary-container` (não rosa→cyan)
- [ ] Campos usam `surface-container-low` como background (não glass)
- [ ] Alerta crítico usa `color-error-bg` + `color-error` (não neon vermelho com glow)
- [ ] `text-shadow` e `filter: drop-shadow` neon removidos via override
- [ ] `Emergency.jsx` original NÃO foi modificado

---

## Sprint 9.5 — App.jsx Integration

**Arquivo:** `src/App.jsx`

### Objetivo

Adicionar lazy imports para as 3 novas views redesenhadas e adicionar branching `isRedesignEnabled` nos casos `profile`, `health-history`, `history` e `emergency` do switch de renderização.

### Mudanças exatas em App.jsx

#### 1. Adicionar imports (junto com os imports redesign existentes, linhas 24–26)

```jsx
// Adicionar APÓS as linhas existentes de redesign imports (linha 26 atual):
const ProfileRedesign = lazy(() => import('./views/redesign/ProfileRedesign'))
const HealthHistoryRedesign = lazy(() => import('./views/redesign/HealthHistoryRedesign'))
const EmergencyRedesign = lazy(() => import('./views/redesign/EmergencyRedesign'))
```

**Localização exata:** logo após a linha `const StockRedesign = lazy(() => import('./views/redesign/StockRedesign'))`.

#### 2. Atualizar case 'profile'

**Localizar:**
```jsx
case 'profile':
  return (
    <Suspense fallback={<ViewSkeleton />}>
      <Profile onNavigate={setCurrentView} />
    </Suspense>
  )
```

**Substituir por:**
```jsx
case 'profile':
  return (
    <Suspense fallback={<ViewSkeleton />}>
      {isRedesignEnabled
        ? <ProfileRedesign onNavigate={setCurrentView} />
        : <Profile onNavigate={setCurrentView} />
      }
    </Suspense>
  )
```

#### 3. Atualizar case 'health-history'

**Localizar:**
```jsx
case 'health-history':
  return (
    <Suspense fallback={<ViewSkeleton />}>
      <HealthHistory key="health-history" onNavigate={setCurrentView} />
    </Suspense>
  )
```

**Substituir por:**
```jsx
case 'health-history':
  return (
    <Suspense fallback={<ViewSkeleton />}>
      {isRedesignEnabled
        ? <HealthHistoryRedesign key="health-history" onNavigate={setCurrentView} />
        : <HealthHistory key="health-history" onNavigate={setCurrentView} />
      }
    </Suspense>
  )
```

#### 4. Atualizar case 'history' (alias de health-history)

**Localizar:**
```jsx
case 'history':
  // W3-06: historico agora vive em HealthHistory
  return (
    <Suspense fallback={<ViewSkeleton />}>
      <HealthHistory key="history" onNavigate={setCurrentView} />
    </Suspense>
  )
```

**Substituir por:**
```jsx
case 'history':
  // W3-06: historico agora vive em HealthHistory
  return (
    <Suspense fallback={<ViewSkeleton />}>
      {isRedesignEnabled
        ? <HealthHistoryRedesign key="history" onNavigate={setCurrentView} />
        : <HealthHistory key="history" onNavigate={setCurrentView} />
      }
    </Suspense>
  )
```

#### 5. Atualizar case 'emergency'

**Localizar:**
```jsx
case 'emergency':
  return (
    <Suspense fallback={<ViewSkeleton />}>
      <Emergency onNavigate={setCurrentView} />
    </Suspense>
  )
```

**Substituir por:**
```jsx
case 'emergency':
  return (
    <Suspense fallback={<ViewSkeleton />}>
      {isRedesignEnabled
        ? <EmergencyRedesign onNavigate={setCurrentView} />
        : <Emergency onNavigate={setCurrentView} />
      }
    </Suspense>
  )
```

### Checklist S9.5

- [ ] 3 novos `lazy()` imports adicionados (ProfileRedesign, HealthHistoryRedesign, EmergencyRedesign)
- [ ] Branching `isRedesignEnabled` aplicado nos 4 casos (profile, health-history, history, emergency)
- [ ] `key="health-history"` e `key="history"` preservados na variante redesenhada
- [ ] Imports originais (`Profile`, `HealthHistory`, `Emergency`) NÃO removidos
- [ ] Nenhuma outra linha de `App.jsx` foi alterada

---

## Critério de Conclusão Wave 9

### Visual

- [ ] **Profile:** layout flat utility — sem `backdrop-filter`, sem `glass-bg`, sem `1px border` estrutural
- [ ] **Profile:** avatar com initials multi-letras (não só inicial) em gradiente verde
- [ ] **Profile:** seções separadas por espaçamento + label uppercase (não por card individual)
- [ ] **Profile:** `ProfileLink` com container circular `secondary-fixed` + chevron `ChevronRight` Lucide
- [ ] **Profile:** "Sair da Conta" com borda `color-error`, fundo transparente, hover `error-bg`
- [ ] **HealthHistory:** calendário com cores redesign (verde/amarelo/vermelho novos)
- [ ] **HealthHistory:** sparklines sem `filter: drop-shadow` neon
- [ ] **Emergency:** header com gradiente `primary → primary-container`
- [ ] **Emergency:** campos com `surface-container-low`, sem glass

### Técnico

- [ ] NÃO há nenhuma string `#ec4899`, `#06b6d4`, `neon`, `glow`, `glass-bg`, `glass-blur`, `backdrop-filter` nos arquivos desta wave
- [ ] NÃO há nenhuma cor hex inline nos JSX — sempre `var(--color-*)`
- [ ] Todas as 3 views são lazy-loaded com `Suspense` + `ViewSkeleton`
- [ ] `src/App.jsx` tem exatamente 3 novas linhas de `lazy()` import
- [ ] Nenhum import circular introduzido
- [ ] Views originais (`Profile.jsx`, `HealthHistory.jsx`, `Emergency.jsx`) inalteradas (verificar com `git diff`)

### Validação com flag ativado (`?redesign=1`)

- [ ] Navegar para Perfil: layout flat, avatar com initials verdes, seções sem glass
- [ ] Clicar em "Minha Saúde": HealthHistory com calendário verde/sem neon
- [ ] Clicar em "Cartão de Emergência": Emergency com header verde
- [ ] Desativar flag (`?redesign=0`): views originais aparecem sem alteração
- [ ] Trocar densidade em Perfil: `localStorage.mr_complexity_override` é atualizado corretamente

---

## Ordem de Execução Recomendada

```
S9.1 → S9.2 → S9.3 → S9.4 → S9.5
```

As sprints são sequenciais porque `ProfileRedesign.jsx` (S9.2) depende dos sub-componentes criados em S9.1. As sprints S9.3 e S9.4 são independentes entre si — podem ser executadas em paralelo se o agente suportar.

---

## Armadilhas Conhecidas (Anti-patterns)

### AP-W9-01: CSS specificity insuficiente nos wrappers

**Problema:** Os overrides de `.hhr-wrapper .calendar-day--full` podem não ter especificidade suficiente para sobrepor o CSS original se este usar `!important`.

**Solução:** Verificar o CSS de `HealthHistory.css` e `Emergency.css` antes de escrever os overrides. Se o seletor original já usa `!important`, o override também deve usar `!important`.

### AP-W9-02: Recharts SVG não responde a CSS class overrides

**Problema:** Recharts renderiza SVG com estilos inline em alguns casos — class overrides não funcionam.

**Solução:** Se `.recharts-line-curve { stroke: var(--color-primary) !important }` não funcionar após inspeção, verificar se o componente SparklineAdesao passa `stroke` como prop. Se sim, criar `SparklineAdesaoRedesign.jsx` que passa as props de cor corretas. **NÃO refatorar `SparklineAdesao.jsx` original.**

### AP-W9-03: initials de nome com caracteres especiais

**Problema:** `"Ângela M. Souza".split(' ')` → `["Ângela", "M.", "Souza"]`. O slice `.slice(0,2)` geraria "ÂM" ao invés de "ÂS".

**Solução:** O algoritmo atual (slice 0,2 das palavras) é suficiente para a maioria dos casos brasileiros. Se o usuário não tem nome cadastrado, o fallback é `(email || 'P')[0]`. Não sobre-engenheirar.

### AP-W9-04: `ProfileSectionRedesign` sem glassmorphism quebra legibilidade

**Problema:** Remover o glass pode tornar as seções indistinguíveis no mobile se o background da view for similar ao `surface-container-lowest` dos cards.

**Solução:** Garantir que `.pr-view` tenha `background: var(--color-surface)` (#f8fafb) e `.pr-section__content` tenha `background: var(--color-surface-container-lowest)` (#ffffff). O contraste off-white→branco cria separação visual suficiente sem bordas ou glass.

---

## Referências

| Arquivo | Propósito |
|---------|-----------|
| `plans/redesign/PRODUCT_STRATEGY_CONSOLIDATED.md` | Dichotomous design philosophy, Perfil = "flat utility layout" |
| `plans/redesign/EXEC_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md` | Seção 14 (Wave 9), Gap Analysis seção 2.3 |
| `src/views/Profile.jsx` | Lógica original a ser replicada em ProfileRedesign.jsx |
| `src/views/profile/Profile.css` | CSS original (para identificar classes a sobrepor) |
| `src/views/HealthHistory.jsx` | View original wrappada por HealthHistoryRedesign |
| `src/views/Emergency.jsx` | View original wrappada por EmergencyRedesign |
| `src/shared/styles/tokens.redesign.css` | CSS vars disponíveis (`--color-primary`, `--color-surface-*`, etc.) |
| `src/shared/hooks/useRedesign.js` | Hook `isRedesignEnabled` para branching em App.jsx |
| `src/views/redesign/StockRedesign.jsx` | Padrão de view redesenhada (referência de estrutura) |
| `plans/redesign/WAVE_8_STOCK_REDESIGN.md` | Padrão de spec desta wave |
