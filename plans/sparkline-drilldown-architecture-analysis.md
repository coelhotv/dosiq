# Architecture Analysis: Sparkline Drill-Down Feature

**Project:** Meus Remédios - Medication Adherence Application  
**Analysis Date:** 2026-02-11  
**Objective:** Document codebase architecture to inform drill-down functionality implementation for the adherence sparkline

---

## Table of Contents

1. [SparklineAdesao Component](#1-sparklineadesao-component)
2. [Dashboard View Structure](#2-dashboard-view-structure)
3. [LogService API](#3-logservicex-api)
4. [AdherenceService API](#4-adherenceservice-api)
5. [Modal Patterns](#5-modal-patterns)
6. [useCachedQuery Hook](#6-usecachedquery-hook)
7. [Zod Schemas](#7-zod-schemas)
8. [Implementation Recommendations](#8-implementation-recommendations)

---

## 1. SparklineAdesao Component

**File Location:** `src/components/dashboard/SparklineAdesao.jsx`

### Key Exports

| Export | Type | Description |
|--------|------|-------------|
| `SparklineAdesao` | Component (default) | Main sparkline visualization component |
| `generateSparklinePath` | Function | SVG path generator for the line chart |
| `createSmoothPath` | Function | Creates smooth quadratic curves between points |
| `getAdherenceColor` | Function | Returns semantic color based on adherence percentage |

### Props Interface

```typescript
interface SparklineAdesaoProps {
  adherenceByDay: Array<{
    date: string;        // Format: 'YYYY-MM-DD'
    adherence: number;   // 0-100 percentage
    taken: number;       // Doses actually taken
    expected: number;    // Doses expected
  }>;
  size?: 'small' | 'medium' | 'large';
  showAxis?: boolean;
  showTooltip?: boolean;
  className?: string;
}
```

### Size Configurations

| Size | Width | Height | Padding | Dot Radius |
|------|-------|--------|---------|------------|
| small | 120px | 32px | 4px | 1.5px |
| medium | 200px | 40px | 6px | 2px |
| large | 280px | 48px | 8px | 2px |

### State Management

- **No internal component state** - Pure presentational component
- Uses `useMemo` for computed values:
  - `chartData`: Processed 7-day data array
  - `stats`: Average adherence and trend direction
  - `sparklinePath`: SVG path string
  - `gradientArea`: Path for gradient fill
  - `dataPoints`: Array of point coordinates with data

### Data Processing Logic

```javascript
// Always generates last 7 days from current date
const chartData = useMemo(() => {
  const today = new Date()
  const data = []
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateKey = date.toISOString().split('T')[0]
    
    const dayData = adherenceByDay.find(d => d.date === dateKey)
    data.push({
      date: dateKey,
      dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
      adherence: dayData?.adherence ?? 0,
      taken: dayData?.taken ?? 0,
      expected: dayData?.expected ?? 0
    })
  }
  return data
}, [adherenceByDay])
```

### Date/Timezone Handling

- Uses **local browser date** (GMT-3 for São Paulo timezone)
- Date key format: `YYYY-MM-DD` via `date.toISOString().split('T')[0]`
- Day names localized to Portuguese (pt-BR): "seg", "ter", "qua", etc.
- Gap filling: Missing days default to `{ adherence: 0, taken: 0, expected: 0 }`

### Interaction Handlers

**Current Implementation:**

```javascript
const handleSparklineTap = (dayData) => {
  analyticsService.track('sparkline_tapped', {
    date: dayData.date,
    adherence: dayData.adherence
  })
}

// Applied to entire container
<div onClick={() => handleSparklineTap(chartData[chartData.length - 1])}>
```

**Key Observations:**
- Click handler is on the **container**, not individual points
- Currently only tracks analytics (no drill-down)
- Always passes the **last day** data regardless of click position

**Data Points Structure (for tooltip extension):**

```javascript
const dataPoints = chartData.map((d, i) => {
  const stepX = (width - padding * 2) / (chartData.length - 1 || 1)
  const x = padding + i * stepX
  const y = padding + (height - padding * 2) - (d.adherence / 100) * (height - padding * 2)
  return { ...d, x, y }  // Includes all data + coordinates
})
```

---

## 2. Dashboard View Structure

**File Location:** `src/views/Dashboard.jsx`

### Component Hierarchy

```jsx
Dashboard
├── Greeting Header (dynamic based on time)
├── HealthScoreCard (clickable → opens details modal)
├── SparklineAdesao (adherence trend visualization)
├── SmartAlerts (medication reminders & stock alerts)
├── QuickActionsWidget (register dose buttons)
└── TreatmentAccordion (medication schedules)
```

### State Management

**Modal States:**

```javascript
// Dashboard-level modal management
const [isModalOpen, setIsModalOpen] = useState(false)
const [prefillData, setPrefillData] = useState(null)
const [isHealthDetailsOpen, setIsHealthDetailsOpen] = useState(false)
```

**Snoozed Alerts State:**

```javascript
const SNOOZE_STORAGE_KEY = 'mr_snoozed_alerts'
const SNOOZE_DURATION_MS = 4 * 60 * 60 * 1000  // 4 hours

const [snoozedAlerts, setSnoozedAlerts] = useState(() => {
  // Initialized from localStorage with expiration check
  const data = localStorage.getItem(SNOOZE_STORAGE_KEY)
  // Returns Map<alertId, { snoozedAt, expiresAt, scheduledTime }>
})
```

**Adherence Data State:**

```javascript
const [dailyAdherence, setDailyAdherence] = useState([])
const [isAdherenceLoading, setIsAdherenceLoading] = useState(true)

useEffect(() => {
  async function loadAdherence() {
    const data = await adherenceService.getDailyAdherence(7)
    setDailyAdherence(data)
    setIsAdherenceLoading(false)
  }
  loadAdherence()
}, [])
```

### Data Flow

```
adherenceService.getDailyAdherence(7)
         ↓
    dailyAdherence (state)
         ↓
<SparklineAdesao adherenceByDay={dailyAdherence} />
```

### Key Handlers

```javascript
// Dose registration from swipe/action
const handleRegisterDose = async (medicineId, protocolId) => {
  await logService.create({
    medicine_id: medicineId,
    protocol_id: protocolId,
    quantity_taken: 1,
    taken_at: new Date().toISOString()
  })
  refresh()  // Refreshes dashboard context
}

// Alert snoozing
const handleSnoozeAlert = (alertId, durationMinutes, scheduledTime) => {
  const snoozedAt = Date.now()
  const expiresAt = snoozedAt + (durationMinutes * 60 * 1000)
  setSnoozedAlerts(prev => new Map(prev).set(alertId, {
    snoozedAt, expiresAt, scheduledTime
  }))
}
```

---

## 3. LogService API

**File Location:** `src/services/api/logService.js`

### Service Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAll` | `(limit = 50) => Promise<Log[]>` | All user logs with joins |
| `getByProtocol` | `(protocolId, limit = 50) => Promise<Log[]>` | Logs for specific protocol |
| `getByDateRange` | `(startDate, endDate, limit, offset) => Promise<PaginatedResult>` | **Key for drill-down** |
| `getByMonth` | `(year, month) => Promise<PaginatedResult>` | Month-based retrieval |
| `create` | `(log) => Promise<Log>` | Create log + decrement stock |
| `createBulk` | `(logs) => Promise<Log[]>` | Batch creation |
| `update` | `(id, updates) => Promise<Log>` | Update log + adjust stock |
| `delete` | `(id) => Promise<void>` | Delete log + restore stock |

### Log Data Structure

```typescript
interface Log {
  id: string;              // UUID
  user_id: string;         // UUID
  protocol_id: string | null;
  medicine_id: string;     // UUID
  taken_at: string;        // ISO 8601 datetime
  quantity_taken: number;  // Pills taken (1-100)
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined relations
  protocol: Protocol | null;
  medicine: Medicine;
}
```

### Critical Method: getByDateRange

**Location:** Line 273

```javascript
getByDateRange: async (startDate, endDate, limit = 50, offset = 0) => {
  const { data, error, count } = await supabase
    .from('medicine_logs')
    .select(`
      *,
      protocol:protocols(*),
      medicine:medicines(*)
    `, { count: 'exact' })
    .eq('user_id', await getUserId())
    .gte('taken_at', `${startDate}T00:00:00`)   // Inclusive start
    .lte('taken_at', `${endDate}T23:59:59`)     // Inclusive end
    .order('taken_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (error) throw error
  
  return {
    data: data || [],
    total: count || 0,
    hasMore: (offset + limit) < (count || 0)
  }
}
```

**Usage for Single Date:**

```javascript
// To get logs for a specific day
const result = await logService.getByDateRange('2026-02-11', '2026-02-11')
// Returns: { data: Log[], total: number, hasMore: boolean }
```

### Validation

All methods validate with Zod schemas:

```javascript
import { validateLogCreate, validateLogUpdate } from '../../schemas/logSchema'

async create(log) {
  const validation = validateLogCreate(log)
  if (!validation.success) {
    throw new Error(`Erro de validação: ${validation.errors.map(e => e.message).join(', ')}`)
  }
  // ... proceed with validated data
}
```

---

## 4. AdherenceService API

**File Location:** `src/services/api/adherenceService.js`

### Service Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `calculateAdherence` | `(period = '30d') => Promise<AdherenceResult>` | Overall score for period |
| `calculateProtocolAdherence` | `(protocolId, period) => Promise<ProtocolAdherence>` | Per-protocol score |
| `calculateAllProtocolsAdherence` | `(period) => Promise<ProtocolAdherence[]>` | All protocols |
| `getCurrentStreak` | `() => Promise<StreakData>` | Current and longest streak |
| `getAdherenceSummary` | `(period) => Promise<Summary>` | Dashboard summary |
| `getDailyAdherence` | `(days = 7) => Promise<DailyAdherence[]>` | **Used by sparkline** |

### Critical Method: getDailyAdherence

**Location:** Line 242

```javascript
async getDailyAdherence(days = 7) {
  const userId = await getUserId()
  
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Fetch active protocols
  const { data: protocols, error: protocolError } = await supabase
    .from('protocols')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)

  // Timezone compensation: expand range by ±24 hours
  const adjustedStartDate = new Date(startDate)
  adjustedStartDate.setHours(adjustedStartDate.getHours() - 24)
  
  const adjustedEndDate = new Date(endDate)
  adjustedEndDate.setHours(adjustedEndDate.getHours() + 24)

  // Fetch logs with expanded range
  const { data: logs, error: logError } = await supabase
    .from('medicine_logs')
    .select('taken_at')
    .eq('user_id', userId)
    .gte('taken_at', adjustedStartDate.toISOString())
    .lte('taken_at', adjustedEndDate.toISOString())

  // Calculate expected doses
  const dailyExpected = calculateDailyExpectedDoses(protocols)
  
  // Group by local date (NOT UTC)
  const logsByDay = groupLogsByDay(logs)

  // Generate daily data
  const dailyData = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(endDate)
    date.setDate(date.getDate() - i)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateKey = `${year}-${month}-${day}`
    
    const taken = logsByDay.get(dateKey) || 0
    const adherence = dailyExpected > 0 
      ? Math.round((taken / dailyExpected) * 100)
      : 0
    
    dailyData.push({ date: dateKey, taken, expected: Math.round(dailyExpected), adherence })
  }

  return dailyData
}
```

### Return Type

```typescript
interface DailyAdherence {
  date: string;      // 'YYYY-MM-DD'
  taken: number;     // Doses taken
  expected: number;  // Doses expected
  adherence: number; // 0-100 percentage
}
```

### Timezone Handling

**Key Function: groupLogsByDay**

```javascript
function groupLogsByDay(logs) {
  const days = new Map()

  logs.forEach(log => {
    const date = new Date(log.taken_at)
    // Uses LOCAL date components (respects browser timezone)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dayKey = `${year}-${month}-${day}`
    days.set(dayKey, (days.get(dayKey) || 0) + 1)
  })

  return days
}
```

**Important:** Service handles GMT-3 to UTC conversion by expanding search range. A dose taken at 23:00 GMT-3 (02:00 UTC next day) will be correctly attributed to the local date.

---

## 5. Modal Patterns

**File Location:** `src/components/ui/Modal.jsx` & `src/components/ui/Modal.css`

### Modal Component API

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}
```

### Usage Pattern in Dashboard

```jsx
// State management
const [isHealthDetailsOpen, setIsHealthDetailsOpen] = useState(false)

// Trigger
<HealthScoreCard onClick={() => setIsHealthDetailsOpen(true)} />

// Modal render
<Modal
  isOpen={isHealthDetailsOpen}
  onClose={() => setIsHealthDetailsOpen(false)}
  title="Score de Saúde"
>
  <HealthScoreDetails score={stats.adherence} />
</Modal>
```

### Modal Features

- **Keyboard support:** ESC key closes modal
- **Backdrop click:** Clicking overlay closes modal
- **Body scroll:** Prevents background scrolling when open
- **Animation:** CSS fade-in and slide-up transitions
- **Close button:** ✕ button in header

### CSS Structure

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 15, 0.9);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}
```

### Mobile Behavior

```css
@media (max-width: 768px) {
  .modal-overlay {
    padding: 0;
    align-items: flex-end;  /* Bottom-aligned */
  }
}
```

---

## 6. useCachedQuery Hook

**File Location:** `src/hooks/useCachedQuery.js`

### Hook API

```typescript
function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: {
    enabled?: boolean;      // Default: true
    staleTime?: number;     // Cache TTL in ms
    initialData?: T;        // SSR/hydration data
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }
): {
  data: T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<T>;  // Force refresh
  refresh: () => Promise<T>;  // Background refresh
}
```

### Cache Configuration

**Location:** `src/lib/queryCache.js`

```javascript
const CACHE_CONFIG = {
  STALE_TIME: 30 * 1000,     // 30 seconds
  MAX_ENTRIES: 200,          // LRU eviction limit
  GC_INTERVAL: 60 * 1000,    // Garbage collection
  PERSIST_KEY: 'meus_remedios_query_cache'
}
```

### SWR Behavior

1. **Cache HIT (fresh):** Return cached data immediately (~0-50ms)
2. **Cache HIT (stale):** Return stale data + revalidate in background
3. **Cache MISS:** Execute fetcher, cache result, return data

### Recommended Pattern for Drill-Down

```javascript
// In Dashboard component
const [selectedDate, setSelectedDate] = useState(null)

const { 
  data: dayLogs, 
  isLoading,
  error 
} = useCachedQuery(
  selectedDate ? `logs-${selectedDate}` : null,
  () => logService.getByDateRange(selectedDate, selectedDate),
  { 
    enabled: !!selectedDate,
    staleTime: 60000  // 1 minute cache
  }
)
```

### Parallel Queries Hook

```javascript
// For fetching multiple dates at once
const { results, isLoading, hasError } = useCachedQueries([
  { key: 'logs-2026-02-10', fetcher: () => logService.getByDateRange('2026-02-10', '2026-02-10') },
  { key: 'logs-2026-02-11', fetcher: () => logService.getByDateRange('2026-02-11', '2026-02-11') }
])
```

---

## 7. Zod Schemas

### Log Schema

**File:** `src/schemas/logSchema.js`

```javascript
export const logSchema = z.object({
  protocol_id: z.string().uuid().optional().nullable(),
  medicine_id: z.string().uuid(),
  taken_at: z.string().datetime(),
  quantity_taken: z.number().positive().max(100),
  notes: z.string().max(500).optional().nullable()
})
```

**Validation Functions:**

| Function | Purpose |
|----------|---------|
| `validateLog(data)` | General validation |
| `validateLogCreate(data)` | Creation validation |
| `validateLogUpdate(data)` | Partial update validation |
| `validateLogBulkArray(logs)` | Batch validation |

### Protocol Schema

**File:** `src/schemas/protocolSchema.js`

```javascript
export const protocolSchema = z.object({
  medicine_id: z.string().uuid(),
  treatment_plan_id: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(200),
  frequency: z.enum(['diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário']),
  time_schedule: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)).min(1).max(10),
  dosage_per_intake: z.number().positive().max(1000),
  titration_status: z.enum(['estável', 'titulando', 'alvo_atingido']).default('estável'),
  titration_schedule: z.array(titrationStageSchema).max(50).optional().default([]),
  current_stage_index: z.number().int().min(0).default(0),
  stage_started_at: z.string().datetime().optional().nullable(),
  active: z.boolean().default(true),
  notes: z.string().max(1000).optional().nullable()
})
```

**Frequency Labels:**

| Value | Display Label |
|-------|---------------|
| diário | Diário |
| dias_alternados | Dias Alternados |
| semanal | Semanal |
| personalizado | Personalizado |
| quando_necessário | Quando Necessário |

### Medicine Schema

**File:** `src/schemas/medicineSchema.js`

```javascript
export const medicineSchema = z.object({
  name: z.string().min(2).max(200),
  laboratory: z.string().max(200).optional().nullable(),
  active_ingredient: z.string().max(300).optional().nullable(),
  dosage_per_pill: z.number().positive().max(10000),
  dosage_unit: z.enum(['mg', 'mcg', 'g', 'ml', 'ui', 'cp', 'gotas']),
  type: z.enum(['medicamento', 'suplemento']).default('medicamento')
})
```

**Dosage Unit Labels:**

| Value | Display |
|-------|---------|
| mg | mg |
| mcg | mcg |
| g | g |
| ml | ml |
| ui | UI |
| cp | cp/cap |
| gotas | gotas |

---

## 8. Implementation Recommendations

### Recommended Component Changes

#### 1. SparklineAdesao.jsx

Add `onDayClick` prop:

```javascript
export function SparklineAdesao({
  adherenceByDay = [],
  size = 'medium',
  showAxis = false,
  showTooltip = true,
  className = '',
  onDayClick = null  // NEW PROP
}) {
  // ... existing code
  
  return (
    <div className={`sparkline-adhesion ${className}`}>
      <svg>
        {/* Existing paths */}
        
        {dataPoints.map((d, i) => (
          <motion.circle
            key={d.date}
            cx={d.x}
            cy={d.y}
            r={size === 'small' ? 1.5 : 2}
            fill={getAdherenceColor(d.adherence)}
            className="sparkline-dot"
            onClick={() => onDayClick?.(d)}  // NEW: Individual click handler
            style={{ cursor: onDayClick ? 'pointer' : 'default' }}
            // ... rest of props
          />
        ))}
      </svg>
    </div>
  )
}
```

#### 2. Dashboard.jsx

Add date drill-down state and modal:

```javascript
export default function Dashboard({ onNavigate }) {
  // ... existing state
  
  // NEW: Date drill-down state
  const [selectedDate, setSelectedDate] = useState(null)
  
  // NEW: Fetch logs for selected date
  const { 
    data: dayLogs, 
    isLoading: logsLoading 
  } = useCachedQuery(
    selectedDate ? `logs-${selectedDate}` : null,
    () => logService.getByDateRange(selectedDate, selectedDate, 50),
    { enabled: !!selectedDate, staleTime: 60000 }
  )
  
  // ... existing code
  
  return (
    <div className={styles.dashboard}>
      {/* ... existing components */}
      
      <SparklineAdesao 
        adherenceByDay={dailyAdherence}
        onDayClick={(dayData) => setSelectedDate(dayData.date)}  // NEW
      />
      
      {/* ... existing components */}
      
      {/* NEW: Date drill-down modal */}
      <Modal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatDate(selectedDate) : ''}
      >
        {logsLoading ? (
          <Loading />
        ) : (
          <DayLogDetails 
            date={selectedDate}
            logs={dayLogs?.data || []}
            summary={dailyAdherence.find(d => d.date === selectedDate)}
          />
        )}
      </Modal>
    </div>
  )
}
```

#### 3. New Component: DayLogDetails.jsx

```jsx
// src/components/dashboard/DayLogDetails.jsx
export function DayLogDetails({ date, logs, summary }) {
  if (!logs || logs.length === 0) {
    return (
      <EmptyState 
        icon="📋"
        title="Nenhum registro"
        message={`Nenhuma dose registrada em ${formatDate(date)}`}
      />
    )
  }
  
  return (
    <div className="day-log-details">
      <div className="day-summary">
        <span className="adherence-badge">
          {summary?.adherence || 0}% adesão
        </span>
        <span className="dose-count">
          {summary?.taken || 0} de {summary?.expected || 0} doses
        </span>
      </div>
      
      <div className="log-list">
        {logs.map(log => (
          <LogEntry key={log.id} log={log} />
        ))}
      </div>
    </div>
  )
}
```

### Data Flow Summary

```
User clicks sparkline point
         ↓
SparklineAdesao calls onDayClick(dayData)
         ↓
Dashboard sets selectedDate = dayData.date
         ↓
useCachedQuery triggers with key `logs-${date}`
         ↓
logService.getByDateRange(date, date)
         ↓
Modal opens with DayLogDetails
```

### Key Considerations

1. **Timezone:** Service handles GMT-3/UTC conversion automatically
2. **Caching:** Per-date cache keys prevent unnecessary refetches
3. **Pagination:** `getByDateRange` supports pagination if needed
4. **Validation:** All data validated with Zod schemas
5. **Mobile:** Modal is bottom-aligned on mobile devices
6. **Accessibility:** Sparkline dots are already `graphics-symbol` roles

---

*Analysis complete. All components follow established patterns with Zod validation, SWR caching, and proper timezone handling.*
