# Plano Executivo de Evolução: Meus Remédios PWA → React Native + Web PWA (Dual Stack)

> **Contexto:** Este plano define o roteiro acionável para escalar o **Meus Remédios** habilitando o ecossistema mobile nativo (App Store, Notificações Apple/Google, Biometria, HealthKit) de forma **adicional e simultânea** à PWA Web/Desktop atual.
> **Diretrizes Principais:** Arquitetura via **Monorepo (Turborepo)** e **Desacoplamento de UI** (O Web mantém seu desenvolvimento PWA intocado, enquanto o Native constrói do zero com primitivos nativos).
> **Audiência:** Este plano foi elaborado para orientar os *Sprints* de orquestradores e Agentes de IA Codificadores encarregados da execução.

---

## 1. Arquitetura Alvo: O Ecossistema Monorepo

Para garantir consistência vital do negócio (Regras Zod, chamadas ao Supabase, cálculos médicos) através de duas aplicações visuais totalmente distintas, a única arquitetura escalável é transformando a base de código num Monorepo gerido via **Turborepo**.

```ascii
meus-remedios/ (raiz Turborepo)
├── apps/
│   ├── web/                # O código fonte ATUAL da PWA (~40% esforço futuro)
│   │                       # React 19 + Vite 7 + CSS Modules
│   └── mobile/             # O NOVO App Native (~60% esforço futuro)
│                           # Expo SDK 52 + React Navigation + NativeWind (Tailwind)
├── packages/
│   ├── core/               # EXTRAÍDO da PWA Atual:
│   │   ├── schemas/        # Todos validadores Zod, base unificada
│   │   ├── services/       # Clientes do Supabase (adherence, dlq, utils)
│   │   └── utils/          # adherenceLogic, dateUtils, timezone
│   ├── config/             # Configurações de ESLint, Prettier, dependências comuns
│   └── storage/            # Adapter agnóstico: injeção de localStorage (Web) ou MMKV (Mobile)
├── api/                    # Serverless Vercel (Sem Mudanças — 100% Inalterado)
└── server/bot/             # Telegram Bot (Sem Mudanças — 100% Inalterado)
```

### O Storage Adapter (Padrão Crucial de Projeto)
Para as camadas de cache interno que exigem persistência imediata (`useCachedQuery`), os agentes IA não poderão mais usar `window.localStorage` dentro de `/packages/core`.

**Padrão Exigido:** Cada aplicativo (Web e Mobile) deve instanciar um Singleton do `packages/storage` na inicialização do App. A PWA Web injetará `localStorage`, enquanto o Mobile instanciará o `react-native-mmkv` (muito superior e síncrono para React Native). Todos os services que requerem cache receberão a instância agnóstica de `Storage`.

---

## 2. Matriz de Sequenciamento Numérico (Execução Agente-IA)

A alocação deve ocorrer sequencialmente de **Fases 1 a 6**. Todas as entregas são iterativas.

| Sprint / Fase | Bloco de Entrega | Entregáveis Técnicos Core | Dependências de Execução |
| :--- | :--- | :--- | :--- |
| **Fase 1** | **Fundação Turborepo e Extração do Pacote `Core`** | • Setup do Monorepo no repo existente.<br> • Remanejamento da pasta `src` da PWA para `apps/web/src`.<br> • Extração de regras e schemas para `packages/core`.<br> • Ajuste de imports na PWA, garantindo as compilações e deploy contínuos (zero downtime). | Nenhuma. Ponto de Início. |
| **Fase 2** | **App Expo "Scaffold" e Infraestrutura Local** | • Inicialização do `apps/mobile` com Expo.<br> • Setup seguro do Supabase Auth para celular nativo via `expo-secure-store`.<br> • Construção do `packages/storage` com injeção MMKV.<br> • Construção de teste de Ping Supabase na tela (Login Válido). | Conclusão Completa Fase 1. |
| **Fase 3** | **Fundação de Design e Navegação (React Navigation)** | • Inicialização das Tabs/Stacks via `React Navigation 7`.<br> • Reinterpretação do UI/UX: Criação do framework NativeWind (`tailwind`), separando o modelo mental mobile (touch targets maiores) das raízes do Mouse+CSS Desktop. <br> • Base Components (Botões, Modais de Sheet Inferior, Inputs blindados de teclado). | Conclusão Completa Fase 2. |
| **Fase 4** | **Tradução das Features (Dashboard, Hoje, Estoque)** | • Listas otimizadas com `@shopify/flash-list`.<br> • Recriação nativa interativa de gráficos SVG `react-native-svg`.<br> • Consumo exato dos SWR Caches exportados pelo `packages/core`. | Conclusão Completa Fase 3. |
| **Fase 5** | **Integração de Capacidades Nativas (Superpoderes Mobile)** | • Substituição de WebPush para Push Nativo (`Expo Notifications - APNs/FCM`). Ajustar funções Vercel.<br> • Biometria de login (`expo-local-authentication`).<br> • Integração **HealthKit API** (medição de métricas clínicas via mobile). | Conclusão Completa Fase 4. |
| **Fase 6** | **Testes Finais, Otimizações OTA e Envio (App Stores)** | • Configuração EAS Build.<br> • CI/CD Github Actions para Deploy no TestFlight iOS e Google Console.<br> • Otimização OTA de atualizações visuais do React. | Conclusão Completa Fase 5. |

---

