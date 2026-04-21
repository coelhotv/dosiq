# EXEC SPEC FASE 3: Web App, SEO & PWA

> **Branch:** `refactor/dosiq-migration-fase-3`
> **Pré-requisito:** Fase 1 merged e `main` atualizado
> **Duração estimada:** 30–45 min
> **Impacto:** SEO, identidade PWA, copy de UI e links públicos do app web
> **Status:** CONCLUÍDA ✅ — PR #485 merged em 2026-04-21

---

## 0. Bootstrap Obrigatório

```bash
git checkout main && git pull
git checkout -b refactor/dosiq-migration-fase-3
npm run lint    # Baseline limpo
```

---

## 1. Arquivos a Modificar

### 1.1 `apps/web/index.html` — SEO e Document Root

Alterações obrigatórias:
- `<title>Meus Remédios</title>` → `<title>Dosiq</title>`
- Adicionar (não existe ainda, mas boa prática de SEO):
  ```html
  <meta name="description" content="Dosiq - Organize sua rotina de medicamentos com simplicidade." />
  ```
- `<meta name="application-name" content="Dosiq" />` se não existir

### 1.2 `apps/web/public/politica-de-privacidade.html` — HTML Estático

Varredura completa e substituição:
```bash
grep -n "Meus Rem\|meusremedios\|meus-remedios" apps/web/public/politica-de-privacidade.html
# Corrigir todas as ocorrências encontradas
```
Texto típico a corrigir: título da página, cabeçalhos, rodapé, e-mail de contato se mencionar o nome do produto.

### 1.3 `apps/web/public/manifest.webmanifest` (ou similar)

> [!WARNING]
> Verificar se existe um arquivo `manifest.json` ou `manifest.webmanifest` em `apps/web/public/`. Se existir, é CRÍTICO atualizar os campos `name` e `short_name` para `"Dosiq"`, pois eles controlam o nome exibido ao instalar o PWA.

```bash
find apps/web/public/ -name "manifest*"
# Se encontrado, editar campos name e short_name
```

### 1.4 `apps/web/src/shared/components/pwa/pwaUtils.js` — PWA Utils

**Nota de auditoria:** Este arquivo contém lógica de detecção (não texto de branding), EXCETO por uma linha na função `getInstallInstructions()`:

```js
// Linha atual (dentro de return para Desktop Chrome):
steps: ['Clique em "Instalar" no prompt', 'Ou use o menu (⋮) > Instalar Meus Remédios'],
```

Corrigir para:
```js
steps: ['Clique em "Instalar" no prompt', 'Ou use o menu (⋮) > Instalar Dosiq'],
```

### 1.5 Views de UI — Varredura e Substituição de Copy

Os seguintes arquivos foram identificados pela auditoria como contendo referências de texto:

**Verificação e correção obrigatória:**
```bash
grep -rn "Meus Rem\|meus-remedios\|meusremedios" \
  --include="*.jsx" --include="*.js" \
  apps/web/src/
# Corrigir todas as ocorrências encontradas
```

**Arquivos com risco confirmado:**
| Arquivo | Tipo de referência |
|---|---|
| `apps/web/src/views/Landing.jsx` | Copy de Hero Section, subtítulos, CTA |
| `apps/web/src/views/Auth.jsx` | Tela de login/cadastro (ex: "Bem-vindo ao Meus Remédios") |
| `apps/web/src/shared/components/onboarding/WelcomeStep.jsx` | Onboarding inicial |
| `apps/web/src/shared/components/ui/Sidebar.jsx` | Nome do app na sidebar |
| `apps/web/src/views/redesign/Settings.jsx` | Identificado na auditoria |
| `apps/web/src/features/emergency/components/EmergencyQRCode.jsx` | Nome do produto no QR |

**Padrão de substituição:**
- `"Meus Remédios"` → `"Dosiq"`
- `"meus remédios"` → `"dosiq"` (lowercase quando em URLs ou slugs)
- `"app Meus Remédios"` → `"Dosiq"`

### 1.6 `apps/web/src/features/reports/services/pdfGeneratorService.js` — Relatório PDF

**Auditoria identificou:**
```js
// Linha atual:
title = 'Meus Remédios - Relatório',
// (também como parâmetro default e como texto no PDF gerado)
```

Corrigir para:
```js
title = 'Dosiq - Relatório',
```

