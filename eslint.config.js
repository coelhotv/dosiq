import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
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
    settings: {
      'import/resolver': {
        alias: {
          map: [
            ['@', './src'],
            ['@features', './src/features'],
            ['@shared', './src/shared'],
            ['@dashboard', './src/features/dashboard'],
            ['@medications', './src/features/medications'],
            ['@protocols', './src/features/protocols'],
            ['@stock', './src/features/stock'],
            ['@adherence', './src/features/adherence'],
          ],
          extensions: ['.js', '.jsx', '.json'],
        },
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^(motion|AnimatePresence|[A-Z_])' }],

      // Prevenir regressão para diretórios legados deletados na Wave 9
      'no-restricted-imports': ['error', {
        patterns: [
          // src/lib/ foi deletado — use @shared/utils/supabase ou @shared/utils/queryCache
          {
            group: ['**/lib/supabase*', '**/lib/queryCache*'],
            message: 'src/lib/ foi removido. Use "@shared/utils/supabase" ou "@shared/utils/queryCache".',
          },
          // @shared/constants/ foi deletado — use @schemas/
          {
            group: ['@shared/constants', '@shared/constants/**'],
            message: '@shared/constants/ foi removido. Use "@schemas/" (ex: "@schemas/medicineSchema").',
          },
          // Feature-level constants foram deletados — use @schemas/
          {
            group: ['@medications/constants/**', '@stock/constants/**'],
            message: 'Feature constants/ foram removidos. Use "@schemas/" diretamente.',
          },
        ],
      }],
    },
  },
])
