# Feature-Based Architecture

## Estrutura de Features

```
src/features/
├── dashboard/          # Dashboard e widgets principais
├── medications/        # Medicamentos e cadastro
├── protocols/          # Protocolos e rotinas de medicação
├── stock/              # Controle de estoque
└── adherence/          # Aderência e streaks
```

## Shared

```
src/shared/
├── components/ui/      # Componentes UI reutilizáveis (Button, Card, Modal, etc)
├── hooks/              # Hooks genéricos reutilizáveis
├── services/           # Serviços compartilhados
├── constants/          # Constantes globais
└── utils/              # Utilitários genéricos
```

## Path Aliases

- `@` → `./src`
- `@features` → `./src/features`
- `@shared` → `./src/shared`
- `@dashboard` → `./src/features/dashboard`
- `@medications` → `./src/features/medications`
- `@protocols` → `./src/features/protocols`
- `@stock` → `./src/features/stock`
- `@adherence` → `./src/features/adherence`

## Mapeamento de Migração

### adherence (smallest feature - start here)
| Source | Destination |
|--------|-------------|
| `src/components/adherence/*` | `src/features/adherence/components/` |
| `src/hooks/useAdherenceTrend.js` | `src/features/adherence/hooks/` |
| `src/services/api/adherenceService.js` | `src/features/adherence/services/` |
| `src/utils/adherenceLogic.js` | `src/features/adherence/utils/` |

### medications
| Source | Destination |
|--------|-------------|
| `src/components/medicine/*` | `src/features/medications/components/` |
| `src/services/api/medicineService.js` | `src/features/medications/services/` |
| `src/schemas/medicineSchema.js` | `src/features/medications/constants/` |

### protocols
| Source | Destination |
|--------|-------------|
| `src/components/protocol/*` | `src/features/protocols/components/` |
| `src/services/api/protocolService.js` | `src/features/protocols/services/` |
| `src/services/api/titrationService.js` | `src/features/protocols/services/` |
| `src/services/api/treatmentPlanService.js` | `src/features/protocols/services/` |
| `src/schemas/protocolSchema.js` | `src/features/protocols/constants/` |
| `src/utils/titrationUtils.js` | `src/features/protocols/utils/` |

### stock
| Source | Destination |
|--------|-------------|
| `src/components/stock/*` | `src/features/stock/components/` |
| `src/services/api/stockService.js` | `src/features/stock/services/` |
| `src/schemas/stockSchema.js` | `src/features/stock/constants/` |

### dashboard
| Source | Destination |
|--------|-------------|
| `src/components/dashboard/*` | `src/features/dashboard/components/` |
| `src/hooks/useDashboardContext.jsx` | `src/features/dashboard/hooks/` |
| `src/hooks/useInsights.js` | `src/features/dashboard/hooks/` |
| `src/services/insightService.js` | `src/features/dashboard/services/` |
| `src/services/analyticsService.js` | `src/features/dashboard/services/` |
| `src/services/milestoneService.js` | `src/features/dashboard/services/` |

### shared/ui
| Source | Destination |
|--------|-------------|
| `src/components/ui/*` | `src/shared/components/ui/` |
| `src/components/BottomNav.*` | `src/shared/components/ui/` |
| `src/components/animations/*` | `src/shared/components/ui/animations/` |
| `src/components/log/*` | `src/shared/components/log/` |
| `src/components/gamification/*` | `src/shared/components/gamification/` |
| `src/components/onboarding/*` | `src/shared/components/onboarding/` |
| `src/hooks/useCachedQuery.js` | `src/shared/hooks/` |
| `src/hooks/useHapticFeedback.js` | `src/shared/hooks/` |
| `src/hooks/useShake.js` | `src/shared/hooks/` |
| `src/hooks/useTheme.js` | `src/shared/hooks/` |
| `src/lib/*` | `src/shared/utils/` |
| `src/services/api/cachedServices.js` | `src/shared/services/` |
| `src/services/api/index.js` | `src/shared/services/` |
| `src/services/api/migrationService.js` | `src/shared/services/` |
| `src/services/paginationService.js` | `src/shared/services/` |
| `src/schemas/*` | `src/shared/constants/` |
| `src/styles/*` | `src/shared/styles/` |

## Regras de Importação

### Após a Migração:

```javascript
// ❌ Antes
import Button from '../../components/ui/Button'
import { useCachedQuery } from '../../hooks/useCachedQuery'
import { medicineService } from '../services/api/medicineService'

// ✅ Depois
import Button from '@shared/components/ui/Button'
import { useCachedQuery } from '@shared/hooks/useCachedQuery'
import { medicineService } from '@medications/services/medicineService'
```

## Validação

Após cada migração:
1. `npm run lint` - Deve passar sem erros
2. `npm run test:critical` - Todos os testes críticos devem passar
3. `npm run build` - Build deve ser gerado com sucesso
