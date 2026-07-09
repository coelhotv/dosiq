---
title: "Configurações de Linting"
description: "Visão geral das regras personalizadas do ESLint (ordem de hooks R-010, restrição de timezone R-020) no Dosiq."
version: "1.0.0"
status: active
category: reference
audience:
  - dev
  - agent
tags:
  - eslint
  - linting
  - rules
created_at: "2026-07-08"
updated_at: "2026-07-08"
---

# Configurações de Linting e Padrões de Código (Dosiq)

Este documento centraliza e descreve de forma extensiva todas as regras de linting configuradas, as decisões de design associadas a cada uma e as diretrizes recomendadas para novos desenvolvedores que integrem o time do **Dosiq**.

O linter está configurado para garantir a **estabilidade, acessibilidade, compatibilidade de timezone e DX (Developer Experience)** tanto na aplicação Web quanto na Mobile.

---

## 1. Regra R-010: Ordem Canônica de Hooks (Hook Order)

A regra **R-010** exige que a estrutura interna de qualquer componente ou hook customizado seja organizada declarativamente de cima para baixo.

### A Ordem Canônica de Declaração
1.  **States / Refs / Contexts:** (`useState`, `useRef`, `useContext`, hooks customizados de dados).
2.  **Memos:** (`useMemo`).
3.  **Effects:** (`useEffect`, `useFocusEffect`, `useLayoutEffect`).
4.  **Handlers / Callbacks:** (`useCallback` ou funções normais de escopo).

### Validação via ESLint (`no-restricted-syntax`)
O linter valida isso por meio de seletores AST que geram erros caso a ordem seja violada:
*   *Erro:* Declarar `useState` após `useMemo`, `useCallback` ou `useEffect`.
*   *Erro:* Declarar `useMemo` após `useCallback` ou `useEffect`.

### Como Resolver a Zona de Morte Temporal (TDZ)
Se um `useEffect` no meio do arquivo precisa chamar uma função declarada no rodapé do arquivo, a execução normal dispararia um erro de TDZ. Para resolver isso:
1.  **Latest Ref Pattern:** Guarde a referência da função em um `useRef` declarado no bloco 1 e consuma a ref no `useEffect`.
    ```javascript
    const loadDataRef = useRef(null) // Bloco 1

    useEffect(() => {
      loadDataRef.current?.() // Bloco 3
    }, [])

    const loadData = useCallback(() => { ... }, []) // Bloco 4
    loadDataRef.current = loadData
    ```
2.  **Conversão para useMemo:** Se o callback for puramente estável (sem dependências dinâmicas), declare-o no Bloco 2 como `const callback = useMemo(() => () => { ... }, [])`.

---

## 2. Guardrails de Arquitetura e IA (Restrições de Sintaxe)

Utilizamos a regra `no-restricted-syntax` para impor restrições que evitam bugs graves de infraestrutura e acessibilidade:

### R-020: Timezone Safe Dates (Tolerância Zero a `new Date()`)
*   **Problema:** Criar datas locais usando `new Date()` ou `new Date('YYYY-MM-DD')` gera inconsistência no fuso horário do usuário (especialmente na transição de fuso horário do Brasil/GMT-3).
*   **Regra:** O uso de `new Date()` literal é **proibido**.
*   **Solução:** Sempre use a função `parseLocalDate()` importada de `@utils/dateUtils`.
*   **Restrição de Importação:** É proibido importar `dayjs` ou `moment` de forma direta em arquivos de produto. Centralize qualquer lógica de datas em `@utils/dateUtils`.

### R-204: Acessibilidade (Botões sobre Divs)
*   **Problema:** Associar eventos de clique diretamente a elementos `div` quebra o suporte a leitores de tela e navegação por teclado.
*   **Regra:** É proibido declarar `onClick` diretamente em tags `<div>`.
*   **Solução:** Utilize tags `<button>` ou o componente compartilhado `<Button>`.

### ADR-008: Cores Hardcoded Inline
*   **Problema:** Definir cores hexadecimais, rgb ou hsl inline dificulta a manutenção de temas.
*   **Regra:** É proibido usar strings literais de cores no atributo `style` (ex: `style={{ color: '#FFF' }}`).
*   **Solução:** Consuma exclusivamente as variáveis CSS semânticas do Design System (ex: `var(--color-primary)`).

---

## 3. Limites de Complexidade e Tamanho (Legibilidade)