### 1.7 `apps/web/src/features/chatbot/config/chatbotConfig.js`

**Auditoria identificou** o comentário de cabeçalho:
```js
/**
 * Configurações centralizadas do Chatbot IA — Meus Remédios.
```

Corrigir para:
```js
/**
 * Configurações centralizadas do Chatbot IA — Dosiq.
```

### 1.8 URLs de Produção Hardcodadas

Verificar e corrigir todas as URL `meus-remedios.vercel.app` no código web:
```bash
grep -rn "meus-remedios.vercel.app\|meus-remedios\.vercel" \
  --include="*.js" --include="*.jsx" --include="*.html" \
  apps/web/
# Corrigir todas para dosiq.vercel.app
```

---

## 2. O Que NÃO Alterar Nesta Fase

- ❌ Tokens de design (cores, espaçamentos, tipografia)
- ❌ Lógica de componentes (apenas text copy)
- ❌ Arquivos `dist/` (são artifacts de build, não de source)

---

## 3. Quality Gates

### Gate 1: Web Build
```bash
npm run build --workspace @dosiq/web   # Zero erros de compilação
# (o @dosiq/web já deve estar disponível após Fase 1)
```

### Gate 2: Varredura de Resíduos
```bash
grep -rn "Meus Rem\|meusremedios\|meus-remedios" \
  --include="*.jsx" --include="*.js" --include="*.html" \
  apps/web/src/ apps/web/public/ apps/web/index.html
# Resultado esperado: 0 linhas
```

### Gate Final da Fase
```bash
npm run lint
npm run test:changed
npm run validate:agent

git add -A
git commit -m "refactor(web): renomear copy e referencias de 'Meus Remedios' para 'Dosiq' no app web"
```

---

## 4. Critérios de Aceitação do PR

- [x] `<title>` do `index.html` é "Dosiq"
- [x] `politica-de-privacidade.html` sem referências ao nome legado
- [x] `manifest.webmanifest` (se existir): `name: "Dosiq"`, `short_name: "Dosiq"` (não aplicável no escopo atual; arquivo não encontrado)
- [x] `pwaUtils.js`: step de instalação corrigido
- [x] `Landing.jsx`, `Auth.jsx`, `WelcomeStep.jsx`, `Sidebar.jsx`, `Settings.jsx` sem texto legado
- [x] `pdfGeneratorService.js`: título do relatório corrigido
- [x] `chatbotConfig.js`: comentário de cabeçalho corrigido
- [x] Zero URLs `meus-remedios.vercel.app` hardcodadas
- [x] `npm run build` passando sem erros
- [x] `npm run validate:agent` passando


## 1. Escopo de Arquivos Modificados
- `apps/web/index.html`
- `apps/web/public/politica-de-privacidade.html`
- `apps/web/src/shared/components/pwa/pwaUtils.js`
- Core UI (Ex: `Landing.jsx`, `WelcomeStep.jsx`, `Auth.jsx`, `Sidebar.jsx`)

## 2. Tarefas de Execução

### 2.1. SEO e Meta Tags (index.html e afins)
- `<title>`: Modificar para "Dosiq - O seu organizador de medicamentos".
- `<meta name="description">`: Substituir a palavra "Meus Remédios".
- Fazer a mesma varredura no HTML estático `politica-de-privacidade.html`.

### 2.2. Web App Manifest e Utilities
- `apps/web/src/shared/components/pwa/pwaUtils.js` ou afins instanciam o `name` e `short_name`. Mudar todos para "Dosiq".
- Theme color de PWA pode continuar, pois o Design System original será mantido.

### 2.3. Text Copy & Componentes Genéricos
- Fazer um _Grep_ rigoroso nos copy texts: "Bem vindo ao Meus Remédios" $\\rightarrow$ "Bem vindo ao Dosiq".
- Componentes obrigatórios para revisão de hard-coding de texto: 
    - `Landing.jsx` (Atenção ao subtítulo da Hero Section).
    - `WelcomeStep.jsx` (Integração inicial).
    - `Sidebar.jsx` (Tipografia abaixo da logo se ela existir).

### 2.4. URLs Externas Públicas
- Trocar chamadas a `meus-remedios.vercel.app` para `dosiq.vercel.app`.

## 3. Validation Gate do Agente
- Rodar `npm run build` atrelado ao `apps/web` e garantir zero errors de bundle/compilation na substituição.
- Lint Check `npm run lint`.
