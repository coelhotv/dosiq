# Exec Spec Fase 3: App Web, SEO & PWA
> **Objetivo:** Posicionar com excelência o SEO, as meta tags, Web App Manifests, links e textos UI do Front-End da Aplicação, garantindo a alteração visual para "Dosiq".

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