Para manter as funções pequenas, legíveis e testáveis, limitamos a complexidade de bifurcações e tamanho do arquivo.

### Configuração Geral
*   **Tamanho Máximo:** `max-lines-per-function` avisa caso uma função exceda **100 linhas** (ignorando linhas em branco e comentários).
*   **Complexidade Ciclomática:** `complexity` avisa se a pontuação exceder **15** (caminhos lógicos e condicionais).

### Overrides por Domínio
O linter foi configurado com permissões estendidas baseadas no tipo de arquivo:
1.  **Componentes React (.tsx):** Limite de **150 linhas** e complexidade **20** (para tolerar estruturação de layouts complexos).
2.  **API Handlers (`api/**/*.ts`):** Limite de **150 linhas** e complexidade **20** (por conta de parses e validações JSON).
3.  **Hooks Customizados e Repositórios (`**/hooks/**/*.ts`, `packages/core/src/repositories/**/*.ts`):** Limite estendido para **250 linhas** e complexidade **25**.
4.  **Testes (`**/*.test.ts`, `**/*.test.tsx`):** Regras de complexidade e tamanho de função são **desativadas** por completo.

---

## 4. Restrições de Importação (Limites de Fronteira)

Evitamos o acoplamento indesejado no monorepo e o uso de pastas legadas desativadas.

### R-002: Uso Obrigatório de Path Aliases
*   É proibido importar arquivos usando caminhos relativos longos (ex: `import ... from '../../../../shared'`).
*   **Solução:** Sempre use aliases como `@shared`, `@features`, `@utils`, `@medications`, `@protocols`, `@stock`, `@adherence` e `@dosiq/core`.
*   *Nota:* Importações relativas são permitidas apenas dentro da mesma pasta (`allowSameFolder: true`).

### R-142 a R-177: Importações Proibidas (`no-restricted-imports`)
*   **Cross-boundary:** A aplicação Web **nunca** deve importar nada da pasta `server/` (onde vive a lógica do bot). Para lógica compartilhada, consuma a biblioteca `@packages/core`.
*   **Pastas Legadas (Wave 9):**
    *   Não importe de `src/lib/`. Use `@shared/utils/supabase` ou `@shared/utils/queryCache`.
    *   Não importe de `src/hooks/` ou `src/components/` globais legados. Use os diretórios canônicos `@shared/hooks/`, `@shared/components/` ou o alias da feature correspondente (ex: `@dashboard/hooks/`).
    *   Não importe constantes de pastas como `constants/` de features ou `@shared/constants`. Toda a validação e as constantes de tipos residem em **`@schemas/`** (ex: `@schemas/medicineSchema`).

---

## 5. Regras Específicas de Ambiente (Web, Mobile & Server)

### Web & Compartilhado
*   **Fast Refresh (`react-refresh/only-export-components`):** Garante a DX de reload instantâneo. Arquivos de componentes React devem exportar exclusivamente componentes. Utilitários puros e auxiliares devem residir em arquivos separados.
*   **Avisos de Console (`no-console`):** `console.log` é **proibido** em ambiente de produção (gera erro no lint). São permitidos apenas `console.warn`, `console.error` e `console.info` para manter o rastreamento limpo.

### Server & API (Node.js)
*   **Strict Node (`n/no-process-exit` e `n/no-path-concat`):** Proíbe saídas abruptas do processo Node e concatenações manuais de caminho para evitar inconsistências entre SOs.
*   **Console permitido:** A regra `no-console` é **desativada** para o diretório `server/` e `api/` para viabilizar logs de depuração do servidor.

### Mobile (React Native)
*   **Sem Cores Hardcoded (`react-native/no-color-literals`):** Toda e qualquer cor no StyleSheet mobile deve consumir tokens semânticos de estilização (ex: `tokens.colors`).
*   **Sem Estilos Inline (`react-native/no-inline-styles`):** Evita renderizações inline para otimizar a performance mobile. Toda estilização deve residir em objetos StyleSheet locais.
*   **Sem Texto Raw (`react-native/no-raw-text`):** Todo texto renderizado no celular deve estar estritamente envelopado por um componente `<Text>`.

---

## 6. Fluxo de Validação de Código

Sempre execute a suíte de validação antes de realizar commits ou submeter PRs:

```bash
# Executa o ESLint no repositório inteiro (garante zero erros)
npm run lint

# Executa testes unitários críticos
npm run test:critical

# Validação global (linting + testes + build rápido)
npm run validate:agent
```
