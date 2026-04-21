# Exec Spec Hibrido - Addendum: Design Tokens Compartilhados

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Consumido por:** Fase 2 e Fase 5
> **Objetivo:** definir como tokens visuais do Sanctuary Design System viajam entre web (CSS custom properties) e native (StyleSheet objects) via camada agnostica intermediaria

---

## 1. Papel deste addendum

O redesign v4.0.0 ("Santuario Terapeutico") introduziu um design system completo com:

- tokens de cor (`--sanctuary-*`, `--surface-*`, `--text-*`)
- tokens de spacing (`--space-*`)
- tokens de radii (`--radius-*`)
- tokens de tipografia (`--font-*`, `--text-*`)
- motion language (`motionConstants.js` — 6 arquetipos de animacao)

Esses tokens hoje vivem em CSS custom properties na web. Para o mobile native, precisam existir em formato JS/JSON consumivel por `StyleSheet`.

Este addendum define:

- o que e compartilhavel como token agnostico
- o que permanece em cada plataforma
- o formato canonico do pacote `packages/design-tokens`
- como cada plataforma consome os tokens

---

## 2. Decisoes congeladas

### DT-001. Tokens agnosticos vivem em JS/JSON puro

O pacote `packages/design-tokens` exporta objetos JavaScript puros.

Exemplo:

```js
export const colors = {
  sanctuary: {
    surface: { primary: '#FFFFFF', secondary: '#F8F9FA', ... },
    text: { primary: '#1A1A2E', secondary: '#4A4A68', ... },
    accent: { primary: '#6C5CE7', ... },
    status: { success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6' },
  },
}
```

### DT-002. CSS custom properties NAO entram no pacote compartilhado

O pacote nao exporta:

- strings com `var(--xxx)`
- arquivos `.css`
- funcoes que geram CSS

A conversao de tokens JS para CSS custom properties e responsabilidade da web.

### DT-003. StyleSheet NAO entra no pacote compartilhado

O pacote nao exporta:

- `StyleSheet.create()`
- objetos pre-formatados para React Native

A conversao de tokens JS para `StyleSheet` e responsabilidade do mobile.

### DT-004. Motion language e PLATFORM_WEB exclusivo

`motionConstants.js` (framer-motion) **nao** e compartilhavel.

O mobile native deve definir sua propria motion language usando:

- `react-native-reanimated` (pos-MVP)
- `Animated` API nativa
- ou animacoes CSS-like via `LayoutAnimation`

No MVP (Fase 5), o mobile usa animacoes minimas ou nenhuma — nao ha obrigacao de paridade visual de motion com a web.

### DT-005. Fonte da verdade e a web (Sanctuary)

Os tokens Sanctuary definidos em `src/shared/styles/` sao a fonte da verdade.

O pacote `packages/design-tokens` e derivado deles, nao o contrario.

Se um token mudar na web, a mudanca deve propagar para o pacote agnostico.

---

## 3. Estrutura obrigatoria de `packages/design-tokens`

```text
packages/design-tokens/
├── package.json
├── src/
│   ├── index.js
│   ├── colors.js
│   ├── spacing.js
│   ├── radii.js
│   ├── typography.js
│   └── stockLevels.js
└── README.md
```

### `package.json`

```json
{
  "name": "@dosiq/design-tokens",
  "private": true,
  "version": "0.0.0-phase2",
  "type": "module",
  "exports": {
    ".": "./src/index.js",
    "./colors": "./src/colors.js",
    "./spacing": "./src/spacing.js",
    "./radii": "./src/radii.js",
    "./typography": "./src/typography.js"
  }
}
```

### Proibicoes

- nenhuma dependencia de runtime (zero deps)
- nenhum import de `react`, `react-dom`, `react-native`
- nenhum acesso a `window`, `document`, `process`

---

## 4. Consumo por plataforma

### 4.1. Web

A web ja tem CSS custom properties do Sanctuary. Dois caminhos validos:

**Caminho A (recomendado no curto prazo):** Web continua usando CSS custom properties diretamente. O pacote `packages/design-tokens` serve apenas como fonte para o mobile.

**Caminho B (futuro, pos-Fase 7):** Web passa a gerar CSS custom properties a partir dos tokens JS. Isso garante single source of truth operacional. So fazer se houver ADR aprovando.

### 4.2. Mobile

O mobile importa tokens JS e usa em `StyleSheet`:

```js
import { colors } from '@dosiq/design-tokens/colors'
import { spacing } from '@dosiq/design-tokens/spacing'
import { StyleSheet } from 'react-native'

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.sanctuary.surface.primary,
    padding: spacing.md,
  },
})
```

---

## 5. Regra de sincronizacao

Se um token de cor, spacing ou radii mudar na web:

1. o maintainer (ou agente) deve atualizar o valor correspondente em `packages/design-tokens`
2. o mobile recebe a mudanca automaticamente via workspace

Se o mobile precisar de um token que nao existe na web:

1. criar o token em `packages/design-tokens` com prefixo `mobile_*` ou semantica propria
2. documentar no README que e mobile-only

---

## 6. O que nao faz parte deste addendum

- motion language native (sera definido pos-MVP se necessario)
- theming dinamico (dark mode) — adiado para pos-MVP
- tokens de componente (ex: altura de botao) — ficam em cada plataforma
- iconografia — cada plataforma tem seus proprios assets

---

## 7. Ownership por fase

### Fase 2 deve sair com

- `packages/design-tokens` criado com tokens extraidos do Sanctuary
- web continuando a usar CSS custom properties (sem mudanca)
- testes basicos validando que tokens exportam valores corretos

### Fase 5 deve sair com

- mobile consumindo tokens do pacote compartilhado
- StyleSheet do MVP usando cores e spacing do Sanctuary

---

## 8. Ancoragem e validacao contra a master spec

- Este addendum respeita P-001 (UIs separadas por plataforma)
- Este addendum respeita P-002 (shared core puro — tokens JS sao puros)
- Este addendum nao introduz dependencia de `react-native` no compartilhado
- Este addendum nao substitui CSS custom properties da web