## 3. Matriz de Dependências Técnicas e Pontos de Trava (Blockers)

| Dependência (Feature ou Infra) | Blocker de Qual Módulo | Ação Mitigadora a Executar |
| :--- | :--- | :--- |
| **Extração de `src/schemas` e `src/utils` via Turborepo sem quebrar CIs Web** | Todas as Fases 2-6 requerem esse ambiente isolado funcionando. | Fazer 1 Sprint 100% focado apenas em rodar Vitest pass-rate 100% sobre o Web no novo workspace antes de inicializar o projeto `apps/mobile`. |
| **Adaptação Push Server (Vercel)** | Fase 5: Entrega de Push Nativos no App Store iOS (APNs). | O webhook `api/notify.js` DEVERÁ receber atualizações para discernir Tokens PWA (VAPID) vs Tokens Firebase/Expo para encaminhar payloads corretamente sem duplicar. |
| **Framer Motion na Web vs Reanimated no App** | Fases 3/4: Componentização visual animada (DoseTimeline, RingGauge). | A UI será dividida. O App Expo USARÁ obrigatoriamente `React Native Reanimated`. Os Agentes não podem tentar importar bibliotecas puramente Web no Mobile (ex `jspdf` via canvas web). |
| **Build de Produção Customizado MMKV** | Fases 4-6 não rodarão estavelmente no "Expo Go" comum do celular de desenvolvedor. | Exigir o uso de **custom development clients** gerados previamente pelo **EAS Build** (Cloud) quando formos testar lógicas pesadas C++, visto que MMKV injeta bibliotecas C++ no Native. |

---

## 4. Matriz de Esforço Alto-Nível (Em Sprints Estimativos / Story Points Médios)

*(1 Sprint típico do Agente IA equivale a ~10-15 Story Points de esforço integrado com Revisões Gemini)*

| Fase Estrutural | Dificuldade IA & Risco | Esforço Total | Tempo Equivalente Estimado* |
| :--- | :--- | :--- | :--- |
| **Fase 1: Turborepo / Core Extraction** | Moderado (Requer parser sutil de Webpack/Vite config alias). | 15 SP | ~1 Sprint e ½ |
| **Fase 2: Mobile Scaffold & Auth** | Baixo (Expo entrega padrões extremamente enxutos e Supabase é direto). | 10 SP | ~1 Sprint |
| **Fase 3: Base Components / Navigation** | Alto (Inabilidade da IA de enxergar pixels visualmente requer muitos feedbacks sobre posições e margens). | 25 SP | ~2 a 3 Sprints |
| **Fase 4: Migração das Features** | Extremo (Reinterpretação das Views de SVG e Formulários Completos). | 45 SP | ~4 Sprints |
| **Fase 5: Capacidades Nativas** | Alto (Várias documentações específicas Apple/Google). | 25 SP | ~2 Sprints |
| **Fase 6: Ops e App Stores** | Moderado (Trabalho puramente de DevSecOps, Certificados e Assinatura de Código). | 10 SP | ~1 Sprint |
| **TOTAL ESTIMADO** | | **130 SP** | **~11 Sprints (± 2.5 Meses com foco total PWA+Native)** |

---

## 5. Matriz de Riscos Operacionais e Mitigação Recomendada

| Identificador do Risco | Probabilidade | Impacto | Estratégia de Mitigação |
| :--- | :--- | :--- | :--- |
| **Risco 1: *Schema Drift* Categórico** | Elevado (Se não usarmos Monorepo) | Catástrofe de dados | Adotar a estrutura proposta nesse documento (`Turborepo`). Agentes nunca podem duplicar classes `Zod`. Se uma regra em pt-br muda (Ex: *Dose inválida*), ela muda no Monorepo-Core refletindo instantaneamente na PWA/Vercel e Local no App React Native. |
| **Risco 2: Paralisação de Performance Web (Vite Slowdown)** | Baixo | Moderado | A PWA só receberá imports via `packages/core`. Um agente mal instruído poderia atrelar dependências nativas (`react-native-reanimated`) ao core base do modelo. **Mitigação Restrita:** Garantir que o `package.json` da camada `core` mantenha pureza extrema (Nodes puros, sem dependências de Browser Native ou React DOM baseados). |
| **Risco 3: Falha na Revisão da App Store Apple** | Alto | Alto (Bloqueio) | Em vez de clonar UI Desktop em tela mobile, aplicar a Fase 3 rigorosamente: Adotar guias HIG (Human Interface Guideline) Apple, usando Native Stack Headers e modais fluidos nativos, garantindo 100% de compliance UX e impedindo negação de "App looks like a Website" por parte do tribunal de revisão da Apple Store. |
| **Risco 4: Saturação de Logs do Serverless (Vercel)** | Moderado | Moderado (Cota de budget) | Os apps Native farão retries com latência menor se sem conexão. Reforçar o mecanismo de Retry do Cache Layer para exponencial backoff e poupar os endpoints DLQ do serverless da Vercel. |

---

> **Observação de Arquitetura Finalizada:** O sucesso desse plano para IAs repousa num axioma simples: o robô não deve decidir misturar UI se houver dúvidas. O código HTML da PWA morre no `/apps/web` e o código JSX React Native tem seu terreno em `/apps/mobile`. Apenas o cérebro matemático, base e Zod Models convergem. Tudo que é visual, diverge e atende esteticamente seus clientes ideais.
