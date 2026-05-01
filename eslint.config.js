import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import importX from 'eslint-plugin-import-x'
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths'
import n from 'eslint-plugin-n'
import reactNative from 'eslint-plugin-react-native'

export default [
  { ignores: [
    '**/dist/**',
    '**/node_modules/**',
    '**/.git/**',
    '**/android/**',
    '**/ios/**',
    '**/coverage/**',
    '**/.next/**',
    '**/build/**',
    '**/.expo/**',
    '**/.vercel/**',
    '**/scripts/**',
    '**/scratches/**'
  ] },
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['**/*.config.{js,jsx}', '**/vite.config.js', '**/vitest.config.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'import-x': importX,
      'no-relative-import-paths': noRelativeImportPaths,
    },
    settings: {
      'import-x/resolver': {
        node: true,
        alias: {
          map: [
            ['@', './apps/web/src'],
            ['@features', './apps/web/src/features'],
            ['@shared', './apps/web/src/shared'],
            ['@services', './apps/web/src/services'],
            ['@dashboard', './apps/web/src/features/dashboard'],
            ['@medications', './apps/web/src/features/medications'],
            ['@protocols', './apps/web/src/features/protocols'],
            ['@stock', './apps/web/src/features/stock'],
            ['@adherence', './apps/web/src/features/adherence'],
            ['@calendar', './apps/web/src/features/calendar'],
            ['@emergency', './apps/web/src/features/emergency'],
            ['@prescriptions', './apps/web/src/features/prescriptions'],
            ['@schemas', './apps/web/src/schemas'],
            ['@utils', './apps/web/src/utils'],
            ['@design-tokens', './packages/design-tokens/src'],
            ['@dosiq/core', './packages/core/src']
          ],
          extensions: ['.js', '.jsx', '.ts', '.tsx']
        }
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      
      // R-116: no-console (redução de ruído em produção)
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],

      // R-002: Forçar uso de Aliases em vez de caminhos relativos longos
      'no-relative-import-paths/no-relative-import-paths': [
        'error',
        { allowSameFolder: true, rootDir: 'apps/web/src', prefix: '@' }
      ],

      // Import rules
      'import-x/no-unresolved': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-duplicates': 'error',

      // R-122: Complexidade e Tamanho de Funções
      'complexity': ['warn', { max: 15 }],
      'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],

      'no-unused-vars': ['error', { varsIgnorePattern: '^(motion|AnimatePresence|[A-Z_])' }],

      // AI Agent Guardrails & DevFlow Rules
      'no-restricted-syntax': [
        'error',
        // R-020: Timezone Safe Dates
        {
          selector: 'NewExpression[callee.name="Date"]',
          message: 'Não use "new Date()". Use "parseLocalDate()" de @utils/dateUtils para evitar bugs de timezone (R-020).'
        },
        // R-020: Proibir bibliotecas de data externas sem centralização
        {
          selector: 'ImportDeclaration[source.value="dayjs"], ImportDeclaration[source.value="moment"]',
          message: 'Não use dayjs/moment diretamente. Centralize lógica de data em @utils/dateUtils (R-020).'
        },
        // R-204: Acessibilidade (Botões sobre Divs)
        {
          selector: 'JSXOpeningElement[name.name="div"] > JSXAttribute[name.name="onClick"]',
          message: 'Não use <div> com onClick. Use <button> ou o componente <Button> para acessibilidade (R-204).'
        },
        // ADR-008: Design System hardcoded colors detection
        {
          selector: 'JSXAttribute[name.name="style"] Literal[value=/^#|^rgb|^hsl/]',
          message: 'Não use cores hardcoded em estilos inline. Use variáveis CSS do Design System (--color-*).'
        }
      ],

      'no-restricted-imports': ['error', {
        patterns: [
          // Estágio 1: Cross-boundary imports
          {
            group: ['**/server/**'],
            message: 'Aplicações Web não devem importar diretamente do diretório server/. Use @packages/core para lógica compartilhada.'
          },
          // Legado Wave 9 (preservado)
          {
            group: ['**/lib/**'],
            message: 'src/lib/ foi removido. Use "@shared/utils/supabase" ou "@shared/utils/queryCache".',
          },
          {
            group: [
              './hooks', './hooks/**',
              '../hooks', '../hooks/**',
              '../../hooks', '../../hooks/**',
              '../../../hooks', '../../../hooks/**',
            ],
            message: 'src/hooks/ foi removido. Use "@shared/hooks/" ou o alias da feature (ex: "@dashboard/hooks/", "@medications/hooks/").',
          },
          {
            group: [
              './components', './components/**',
              '../components', '../components/**',
              '../../components', '../../components/**',
              '../../../components', '../../../components/**',
            ],
            message: 'src/components/ foi removido. Use "@shared/components/" ou o alias da feature (ex: "@medications/components/", "@stock/components/").',
          },
          {
            group: ['@shared/constants', '@shared/constants/**'],
            message: '@shared/constants/ foi removido. Use "@schemas/" (ex: "@schemas/medicineSchema").',
          },
          {
            group: ['@medications/constants/**', '@stock/constants/**'],
            message: 'Feature constants/ foram removidos. Use "@schemas/" diretamente.',
          },
        ]
      }]
    },
  },
  {
    files: ['**/*.config.{js,jsx}', '**/vite.config.js', '**/vitest.config.js', '**/vitest.ci.config.js'],
    rules: {
      'import-x/no-unresolved': 'off',
    },
  },
  // Estágio 3: Domínios Específicos
  {
    // Server & API (Node.js Strict)
    files: ['server/**/*.js', 'api/**/*.js'],
    plugins: {
      n,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'n/no-process-exit': 'error',
      'n/no-path-concat': 'error',
      'no-console': 'off', // Logs são essenciais no server
    },
  },
  {
    // Mobile (React Native)
    files: ['apps/mobile/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-native': reactNative,
    },
    languageOptions: {
      globals: {
        ...globals.browser, // RN usa alguns browser globals (console, fetch)
        '__DEV__': 'readonly',
      },
    },
    settings: {
      'import-x/resolver': {
        node: true,
        alias: {
          map: [
            ['@', './apps/mobile/src'],
            ['@shared', './apps/mobile/src/shared'],
            ['@features', './apps/mobile/src/features'],
            ['@utils', './apps/mobile/src/utils'],
            ['@schemas', './apps/mobile/src/schemas'],
            ['@adherence', './apps/mobile/src/features/adherence'],
            ['@medications', './apps/mobile/src/features/medications'],
            ['@protocols', './apps/mobile/src/features/protocols'],
            ['@stock', './apps/mobile/src/features/stock'],
            ['@dashboard', './apps/mobile/src/features/dashboard'],
          ],
          extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.ts', '.tsx']
        }
      }
    },
    rules: {
      'react-native/no-inline-styles': 'warn',
      'react-native/no-color-literals': 'warn',
      'react-native/no-raw-text': 'error',
      'no-relative-import-paths/no-relative-import-paths': 'off', // Mobile usa estrutura diferente
    },
  },
]
